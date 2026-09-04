import { Hono } from 'hono'
import { and, count, desc, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, created, badRequest } from '../utils/response.js'
import { generateImage, generateVideo, type VideoReferenceSnapshot } from '../services/generation.js'
import { verifyH3PromptFreshness } from '../services/h3-source.js'
import { logTaskError, logTaskPayload, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'

const app = new Hono()

type TaskType = 'image' | 'video'

/**
 * 归一化前端提交的参考素材快照。
 * 只保留可序列化的字符串数组与时间戳，其余字段一律丢弃，
 * 避免把整个前端状态对象写进任务参数。
 */
function normalizeReferenceSnapshot(raw: unknown): VideoReferenceSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const urls = (value: unknown, limit: number) => Array.isArray(value)
    ? value.map(item => String(item ?? '').trim()).filter(Boolean).slice(0, limit)
    : []
  return {
    images: urls(source.images, 9),
    videos: urls(source.videos, 3),
    audios: urls(source.audios, 3),
    // 额外参考图单独记录：reference_image_urls 混入了场景/角色/道具图，
    // H3 一致性校验只能比对该字段
    extra_images: urls(source.extra_images, 9),
    generated_at: typeof source.generated_at === 'string' && source.generated_at
      ? source.generated_at
      : new Date().toISOString(),
  }
}

// POST /tasks — 发起生成任务（body.type: image | video）
app.post('/', async (c) => {
  const body = await c.req.json()
  const type = body.type as TaskType
  if (type !== 'image' && type !== 'video') return badRequest(c, 'type 必须为 image 或 video')

  if (type === 'image') {
    if (!body.prompt) return badRequest(c, 'prompt is required')
  } else {
    // 视频生成只保留多模态参考：校验素材上限与必填项
    const imgs = body.reference_image_urls?.length || 0
    const vids = body.reference_video_urls?.length || 0
    const auds = body.reference_audio_urls?.length || 0
    if (imgs > 9 || vids > 3 || auds > 3) {
      return badRequest(c, '参考素材超限：图片≤9、视频≤3、音频≤3')
    }
    if (auds > 0 && imgs + vids === 0) {
      return badRequest(c, '参考音频需要至少 1 个参考图片或视频')
    }
    if (imgs + vids + auds === 0 && !body.prompt) {
      return badRequest(c, '多模态参考模式需要至少一个参考素材或 prompt')
    }
  }

  try {
    // 集锁定的生成配置优先于请求指定；视频分辨率同样锁定到集
    let configId: number | undefined = body.config_id
    let episodeResolution: string | undefined
    if (body.storyboard_id) {
      const [sb] = await db.select().from(schema.storyboards).where(eq(schema.storyboards.id, Number(body.storyboard_id)))
      if (sb) {
        const [ep] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, sb.episodeId))
        const locked = type === 'image' ? ep?.imageConfigId : ep?.videoConfigId
        if (locked != null) configId = locked
        if (type === 'video' && ep?.resolution) episodeResolution = ep.resolution
      }
    }

    // 服务端兜底：提交的 prompt 若就是该分镜已保存的 H3 提示词，
    // 必须确认来源指纹仍然新鲜，且本次请求的参考素材与 H3 生成时一致。
    // 前端「已过期」提示可被绕过（直接调 API），这里在提交瞬间重算做最终裁决。
    // 校验只比较实际的 reference_*_urls，不信任 reference_snapshot：
    // 调用者可在快照里填正确值、实际生成数组里放另一套素材，快照仅用于落库追溯。
    if (type === 'video' && body.storyboard_id) {
      const h3Error = await verifyH3PromptFreshness(
        Number(body.storyboard_id),
        body.prompt,
        {
          images: body.reference_image_urls,
          videos: body.reference_video_urls,
          audios: body.reference_audio_urls,
        },
      )
      if (h3Error) return badRequest(c, h3Error)
    }

    logTaskStart('TaskAPI', 'generate', {
      type,
      storyboardId: body.storyboard_id,
      sceneId: body.scene_id,
      characterId: body.character_id,
      dramaId: body.drama_id,
    })
    logTaskPayload('TaskAPI', 'request body', body)

    const id = type === 'image'
      ? await generateImage({
        storyboardId: body.storyboard_id,
        dramaId: body.drama_id,
        sceneId: body.scene_id,
        characterId: body.character_id,
        prompt: body.prompt,
        model: body.model,
        size: body.size,
        referenceImages: body.reference_images,
        frameType: body.frame_type,
        configId,
      })
      : await generateVideo({
        storyboardId: body.storyboard_id,
        dramaId: body.drama_id,
        prompt: body.prompt,
        model: body.model,
        referenceMode: 'reference',
        referenceImageUrls: body.reference_image_urls,
        referenceVideoUrls: body.reference_video_urls,
        referenceAudioUrls: body.reference_audio_urls,
        referenceSnapshot: normalizeReferenceSnapshot(body.reference_snapshot),
        generateAudio: body.generate_audio,
        duration: body.duration,
        aspectRatio: body.aspect_ratio,
        resolution: episodeResolution || body.resolution,
        configId,
      })

    const [record] = await db.select().from(schema.sysTask)
      .where(eq(schema.sysTask.id, id))
    logTaskSuccess('TaskAPI', 'generate', { taskId: id, type, provider: record?.provider })
    return created(c, record)
  } catch (err: any) {
    logTaskError('TaskAPI', 'generate', { type, error: err.message })
    return badRequest(c, err.message)
  }
})

