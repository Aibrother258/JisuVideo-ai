import { Hono } from 'hono'
import { and, eq, isNull, inArray, or, desc } from 'drizzle-orm'
import { db, getInsertId, schema } from '../db/index.js'
import { success, notFound, badRequest, now } from '../utils/response.js'
import { toSnakeCaseArray, toSnakeCase } from '../utils/transform.js'
import { getActiveConfigId } from '../services/ai.js'
import { EXTRACT_TARGETS, getExtractionStatus, startExtraction, type ExtractTarget } from '../services/extraction.js'
import { getVideoPromptBatchStatus, startVideoPromptBatch } from '../services/video-prompts.js'

const app = new Hono()

// POST /episodes — Create a new episode
app.post('/', async (c) => {
  const body = await c.req.json()
  if (!body.drama_id) return badRequest(c, 'drama_id required')

  // 图片/视频配置：显式传入优先，缺省时自动锁定当前启用的最高优先级官方配置
  // 图片配置是生图的硬前置；视频配置允许缺省（未配视频厂商时仍可建集、做剧本/分镜/生图）
  const imageConfigId = body.image_config_id ?? await getActiveConfigId('image')
  const videoConfigId = body.video_config_id ?? await getActiveConfigId('video')
  if (!imageConfigId) return badRequest(c, '未找到启用的图片生成配置，请先在设置中心添加')
  const ts = now()

  // 集号在同一项目内永久唯一；软删记录仍占用旧集号，避免与历史分镜/任务产生歧义。
  // 并发建集时 max+1 可能算出相同集号，靠 (drama_id, episode_number) 唯一索引兜底，
  // 冲突时重查重试（最多 3 次）
  const MAX_NUM_RETRIES = 3
  for (let attempt = 0; ; attempt++) {
    const existing = await db.select({ episodeNumber: schema.episodes.episodeNumber })
      .from(schema.episodes)
      .where(eq(schema.episodes.dramaId, body.drama_id))
      .orderBy(schema.episodes.episodeNumber)
    const nextNum = existing.length ? Math.max(...existing.map(e => e.episodeNumber)) + 1 : 1

    try {
      const res = await db.insert(schema.episodes).values({
        dramaId: body.drama_id,
        episodeNumber: nextNum,
        title: body.title || `第${nextNum}集`,
        imageConfigId,
        videoConfigId,
        // 视频分辨率在创建集时固定（480p/720p），后续可通过 PUT 修改
        resolution: body.resolution === '480p' ? '480p' : '720p',
        createdAt: ts,
        updatedAt: ts,
      })

      const [ep] = await db.select().from(schema.episodes)
        .where(eq(schema.episodes.id, getInsertId(res)))
      return success(c, {
        id: ep.id,
        episode_number: ep.episodeNumber,
        title: ep.title,
        image_config_id: ep.imageConfigId,
        video_config_id: ep.videoConfigId,
        resolution: ep.resolution,
      })
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY' && attempt < MAX_NUM_RETRIES) continue
      throw err
    }
  }
})

// PUT /episodes/:id - Update episode fields
app.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json()

  const allowed = ['content', 'script_content', 'title', 'description', 'status', 'resolution']
  const updates: Record<string, any> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) return badRequest(c, 'no valid fields')
  if ('title' in updates && String(updates.title).trim().length > 200) return badRequest(c, '剧集标题不能超过 200 字')
  if ('content' in updates && String(updates.content || '').length > 250_000) return badRequest(c, '剧集原文不能超过 25 万字')
  if ('description' in updates && String(updates.description || '').length > 4000) return badRequest(c, '剧集摘要不能超过 4000 字')
  if ('resolution' in updates && !['480p', '720p'].includes(updates.resolution)) {
    return badRequest(c, 'resolution 只支持 480p / 720p')
  }

  // Map snake_case to camelCase for drizzle
  const drizzleUpdates: Record<string, any> = { updatedAt: now() }
  if ('content' in updates) drizzleUpdates.content = updates.content
  if ('script_content' in updates) drizzleUpdates.scriptContent = updates.script_content
  if ('title' in updates) drizzleUpdates.title = updates.title
  if ('description' in updates) drizzleUpdates.description = updates.description
  if ('status' in updates) drizzleUpdates.status = updates.status
  if ('resolution' in updates) drizzleUpdates.resolution = updates.resolution

  await db.update(schema.episodes).set(drizzleUpdates).where(eq(schema.episodes.id, id))
  return success(c)
})

