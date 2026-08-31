import { Hono } from 'hono'
import { asc, eq } from 'drizzle-orm'
import { db, getInsertId, schema } from '../db/index.js'
import { success, created, now, badRequest } from '../utils/response.js'
import { toSnakeCase } from '../utils/transform.js'
import { collectH3SourceHash } from '../services/h3-source.js'
import { logTaskPayload, logTaskProgress, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'

const app = new Hono()

// 单类参考素材上限，与视频生成接口 / 上游厂商能力保持一致
const REFERENCE_MEDIA_LIMITS: Record<string, number> = { image: 9, video: 3, audio: 3 }
const REFERENCE_MEDIA_LABELS: Record<string, string> = { image: '图片', video: '视频', audio: '音频' }
const REFERENCE_TOTAL_LIMIT = 15

const referenceLimitMessage = () => Object.keys(REFERENCE_MEDIA_LIMITS)
  .map(type => `${REFERENCE_MEDIA_LABELS[type]}≤${REFERENCE_MEDIA_LIMITS[type]}`)
  .join('、')

// 持久化分镜的视频参考素材选择；上传素材本体仍由 assets 表管理。
app.get('/:id/reference-assets', async (c) => {
  const storyboardId = Number(c.req.param('id'))
  const rows = await db.select().from(schema.storyboardReferenceAssets)
    .where(eq(schema.storyboardReferenceAssets.storyboardId, storyboardId))
    .orderBy(asc(schema.storyboardReferenceAssets.sortOrder))
  return success(c, rows.map(toSnakeCase))
})

app.put('/:id/reference-assets', async (c) => {
  const storyboardId = Number(c.req.param('id'))
  if (!Number.isFinite(storyboardId)) return badRequest(c, '镜头 ID 无效')
  const [storyboard] = await db.select().from(schema.storyboards).where(eq(schema.storyboards.id, storyboardId))
  if (!storyboard) return badRequest(c, '镜头不存在')

  const body = await c.req.json().catch(() => ({}))
  const items = Array.isArray(body.items) ? body.items : []
  const validTypes = new Set(Object.keys(REFERENCE_MEDIA_LIMITS))
  const ts = now()
  const counts: Record<string, number> = { image: 0, video: 0, audio: 0 }
  const normalized: (typeof schema.storyboardReferenceAssets.$inferInsert)[] = []

  for (const item of items) {
    const mediaType = String(item?.media_type || '').toLowerCase()
    if (!validTypes.has(mediaType)) continue
    const url = String(item?.url || '').trim()
    if (!url) continue
    if (counts[mediaType] >= REFERENCE_MEDIA_LIMITS[mediaType]) {
      return badRequest(c, `参考素材超限：${referenceLimitMessage()}`)
    }
    counts[mediaType] += 1
    const assetId = Number(item?.asset_id)
    normalized.push({
      storyboardId,
      assetId: item?.asset_id == null || Number.isNaN(assetId) ? null : assetId,
      mediaType,
      // 列宽 32，超出会被 MySQL 拒绝，这里直接截断而不是让整批保存失败
      mediaRole: String(item?.media_role || 'reference').slice(0, 32),
      url,
      sortOrder: normalized.length,
      createdAt: ts,
      updatedAt: ts,
    })
  }

  // 总量兜底：单类上限 9+3+3 之和已等于总量，此检查是防御性约束，
  // 一旦任一上限被调松，超量保存必须显式报错而不是静默截断。
  if (normalized.length > REFERENCE_TOTAL_LIMIT) {
    return badRequest(c, `参考素材总数超过上限 ${REFERENCE_TOTAL_LIMIT}，请删减后再保存`)
  }

  // 失效判断必须基于内容而不是「收到一次保存请求」：
  // 页面刷新、切换分镜恢复状态时，前端会用同一份内容重复提交，
  // 无条件清空会让刚生成的 H3 提示词立刻被判为过期。
  const beforeHash = await collectH3SourceHash(storyboard)

  // 整表替换放在一个事务里：插入中途失败会回滚，不会留下半套或空记录
  try {
    await db.transaction(async (tx) => {
      await tx.delete(schema.storyboardReferenceAssets)
        .where(eq(schema.storyboardReferenceAssets.storyboardId, storyboardId))
      for (const item of normalized) await tx.insert(schema.storyboardReferenceAssets).values(item)
    })
  } catch (err) {
    return badRequest(c, `参考素材保存失败：${(err as Error).message}`)
  }

  const [refreshed] = await db.select().from(schema.storyboards)
    .where(eq(schema.storyboards.id, storyboardId))
  const afterHash = refreshed ? await collectH3SourceHash(refreshed) : beforeHash
  if (afterHash !== beforeHash) {
    await db.update(schema.storyboards)
      .set({ minimaxH3SourceHash: null, minimaxH3GeneratedAt: null, updatedAt: now() })
      .where(eq(schema.storyboards.id, storyboardId))
    logTaskProgress('StoryboardAPI', 'h3-invalidated', { storyboardId, reason: 'reference-assets-changed' })
  }

  logTaskProgress('StoryboardAPI', 'reference-assets-saved', {
    storyboardId,
    image: counts.image,
    video: counts.video,
    audio: counts.audio,
    h3Invalidated: afterHash !== beforeHash,
  })
  return success(c, normalized.map(toSnakeCase))
})

async function syncStoryboardCharacters(storyboardId: number, characterIds: number[]) {
  await db.delete(schema.storyboardCharacters)
    .where(eq(schema.storyboardCharacters.storyboardId, storyboardId))


  const uniqueIds = [...new Set((characterIds || []).filter(Boolean))]
  if (!uniqueIds.length) return

  for (const characterId of uniqueIds) {
    await db.insert(schema.storyboardCharacters).values({
      storyboardId,
      characterId,
    })
  }
}

async function getStoryboardCharacterIds(storyboardId: number) {
  const links = await db.select().from(schema.storyboardCharacters)
    .where(eq(schema.storyboardCharacters.storyboardId, storyboardId))
  return links.map(link => link.characterId)
}

async function syncStoryboardProps(storyboardId: number, propIds: number[]) {
  await db.delete(schema.storyboardProps)
    .where(eq(schema.storyboardProps.storyboardId, storyboardId))

  const uniqueIds = [...new Set((propIds || []).filter(Boolean))]
  if (!uniqueIds.length) return

  for (const propId of uniqueIds) {
    await db.insert(schema.storyboardProps).values({
      storyboardId,
      propId,
    })
  }
}

async function getStoryboardPropIds(storyboardId: number) {
  const links = await db.select().from(schema.storyboardProps)
    .where(eq(schema.storyboardProps.storyboardId, storyboardId))
  return links.map(link => link.propId)
}

async function validateStoryboardBindings(episodeId: number, sceneId: number | null | undefined, characterIds: number[] | undefined, propIds?: number[] | undefined) {
  const sceneLinks = await db.select().from(schema.episodeScenes)
    .where(eq(schema.episodeScenes.episodeId, episodeId))
  const episodeSceneIds = new Set(sceneLinks.map(link => link.sceneId))
  const characterLinks = await db.select().from(schema.episodeCharacters)
    .where(eq(schema.episodeCharacters.episodeId, episodeId))
  const episodeCharacterIds = new Set(characterLinks.map(link => link.characterId))
  const propLinks = await db.select().from(schema.episodeProps)
    .where(eq(schema.episodeProps.episodeId, episodeId))
  const episodePropIds = new Set(propLinks.map(link => link.propId))

  if (sceneId != null && !episodeSceneIds.has(sceneId)) {
    throw new Error('scene_id 必须来自当前集已关联场景')
  }

  const invalidCharacterIds = (characterIds || []).filter(id => !episodeCharacterIds.has(id))
  if (invalidCharacterIds.length) {
    throw new Error('character_ids 必须来自当前集已关联角色')
  }

  const invalidPropIds = (propIds || []).filter(id => !episodePropIds.has(id))
  if (invalidPropIds.length) {
    throw new Error('prop_ids 必须来自当前集已关联道具')
  }
}

// POST /storyboards
app.post('/', async (c) => {
  const body = await c.req.json()
  const ts = now()
  logTaskStart('StoryboardAPI', 'create', {
    episodeId: body.episode_id,
    shotNumber: body.storyboard_number || 1,
    sceneId: body.scene_id,
    characterIds: body.character_ids,
  })
  logTaskPayload('StoryboardAPI', 'create body', body)
  await validateStoryboardBindings(body.episode_id, body.scene_id, body.character_ids, body.prop_ids)
  const res = await db.insert(schema.storyboards).values({
    episodeId: body.episode_id,
    storyboardNumber: body.storyboard_number || 1,
    title: body.title,
    description: body.description,
    sceneId: body.scene_id,
    duration: body.duration || 10,
    createdAt: ts,
    updatedAt: ts,
  })
  await syncStoryboardCharacters(getInsertId(res), body.character_ids || [])
  await syncStoryboardProps(getInsertId(res), body.prop_ids || [])
  const [result] = await db.select().from(schema.storyboards)
    .where(eq(schema.storyboards.id, getInsertId(res)))
  logTaskSuccess('StoryboardAPI', 'create', {
    storyboardId: result.id,
    episodeId: result.episodeId,
    shotNumber: result.storyboardNumber,
  })
  return created(c, {
    ...toSnakeCase(result),
    character_ids: await getStoryboardCharacterIds(result.id),
    prop_ids: await getStoryboardPropIds(result.id),
  })
})

// PUT /storyboards/:id
app.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const [storyboard] = await db.select().from(schema.storyboards).where(eq(schema.storyboards.id, id))
  if (!storyboard) return badRequest(c, '镜头不存在')
  logTaskStart('StoryboardAPI', 'update', {
    storyboardId: id,
    episodeId: storyboard.episodeId,
    fields: Object.keys(body),
  })
  logTaskPayload('StoryboardAPI', 'update body', body)

  const fieldMap: Record<string, string> = {
    title: 'title', description: 'description', shot_type: 'shotType',
    angle: 'angle', movement: 'movement', duration: 'duration',
    video_prompt: 'videoPrompt',
    minimax_h3_prompt: 'minimaxH3Prompt',
    image_prompt: 'imagePrompt', scene_id: 'sceneId', location: 'location',
    time: 'time', atmosphere: 'atmosphere', result: 'result',
    bgm_prompt: 'bgmPrompt', sound_effect: 'soundEffect',
    video_url: 'videoUrl',
  }

  const updates: Record<string, any> = { updatedAt: now() }
  for (const [snakeKey, camelKey] of Object.entries(fieldMap)) {
    if (snakeKey in body) updates[camelKey] = body[snakeKey]
  }

  // H3 提示词派生自来源输入，只有来源真正变化时才失效。
  // 这里不按「请求里带了哪些字段」判断：前端回写相同内容、或只写 minimax_h3_prompt
  // 都不应清空来源指纹，否则刚生成的 H3 会立刻被判为过期。
  const beforeHash = await collectH3SourceHash(storyboard)

  await validateStoryboardBindings(
    storyboard.episodeId,
    'scene_id' in body ? body.scene_id : storyboard.sceneId,
    'character_ids' in body ? body.character_ids : await getStoryboardCharacterIds(id),
    'prop_ids' in body ? body.prop_ids : await getStoryboardPropIds(id),
  )

  await db.update(schema.storyboards).set(updates).where(eq(schema.storyboards.id, id))
  if ('character_ids' in body) await syncStoryboardCharacters(id, body.character_ids || [])
  if ('prop_ids' in body) await syncStoryboardProps(id, body.prop_ids || [])

  const [updated] = await db.select().from(schema.storyboards).where(eq(schema.storyboards.id, id))
  if (updated) {
    const afterHash = await collectH3SourceHash(updated)
    if (afterHash !== beforeHash) {
      await db.update(schema.storyboards)
        .set({ minimaxH3SourceHash: null, minimaxH3GeneratedAt: null })
        .where(eq(schema.storyboards.id, id))
      logTaskProgress('StoryboardAPI', 'h3-invalidated', { storyboardId: id, reason: 'storyboard-source-changed' })
    }
  }

  logTaskSuccess('StoryboardAPI', 'update', {
    storyboardId: id,
    updatedFields: Object.keys(updates),
    characterIds: body.character_ids,
    propIds: body.prop_ids,
  })
  return success(c)
})

// DELETE /storyboards/:id
app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  logTaskStart('StoryboardAPI', 'delete', { storyboardId: id })
  // 参考素材随分镜一起清理，避免留下指向已删除分镜的孤儿记录
  try {
    await db.transaction(async (tx) => {
      await tx.delete(schema.storyboardCharacters).where(eq(schema.storyboardCharacters.storyboardId, id))
      await tx.delete(schema.storyboardProps).where(eq(schema.storyboardProps.storyboardId, id))
      await tx.delete(schema.storyboardReferenceAssets).where(eq(schema.storyboardReferenceAssets.storyboardId, id))
      await tx.delete(schema.storyboards).where(eq(schema.storyboards.id, id))
    })
  } catch (err) {
    return badRequest(c, `删除镜头失败：${(err as Error).message}`)
  }
  logTaskSuccess('StoryboardAPI', 'delete', { storyboardId: id })
  return success(c)
})

export default app