// GET /tasks/stats — 成功率统计（必须注册在 /:id 之前）
app.get('/stats', async (c) => {
  const rows = await db.select({
    type: schema.sysTask.type,
    provider: schema.sysTask.provider,
    status: schema.sysTask.status,
    value: count(),
  })
    .from(schema.sysTask)
    .groupBy(schema.sysTask.type, schema.sysTask.provider, schema.sysTask.status)

  interface Bucket { total: number; completed: number; failed: number; processing: number; success_rate: number }
  const empty = (): Bucket => ({ total: 0, completed: 0, failed: 0, processing: 0, success_rate: 0 })
  const add = (bucket: Bucket, status: string | null, n: number) => {
    bucket.total += n
    if (status === 'completed') bucket.completed += n
    else if (status === 'failed') bucket.failed += n
    else bucket.processing += n
    bucket.success_rate = bucket.total ? Math.round((bucket.completed / bucket.total) * 1000) / 10 : 0
  }

  const overall = empty()
  const byType = new Map<string, Bucket>()
  const byProvider = new Map<string, Bucket>()
  const byTypeProvider = new Map<string, Bucket>()

  for (const row of rows) {
    const n = Number(row.value)
    const type = row.type || 'unknown'
    const provider = row.provider || 'unknown'
    add(overall, row.status, n)
    add(byType.get(type) || byType.set(type, empty()).get(type)!, row.status, n)
    add(byProvider.get(provider) || byProvider.set(provider, empty()).get(provider)!, row.status, n)
    const tp = `${type}/${provider}`
    add(byTypeProvider.get(tp) || byTypeProvider.set(tp, empty()).get(tp)!, row.status, n)
  }

  return success(c, {
    overall,
    by_type: [...byType.entries()].map(([type, bucket]) => ({ type, ...bucket })),
    by_provider: [...byProvider.entries()].map(([provider, bucket]) => ({ provider, ...bucket })),
    by_type_provider: [...byTypeProvider.entries()].map(([key, bucket]) => {
      const [type, provider] = key.split('/')
      return { type, provider, ...bucket }
    }),
  })
})

// GET /tasks/:id — 轮询任务状态
app.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [row] = await db.select().from(schema.sysTask)
    .where(eq(schema.sysTask.id, id))
  return success(c, row || null)
})

// GET /tasks — 按 type / storyboard_id / drama_id 过滤（条件下推 SQL，避免全表内存过滤）
// 过滤/排序/分页全部 SQL 下推；返回 { items, pagination }，items 字段沿用 camelCase（与 GET /tasks/:id 一致）
app.get('/', async (c) => {
  const type = c.req.query('type')
  const storyboardId = c.req.query('storyboard_id')
  const dramaId = c.req.query('drama_id')
  // 兼容旧契约：只有显式传入 page / page_size 任一参数才启用分页并返回 { items, pagination }；
  // 未传分页参数时维持旧行为——返回过滤后的全量数组，避免旧脚本/第三方调用静默截断
  const paginated = c.req.query('page') != null || c.req.query('page_size') != null
  // parseInt + `|| 默认值` 兜底：Number('abc') 得 NaN，Math.max(1, NaN) 会传播 NaN 进 SQL
  const page = Math.max(1, Number.parseInt(c.req.query('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(c.req.query('page_size') || '20', 10) || 20))

  const conds = []
  if (type) conds.push(eq(schema.sysTask.type, type))
  if (storyboardId) conds.push(eq(schema.sysTask.storyboardId, Number(storyboardId)))
  if (dramaId) conds.push(eq(schema.sysTask.dramaId, Number(dramaId)))
  // 条件为空时 .where(undefined) 合法（条件被忽略），count 与 rows 共用同一 where，与 assets.ts 风格统一
  const where = conds.length ? and(...conds) : undefined

  if (!paginated) {
    // 旧契约：过滤/排序仍 SQL 下推，但不分页（无 limit/offset），返回全量数组
    const rows = await db.select().from(schema.sysTask)
      .where(where)
      .orderBy(desc(schema.sysTask.createdAt))
    return success(c, rows)
  }

  const total = (await db.select({ value: count() }).from(schema.sysTask).where(where))[0]?.value ?? 0
  const rows = await db.select().from(schema.sysTask)
    .where(where)
    .orderBy(desc(schema.sysTask.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return success(c, {
    items: rows,
    pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) },
  })
})

// DELETE /tasks/:id
app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await db.delete(schema.sysTask).where(eq(schema.sysTask.id, id))
  return success(c)
})

export default app