// DELETE /episodes/:id - Soft delete episode（其分镜/生成记录保留但不可达）
app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [ep] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, id))
  if (!ep) return notFound(c, '剧集不存在')
  await db.update(schema.episodes).set({ deletedAt: now(), updatedAt: now() })
    .where(eq(schema.episodes.id, id))
  return success(c)
})

// GET /episodes/:id/characters — characters linked to this episode（inArray 下推）
app.get('/:id/characters', async (c) => {
  const episodeId = Number(c.req.param('id'))
  const links = await db.select().from(schema.episodeCharacters)
    .where(eq(schema.episodeCharacters.episodeId, episodeId))
  const charIds = links.map(l => l.characterId)
  if (!charIds.length) return success(c, [])
  const result = await db.select().from(schema.characters)
    .where(and(inArray(schema.characters.id, charIds), isNull(schema.characters.deletedAt)))
  return success(c, toSnakeCaseArray(result))
})

// GET /episodes/:id/scenes — scenes linked to this episode（inArray 下推）
app.get('/:id/scenes', async (c) => {
  const episodeId = Number(c.req.param('id'))
  const links = await db.select().from(schema.episodeScenes)
    .where(eq(schema.episodeScenes.episodeId, episodeId))
  const sceneIds = links.map(l => l.sceneId)
  if (!sceneIds.length) return success(c, [])
  const result = await db.select().from(schema.scenes)
    .where(and(inArray(schema.scenes.id, sceneIds), isNull(schema.scenes.deletedAt)))
  return success(c, toSnakeCaseArray(result))
})

// GET /episodes/:id/props — props linked to this episode（inArray 下推）
app.get('/:id/props', async (c) => {
  const episodeId = Number(c.req.param('id'))
  const links = await db.select().from(schema.episodeProps)
    .where(eq(schema.episodeProps.episodeId, episodeId))
  const propIds = links.map(l => l.propId)
  if (!propIds.length) return success(c, [])
  const result = await db.select().from(schema.props)
    .where(and(inArray(schema.props.id, propIds), isNull(schema.props.deletedAt)))
  return success(c, toSnakeCaseArray(result))
})

// POST /episodes/:id/extract — 异步提取资产（target: characters | scenes | props），立即返回，前端轮询状态
app.post('/:id/extract', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const target = body.target as ExtractTarget
  if (!EXTRACT_TARGETS.includes(target)) return badRequest(c, 'target 必须是 characters / scenes / props')
  const [ep] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, id))
  if (!ep) return notFound(c, '剧集不存在')
  const started = startExtraction(ep.id, ep.dramaId, target, { model: body.model || undefined, configId: body.config_id ?? undefined })
  return success(c, { target, status: 'running', already_running: !started })
})

// GET /episodes/:id/extract-status — 查询三类资产提取任务状态
app.get('/:id/extract-status', async (c) => {
  const id = Number(c.req.param('id'))
  return success(c, getExtractionStatus(id))
})

// POST /episodes/:id/generate-video-prompts — 异步批量为缺少视频提示词的分镜生成（立即返回，前端轮询状态）
app.post('/:id/generate-video-prompts', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const [ep] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, id))
  if (!ep) return notFound(c, '剧集不存在')
  const storyboardIds = Array.isArray(body.storyboard_ids)
    ? body.storyboard_ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
    : undefined
  const result = await startVideoPromptBatch(ep.id, ep.dramaId, { model: body.model || undefined, configId: body.config_id ?? undefined }, storyboardIds)
  if (result.total === -1) return success(c, { status: 'running', already_running: true })
  if (!result.started) return success(c, { status: 'idle', total: 0 })
  return success(c, { status: 'running', total: result.total })
})

// GET /episodes/:id/video-prompts-status — 查询批量视频提示词任务状态
app.get('/:id/video-prompts-status', async (c) => {
  const id = Number(c.req.param('id'))
  return success(c, getVideoPromptBatchStatus(id))
})

// GET /episodes/:episode_id/storyboards（链接表与角色/道具查询全部 inArray 下推）
app.get('/:episode_id/storyboards', async (c) => {
  const episodeId = Number(c.req.param('episode_id'))
  const rows = await db.select().from(schema.storyboards)
    .where(eq(schema.storyboards.episodeId, episodeId))
    .orderBy(schema.storyboards.storyboardNumber)
  const storyboardIds = rows.map(row => row.id)

  const [links, propLinks]: [
    typeof schema.storyboardCharacters.$inferSelect[],
    typeof schema.storyboardProps.$inferSelect[],
  ] = storyboardIds.length
    ? await Promise.all([
        db.select().from(schema.storyboardCharacters)
          .where(inArray(schema.storyboardCharacters.storyboardId, storyboardIds)),
        db.select().from(schema.storyboardProps)
          .where(inArray(schema.storyboardProps.storyboardId, storyboardIds)),
      ])
    : [[], []]
  const charIdsByStoryboard = new Map<number, number[]>()
  for (const link of links) {
    const arr = charIdsByStoryboard.get(link.storyboardId) || []
    arr.push(link.characterId)
    charIdsByStoryboard.set(link.storyboardId, arr)
  }

  const propIdsByStoryboard = new Map<number, number[]>()
  for (const link of propLinks) {
    const arr = propIdsByStoryboard.get(link.storyboardId) || []
    arr.push(link.propId)
    propIdsByStoryboard.set(link.storyboardId, arr)
  }

  const episodeCharLinks = await db.select().from(schema.episodeCharacters)
    .where(eq(schema.episodeCharacters.episodeId, episodeId))
  const episodeCharIds = episodeCharLinks.map(link => link.characterId)
  const allChars = episodeCharIds.length
    ? await db.select().from(schema.characters)
        .where(and(inArray(schema.characters.id, episodeCharIds), isNull(schema.characters.deletedAt)))
    : []

  const episodePropLinks = await db.select().from(schema.episodeProps)
    .where(eq(schema.episodeProps.episodeId, episodeId))
  const episodePropIds = episodePropLinks.map(link => link.propId)
  const allProps = episodePropIds.length
    ? await db.select().from(schema.props)
        .where(and(inArray(schema.props.id, episodePropIds), isNull(schema.props.deletedAt)))
    : []

  return success(c, rows.map((row) => ({
    ...toSnakeCase(row),
    character_ids: charIdsByStoryboard.get(row.id) || [],
    prop_ids: propIdsByStoryboard.get(row.id) || [],
    characters: allChars
      .filter(ch => (charIdsByStoryboard.get(row.id) || []).includes(ch.id))
      .map(ch => toSnakeCase(ch)),
    props: allProps
      .filter(p => (propIdsByStoryboard.get(row.id) || []).includes(p.id))
      .map(p => toSnakeCase(p)),
  })))
})

// GET /episodes/:id/pipeline-status — 流水线进度
// GET /episodes/:id/generation-tasks — 按集聚合 sys_task + video_merges
// sys_task 无 episode_id,通过 storyboard/scene/character/prop 关联键归属到当前集
app.get('/:id/generation-tasks', async (c) => {
  const episodeId = Number(c.req.param('id'))
  const [ep] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, episodeId))
  if (!ep) return notFound(c, 'Episode not found')

  const sbs = await db.select().from(schema.storyboards).where(eq(schema.storyboards.episodeId, episodeId))
  const storyboardIds = sbs.map(s => s.id)

  const epScenes = await db.select().from(schema.episodeScenes).where(eq(schema.episodeScenes.episodeId, episodeId))
  const sceneIdSet = new Set(epScenes.map(r => r.sceneId))
  // 兼容 scenes.episodeId 直挂的旧数据
  const directScenes = await db.select().from(schema.scenes).where(eq(schema.scenes.episodeId, episodeId))
  directScenes.forEach(s => sceneIdSet.add(s.id))
  const sceneIds = [...sceneIdSet]

  const epChars = await db.select().from(schema.episodeCharacters).where(eq(schema.episodeCharacters.episodeId, episodeId))
  const characterIds = epChars.map(r => r.characterId)

  const dramaProps = await db.select().from(schema.props).where(eq(schema.props.dramaId, ep.dramaId))
  const propIds = dramaProps.map(p => p.id)

  // 关联键过滤下推 SQL：storyboard/scene/character/prop 任一命中即归属本集
  const orConds = [
    ...(storyboardIds.length ? [inArray(schema.sysTask.storyboardId, storyboardIds)] : []),
    ...(sceneIds.length ? [inArray(schema.sysTask.sceneId, sceneIds)] : []),
    ...(characterIds.length ? [inArray(schema.sysTask.characterId, characterIds)] : []),
    ...(propIds.length ? [inArray(schema.sysTask.propId, propIds)] : []),
  ]
  const tasks = orConds.length
    ? await db.select().from(schema.sysTask)
        .where(and(eq(schema.sysTask.dramaId, ep.dramaId), or(...orConds)))
        .orderBy(desc(schema.sysTask.createdAt))
    : []

  const merges = await db.select().from(schema.videoMerges)
    .where(and(eq(schema.videoMerges.episodeId, episodeId), isNull(schema.videoMerges.deletedAt)))
    .orderBy(desc(schema.videoMerges.createdAt))
    .limit(20)

  return success(c, {
    tasks: toSnakeCaseArray(tasks),
    merges: toSnakeCaseArray(merges),
  })
})

app.get('/:id/pipeline-status', async (c) => {
  const episodeId = Number(c.req.param('id'))
  const [ep] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, episodeId))
  if (!ep) return notFound(c, 'Episode not found')

  const chars = await db.select().from(schema.characters).where(eq(schema.characters.dramaId, ep.dramaId))
  const scenes = await db.select().from(schema.scenes).where(eq(schema.scenes.dramaId, ep.dramaId))
  const sbs = await db.select().from(schema.storyboards).where(eq(schema.storyboards.episodeId, episodeId))
  const merges = await db.select().from(schema.videoMerges).where(eq(schema.videoMerges.episodeId, episodeId))

  const sbsWithImage = sbs.filter(s => s.composedImage)
  const sbsWithVideo = sbs.filter(s => s.videoUrl)
  const latestMerge = merges[merges.length - 1]

  function stepStatus(done: boolean, partial?: boolean) {
    if (done) return 'done'
    if (partial) return 'partial'
    return 'pending'
  }

  return success(c, {
    episode_id: episodeId,
    steps: {
      script_rewrite: { status: ep.scriptContent ? 'done' : (ep.content ? 'ready' : 'pending') },
      extract_characters: { status: stepStatus(chars.length > 0), count: chars.length },
      extract_scenes: { status: stepStatus(scenes.length > 0), count: scenes.length },
      extract_storyboards: { status: stepStatus(sbs.length > 0), count: sbs.length },
      generate_images: { status: stepStatus(sbsWithImage.length === sbs.length && sbs.length > 0, sbsWithImage.length > 0), completed: sbsWithImage.length, total: sbs.length },
      generate_videos: { status: stepStatus(sbsWithVideo.length === sbs.length && sbs.length > 0, sbsWithVideo.length > 0), completed: sbsWithVideo.length, total: sbs.length },
      merge_episode: { status: latestMerge?.status === 'completed' ? 'done' : (latestMerge ? latestMerge.status : 'pending'), merged_url: latestMerge?.mergedUrl },
    },
  })
})

export default app
