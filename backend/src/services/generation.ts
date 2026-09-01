/**
 * 统一生成任务服务 — 图片/视频生成共用 sys_task 表与同一条生命周期：
 * 创建(processing) → 适配器构建请求 → 同步完成或异步轮询 → 下载落盘 → 回写业务表
 */
import { db, getInsertId, pool, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { getActiveConfig, getActiveConfigWithId, getConfigById } from './ai.js'
import { now } from '../utils/response.js'
import { downloadFile, generateImageThumb, readImageAsCompressedDataUrl, readMediaAsDataUrl, saveBase64Image } from '../utils/storage.js'
import { extractVideoPoster } from '../utils/video-poster.js'
import { getImageAdapter, getVideoAdapter } from './adapters/registry'
import { invalidateH3ForCharacter, invalidateH3ForProp, invalidateH3ForScene, invalidateH3ForStoryboards } from './h3-source.js'
import type { AIConfig } from './adapters/types'
import { logTaskError, logTaskPayload, logTaskProgress, logTaskStart, logTaskSuccess, logTaskWarn, redactUrl } from '../utils/task-logger.js'
import { withRetry } from '../utils/retry.js'
import { videoSlot, imageSlot } from '../utils/concurrency.js'
import { computePollDeadline } from '../utils/task-lifecycle.js'

type TaskType = 'image' | 'video'

const taskLabel = (type: TaskType) => (type === 'image' ? 'ImageTask' : 'VideoTask')

// 所有执行者（正常提交和启动恢复）共用同一租约；不能只在恢复扫描时认领，
// 否则滚动重启会接管仍在运行的任务并造成双轮询/双回写。
const TASK_LEASE_MS = 5 * 60_000
const TASK_LEASE_HEARTBEAT_MS = 60_000

interface TaskLease {
  owner: string
  heartbeat: ReturnType<typeof setInterval>
}

// 轮询节奏：图片 5s×120（上限 10 分钟）；视频 10s×300（全局上限 45 分钟，
// 防止单次轮询超时 10min 时极端情况累积到数十小时）
const POLL_PROFILES: Record<TaskType, { attempts: number; intervalMs: number; maxDurationMs: number | null }> = {
  image: { attempts: 120, intervalMs: 5000, maxDurationMs: 600_000 },
  video: { attempts: 300, intervalMs: 10_000, maxDurationMs: 45 * 60_000 },
}

interface GenerateImageParams {
  storyboardId?: number
  dramaId?: number
  sceneId?: number
  characterId?: number
  propId?: number
  prompt: string
  model?: string
  size?: string
  referenceImages?: string[]
  frameType?: string
  configId?: number
}

/**
 * 视频任务提交瞬间的参考素材快照。
 * 与 params 里的 reference*Urls 分开保存：前者是「这次实际用了什么」的可复盘记录，
 * 后者是适配器真正读取的生成参数。
 */
export interface VideoReferenceSnapshot {
  images: string[]
  videos: string[]
  audios: string[]
  /** 额外参考图（手动选择/上传）：reference_image_urls 混入了场景/角色/道具图 */
  extra_images?: string[]
  generated_at: string
}

interface GenerateVideoParams {
  storyboardId?: number
  dramaId?: number
  prompt: string
  model?: string
  referenceMode?: string
  imageUrl?: string
  firstFrameUrl?: string
  lastFrameUrl?: string
  referenceImageUrls?: string[]
  referenceVideoUrls?: string[]
  referenceAudioUrls?: string[]
  referenceSnapshot?: VideoReferenceSnapshot | null
  generateAudio?: boolean
  duration?: number
  aspectRatio?: string
  resolution?: string
  configId?: number
}

interface ResolvedConfig {
  config: AIConfig
  /** 实际生效的配置 ID：请求指定的有效则用指定，失效/未指定则用当前启用配置 */
  configId: number | null
}

/**
 * 解析任务实际使用的生成配置。
 * 指定配置（集锁定）可能已停用/删除/厂商收敛，失效时回退当前启用配置；
 * 返回「实际生效」的配置 ID，供 createTask 持久化（重启恢复精确找回原配置，
 * 不落回 provider+model 猜测）。
 */
async function resolveConfig(type: 'image' | 'video', requestedConfigId?: number): Promise<ResolvedConfig> {
  if (requestedConfigId) {
    const cfg = await getConfigById(requestedConfigId)
    if (cfg) return { config: cfg, configId: requestedConfigId }
  }
  const active = await getActiveConfigWithId(type)
  if (!active) {
    throw new Error(type === 'image'
      ? '未配置图片模型，请先到「设置」页添加并启用 AI 服务'
      : '未配置视频模型，请先到「设置」页添加并启用 AI 服务')
  }
  return { config: active.config, configId: active.id }
}

export async function generateImage(params: GenerateImageParams): Promise<number> {
  // 指定配置（集锁定）可能已停用/删除/厂商收敛，失效时回退到当前启用配置；configId 为实际生效 ID
  const { config, configId } = await resolveConfig('image', params.configId)

  const id = await createTask('image', config, {
    storyboardId: params.storyboardId,
    dramaId: params.dramaId,
    sceneId: params.sceneId,
    characterId: params.characterId,
    propId: params.propId,
    prompt: params.prompt,
    model: params.model || config.model,
  }, {
    size: params.size || '1920x1080',
    frameType: params.frameType,
    referenceImages: params.referenceImages,
  }, configId)

  logTaskStart('ImageTask', 'enqueue', {
    id,
    provider: config.provider,
    storyboardId: params.storyboardId,
    sceneId: params.sceneId,
    characterId: params.characterId,
    frameType: params.frameType,
    model: params.model || config.model,
  })
  logTaskPayload('ImageTask', 'enqueue params', {
    id,
    config: { provider: config.provider, model: config.model, baseUrl: config.baseUrl },
    params,
  })
  return id
}

export async function generateVideo(params: GenerateVideoParams): Promise<number> {
  // 指定配置（集锁定）可能已停用/删除/厂商收敛，失效时回退到当前启用配置；configId 为实际生效 ID
  const { config, configId } = await resolveConfig('video', params.configId)

  const id = await createTask('video', config, {
    storyboardId: params.storyboardId,
    dramaId: params.dramaId,
    prompt: params.prompt,
    model: params.model || config.model,
  }, {
    referenceMode: params.referenceMode || 'reference',
    imageUrl: params.imageUrl,
    firstFrameUrl: params.firstFrameUrl,
    lastFrameUrl: params.lastFrameUrl,
    referenceImageUrls: params.referenceImageUrls,
    referenceVideoUrls: params.referenceVideoUrls,
    referenceAudioUrls: params.referenceAudioUrls,
    generateAudio: params.generateAudio === false ? 0 : 1,
    duration: params.duration || 5,
    aspectRatio: params.aspectRatio || '16:9',
    // 保留高分辨率档位透传（MiniMax 768P/2K），火山等适配器内部自行归并
    resolution: ['480p', '720p', '1080p', '2K'].includes(params.resolution || '') ? params.resolution : '720p',
    referenceSnapshot: params.referenceSnapshot ?? null,
  }, configId)

  logTaskStart('VideoTask', 'enqueue', {
    id,
    provider: config.provider,
    storyboardId: params.storyboardId,
    dramaId: params.dramaId,
    referenceMode: params.referenceMode || 'reference',
    duration: params.duration || 5,
    hasReferenceSnapshot: !!params.referenceSnapshot,
  })
  logTaskPayload('VideoTask', 'enqueue params', {
    id,
    config: { provider: config.provider, model: config.model, baseUrl: config.baseUrl },
    params,
  })
  return id
}

async function createTask(
  type: TaskType,
  config: AIConfig,
  fields: {
    storyboardId?: number
    dramaId?: number
    sceneId?: number
    characterId?: number
    propId?: number
    prompt: string
    model?: string | null
  },
  params: Record<string, unknown>,
  configId?: number | null,
): Promise<number> {
  const ts = now()
  const res = await db.insert(schema.sysTask).values({
    type,
    ...fields,
    provider: config.provider,
    // 持久化本次实际使用的配置 ID，供重启恢复时精确找回原配置（多同厂商/模型配置不猜错账号）
    params: JSON.stringify({ ...params, configId: configId ?? null }),
    status: 'processing',
    createdAt: ts,
    updatedAt: ts,
  })

  const id = getInsertId(res)
  processTask(id, config).catch(err => {
    logTaskError(taskLabel(type), 'process', { id, error: err.message })
    console.error(`${taskLabel(type)} ${id} failed:`, err)
  })
  return id
}

function parseTaskParams(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) || {}
  } catch {
    return {}
  }
}

async function processTask(id: number, config: AIConfig) {
  const [record] = await db.select().from(schema.sysTask).where(eq(schema.sysTask.id, id))
  if (!record || record.status !== 'processing') return
  const type = record.type as TaskType
  const label = taskLabel(type)
  const slots = type === 'image' ? imageSlot : videoSlot

  // 并发控制：超过厂商配额的生成任务排队等待，防止批量提交打爆 API
  await slots.acquire({ id, type })

  let lease: TaskLease | null = null
  try {
    lease = await acquireTaskLease(id)
    if (!lease) {
      logTaskWarn(label, 'lease-not-acquired', { id })
      return
    }
    // 排队等待期间任务可能已被用户删除（DELETE /tasks/:id 为物理删除）：
    // 拿到槽位后重新查询校验，任务不存在或已非 processing 则放弃执行
    const [fresh] = await db.select().from(schema.sysTask).where(eq(schema.sysTask.id, id))
    if (!fresh || fresh.status !== 'processing') {
      logTaskWarn(label, 'task-not-active-after-queue', { id, status: fresh?.status ?? 'deleted' })
      return
    }
    if (fresh.taskId) {
      // 启动恢复路径：上游任务 ID 可能仍有效，直接续轮询而非重新提交（避免重复扣费）
      logTaskProgress(label, 'resume-poll', { id, taskId: fresh.taskId, provider: config.provider })
      const pollingRecord = await markPolling(fresh, fresh.taskId)
      await pollTask(pollingRecord, config, fresh.taskId)
      return
    }
    await runTask(fresh, config)
  } catch (err: any) {
    logTaskError(label, 'process', { id, error: err.message })
    await failTask(id, err.message)
  } finally {
    if (lease) await releaseTaskLease(id, lease)
    slots.release({ id, type })
  }
}

function newLeaseOwner(id: number): string {
  return `${process.pid}:${id}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
}

async function acquireTaskLease(id: number): Promise<TaskLease | null> {
  const owner = newLeaseOwner(id)
  const claimedAt = Date.now()
  const [res] = await pool.query<any>(
    'UPDATE sys_task SET recovery_at = ?, recovery_owner = ?, updated_at = ? WHERE id = ? AND status = ? AND (recovery_at IS NULL OR recovery_at = \'\' OR CAST(recovery_at AS UNSIGNED) < ?)',
    [String(claimedAt + TASK_LEASE_MS), owner, now(), id, 'processing', claimedAt],
  )
  if ((res?.affectedRows ?? 0) !== 1) return null
  const heartbeat = setInterval(() => {
    refreshTaskLease(id, owner).catch(err => {
      logTaskWarn('SysTask', 'lease-heartbeat-failed', { id, error: err.message })
    })
  }, TASK_LEASE_HEARTBEAT_MS)
  return { owner, heartbeat }
}

async function refreshTaskLease(id: number, owner: string): Promise<void> {
  const until = Date.now() + TASK_LEASE_MS
  await pool.query(
    'UPDATE sys_task SET recovery_at = ?, updated_at = ? WHERE id = ? AND status = ? AND recovery_owner = ?',
    [String(until), now(), id, 'processing', owner],
  )
}

async function releaseTaskLease(id: number, lease: TaskLease): Promise<void> {
  clearInterval(lease.heartbeat)
  await pool.query(
    'UPDATE sys_task SET recovery_at = NULL, recovery_owner = NULL, updated_at = ? WHERE id = ? AND recovery_owner = ?',
    [now(), id, lease.owner],
  ).catch(err => {
    logTaskWarn('SysTask', 'lease-release-failed', { id, error: err.message })
  })
}

/** 任务主体：构建并提交生成请求，处理同步结果或进入轮询 */
async function runTask(record: SysTaskRecord, config: AIConfig) {
  const id = record.id
  const type = record.type as TaskType
  const label = taskLabel(type)
  const params = parseTaskParams(record.params)
  logTaskProgress(label, 'build-request', {
    id,
    provider: config.provider,
    storyboardId: record.storyboardId,
    sceneId: record.sceneId,
    characterId: record.characterId,
  })

  let url: string, method: string, headers: Record<string, string>, body: unknown

    if (type === 'image') {
      const adapter = getImageAdapter(config.provider)
      const resolvedReferenceImages = await normalizeReferenceImages(params.referenceImages)
      ;({ url, method, headers, body } = adapter.buildGenerateRequest(config, {
        id: record.id,
        model: record.model,
        prompt: record.prompt,
        size: params.size,
        frameType: params.frameType,
        referenceImages: resolvedReferenceImages.length ? JSON.stringify(resolvedReferenceImages) : null,
      }))
    } else {
      const adapter = getVideoAdapter(config.provider)
      const resolvedImageUrl = await normalizeVideoReferenceUrl(params.imageUrl)
      const resolvedFirstFrameUrl = await normalizeVideoReferenceUrl(params.firstFrameUrl)
      const resolvedLastFrameUrl = await normalizeVideoReferenceUrl(params.lastFrameUrl)
      const resolvedReferenceImageUrls = await normalizeVideoReferenceUrls(params.referenceImageUrls)
      // 参考视频/音频文件较大，不适合 dataURL 内联，需解析为公网可访问 URL
      const resolvedReferenceVideoUrls = await resolveReferenceMediaUrls(params.referenceVideoUrls, 'video')
      const resolvedReferenceAudioUrls = await resolveReferenceMediaUrls(params.referenceAudioUrls, 'audio')
      ;({ url, method, headers, body } = adapter.buildGenerateRequest(config, {
        id: record.id,
        model: record.model,
        prompt: record.prompt,
        referenceMode: params.referenceMode,
        imageUrl: resolvedImageUrl,
        firstFrameUrl: resolvedFirstFrameUrl,
        lastFrameUrl: resolvedLastFrameUrl,
        referenceImageUrls: resolvedReferenceImageUrls.length ? JSON.stringify(resolvedReferenceImageUrls) : null,
        referenceVideoUrls: resolvedReferenceVideoUrls.length ? JSON.stringify(resolvedReferenceVideoUrls) : null,
        referenceAudioUrls: resolvedReferenceAudioUrls.length ? JSON.stringify(resolvedReferenceAudioUrls) : null,
        generateAudio: params.generateAudio,
        duration: params.duration,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
      }))
    }

    logTaskProgress(label, 'request', {
      id,
      provider: config.provider,
      method,
      url: redactUrl(url),
      model: record.model,
    })
    logTaskPayload(label, 'request payload', { id, method, url, headers, body })

    // 创建请求是付费非幂等操作：不自动重试（厂商已受理但响应丢失时重试会重复扣费），
    // 仅保留超时兜底；网络抖动导致的失败由用户在前端手动重试
    const resp = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(600_000),
    })
    if (!resp.ok) throw new Error(`API error ${resp.status}: ${await resp.text()}`)
    const result = await resp.json() as any
    logTaskPayload(label, 'response payload', { id, provider: config.provider, result })

    if (type === 'image') {
      const adapter = getImageAdapter(config.provider)
      const { isAsync, taskId, imageUrl } = adapter.parseGenerateResponse(result)

      if (!isAsync && imageUrl) {
        logTaskProgress(label, 'sync-complete', { id, imageUrl })
        await handleImageComplete(record, imageUrl)
        return
      }

      if (!isAsync && !imageUrl) {
        // 同步模式但无 URL（Gemini 等返回 base64）
        const b64 = adapter.extractImageBase64(result)
        if (b64) {
          logTaskProgress(label, 'sync-base64-complete', { id, mimeType: b64.mimeType })
          await handleImageCompleteBase64(record, b64.data, b64.mimeType)
          return
        }
        throw new Error('No image URL or base64 data in response')
      }

      const pollingRecord = await markPolling(record, taskId)
      await pollTask(pollingRecord, config, taskId!)
      return
    }

    const adapter = getVideoAdapter(config.provider)
    const { isAsync, taskId, videoUrl } = adapter.parseGenerateResponse(result)

    if (!isAsync && videoUrl) {
      logTaskProgress(label, 'sync-complete', { id, videoUrl })
      await handleVideoComplete(record, videoUrl, params.duration)
      return
    }

    const pollingRecord = await markPolling(record, taskId)
    await pollTask(pollingRecord, config, taskId!)
}

async function markPolling(record: SysTaskRecord, taskId: string | undefined): Promise<SysTaskRecord> {
  const params = parseTaskParams(record.params)
  const deadline = computePollDeadline(params, POLL_PROFILES[record.type as TaskType].maxDurationMs)
  const nextParams = deadline == null ? params : { ...params, pollDeadline: deadline }
  await db.update(schema.sysTask)
    .set({ taskId, params: JSON.stringify(nextParams), status: 'processing', updatedAt: now() })
    .where(eq(schema.sysTask.id, record.id))
  logTaskProgress('SysTask', 'poll-start', { id: record.id, taskId, deadline })
  return { ...record, taskId: taskId ?? null, params: JSON.stringify(nextParams) }
}

async function failTask(id: number, message: string) {
  logTaskError('SysTask', 'failed', { id, error: message })
  await db.update(schema.sysTask)
    .set({ status: 'failed', errorMsg: message, updatedAt: now(), recoveryAt: null, recoveryOwner: null })
    .where(eq(schema.sysTask.id, id))
}

type SysTaskRecord = typeof schema.sysTask.$inferSelect

async function pollTask(record: SysTaskRecord, config: AIConfig, taskId: string) {
  const type = record.type as TaskType
  const label = taskLabel(type)
  const profile = POLL_PROFILES[type]
  const adapter = type === 'image' ? getImageAdapter(config.provider) : getVideoAdapter(config.provider)
  const params = parseTaskParams(record.params)
  // markPolling 已将 deadline 与 taskId 一起原子持久化；恢复的任务只沿用它，
  // 绝不因重启或已过期的 deadline 重新授予新的全局窗口。
  const deadline = computePollDeadline(params, profile.maxDurationMs)

  for (let i = 0; i < profile.attempts; i++) {
    if (deadline && Date.now() >= deadline) {
      await failTask(record.id, `Timeout: Polling exceeded ${Math.round(profile.maxDurationMs! / 60_000)} minutes`)
      return
    }
    await new Promise(r => setTimeout(r, profile.intervalMs))
    if (deadline && Date.now() >= deadline) {
      await failTask(record.id, `Timeout: Polling exceeded ${Math.round(profile.maxDurationMs! / 60_000)} minutes`)
      return
    }
    // completed 分支的下载/回写失败属终态处理错误，标记后直接失败，绝不回到轮询循环
    let completedHandling = false
    try {
      const { url, method, headers } = adapter.buildPollRequest(config, taskId)
      logTaskProgress(label, 'poll-request', {
        id: record.id,
        taskId,
        provider: config.provider,
        method,
        url: redactUrl(url),
        attempt: i + 1,
      })
      // 单次轮询请求：网络错误/5xx/超时内重试 1 次，仍失败则交给外层循环等待下一轮。
      // 每次尝试（含重试的第二次请求）都用最新剩余时间，绝不复用已过期的剩余时间。
      const resp = await withRetry(async () => {
        const remainingNow = deadline ? Math.max(1_000, deadline - Date.now()) : 600_000
        const r = await fetch(url, {
          method,
          headers,
          signal: AbortSignal.timeout(remainingNow),
        })
        if (!r.ok) {
          const err: any = new Error(`poll HTTP ${r.status}`)
          err.status = r.status
          throw err
        }
        return r
      }, { retries: 1, baseDelayMs: 1000, scope: label, action: 'poll-request', meta: { id: record.id, taskId, attempt: i + 1 } })
      const result = await resp.json() as any

      // 图片/视频 PollResponse 结构不同，这里统一按 any 取值后按 type 分支
      const pollResp: any = adapter.parsePollResponse(result)

      if (pollResp.status === 'completed') {
        completedHandling = true
        if (type === 'image') {
          if (pollResp.imageUrl) {
            logTaskSuccess(label, 'poll-complete', { id: record.id, taskId, imageUrl: pollResp.imageUrl })
            await handleImageComplete(record, pollResp.imageUrl)
            return
          }
          if (adapter.provider === 'gemini') {
            // Gemini 可能返回 base64
            const b64 = (adapter as ReturnType<typeof getImageAdapter>).extractImageBase64(result)
            if (b64) {
              logTaskSuccess(label, 'poll-base64-complete', { id: record.id, taskId, mimeType: b64.mimeType })
              await handleImageCompleteBase64(record, b64.data, b64.mimeType)
              return
            }
          }
        } else if (pollResp.videoUrl) {
          logTaskSuccess(label, 'poll-complete', { id: record.id, taskId, videoUrl: pollResp.videoUrl })
          await handleVideoComplete(record, pollResp.videoUrl, null)
          return
        }
        // 上游返回 completed 但缺少结果 URL：立即标记失败，不应继续轮询等待
        await failTask(record.id, '上游已返回 completed 但缺少结果 URL')
        return
      }
      if (pollResp.status === 'failed') {
        // 上游明确失败（如内容审核拦截）属终态：立即落库，不重试不等待超时
        await failTask(record.id, pollResp.error || 'Generation failed')
        return
      }
    } catch (err: any) {
      // 已完成但下载/回写失败：向上抛由 processTask 标记失败，不能继续轮询等待
      if (completedHandling) throw err
      const exhausted = i === profile.attempts - 1
        || (deadline != null && Date.now() >= deadline)
      if (exhausted) {
        await failTask(record.id, `Timeout: ${err.message}`)
        return
      }
      logTaskWarn(label, 'poll-retry', { id: record.id, taskId, attempt: i + 1, error: err.message })
    }
  }
  await failTask(record.id, 'Timeout: polling attempts exhausted')
}

async function handleImageComplete(record: SysTaskRecord, imageUrl: string) {
  const localPath = await downloadFile(imageUrl, 'images', { maxBytes: 50 * 1024 * 1024 })
  // 列表页缩略图（前端按命名约定推导地址，失败不影响主流程）
  await generateImageThumb(localPath)

  await db.update(schema.sysTask)
    .set({ resultUrl: imageUrl, localPath, status: 'completed', completedAt: now(), updatedAt: now(), recoveryAt: null, recoveryOwner: null })
    .where(eq(schema.sysTask.id, record.id))

  logTaskSuccess('ImageTask', 'downloaded', { id: record.id, provider: record.provider, localPath })

  await writeBackImageAssets(record, localPath)
}

async function handleImageCompleteBase64(record: SysTaskRecord, base64Data: string, mimeType: string) {
  const localPath = await saveBase64Image(base64Data, mimeType, 'images')
  await generateImageThumb(localPath)

  await db.update(schema.sysTask)
    .set({ localPath, status: 'completed', completedAt: now(), updatedAt: now(), recoveryAt: null, recoveryOwner: null })
    .where(eq(schema.sysTask.id, record.id))

  logTaskSuccess('ImageTask', 'saved-base64', { id: record.id, provider: record.provider, mimeType, localPath })

  await writeBackImageAssets(record, localPath)
}

// 图片完成后回写业务表：分镜(按 frameType)、角色、场景、道具。
// 回写即「内容被引用的输入变了」：首/尾帧影响 H3 模式判定，角色/场景/道具设定图
// 是 H3 的参考输入，必须主动失效绑定这些资产的分镜 H3，界面才会立即显示过期。
async function writeBackImageAssets(record: SysTaskRecord, localPath: string) {
  const params = parseTaskParams(record.params)
  if (record.storyboardId) {
    const sbUpdate: Record<string, any> = { updatedAt: now() }
    if (params.frameType === 'first_frame') sbUpdate.firstFrameImage = localPath
    else if (params.frameType === 'last_frame') sbUpdate.lastFrameImage = localPath
    else sbUpdate.composedImage = localPath
    await db.update(schema.storyboards).set(sbUpdate).where(eq(schema.storyboards.id, record.storyboardId))
    if (params.frameType === 'first_frame' || params.frameType === 'last_frame') {
      await invalidateH3ForStoryboards([record.storyboardId], `frame-${params.frameType}-generated`)
    }
  }
  if (record.characterId) {
    await db.update(schema.characters).set({ imageUrl: localPath, updatedAt: now() }).where(eq(schema.characters.id, record.characterId))
    await invalidateH3ForCharacter(record.characterId, 'character-image-generated')
  }
  if (record.sceneId) {
    await db.update(schema.scenes).set({ imageUrl: localPath, status: 'completed', updatedAt: now() }).where(eq(schema.scenes.id, record.sceneId))
    await invalidateH3ForScene(record.sceneId, 'scene-image-generated')
  }
  if (record.propId) {
    await db.update(schema.props).set({ imageUrl: localPath, updatedAt: now() }).where(eq(schema.props.id, record.propId))
    await invalidateH3ForProp(record.propId, 'prop-image-generated')
  }
}

async function handleVideoComplete(record: SysTaskRecord, videoUrl: string, duration: number | null | undefined) {
  // 视频下载流式写盘；上限 2GB、单次 10 分钟超时，网络中断自动重试（storage 内部处理）
  const localPath = await downloadFile(videoUrl, 'videos', { maxBytes: 2 * 1024 * 1024 * 1024, timeoutMs: 600_000 })
  // 海报帧供列表/封面展示，避免前端为显示首帧缓冲整个视频
  await extractVideoPoster(localPath)
  await db.update(schema.sysTask)
    .set({ resultUrl: videoUrl, localPath, status: 'completed', completedAt: now(), updatedAt: now(), recoveryAt: null, recoveryOwner: null })
    .where(eq(schema.sysTask.id, record.id))

  logTaskSuccess('VideoTask', 'downloaded', { id: record.id, localPath, storyboardId: record.storyboardId, duration })

  if (record.storyboardId) {
    await db.update(schema.storyboards)
      .set({ videoUrl: localPath, duration: duration || undefined, updatedAt: now() })
      .where(eq(schema.storyboards.id, record.storyboardId))
  }
}

// ─── 参考素材归一化 ───────────────────────────────────────────────

async function normalizeReferenceImages(refs: string[] | null | undefined): Promise<string[]> {
  if (!Array.isArray(refs) || !refs.length) return []

  const deduped = Array.from(
    new Set(
      refs
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  )

  const normalized = await Promise.all(deduped.map(async (value) => {
    if (value.startsWith('data:image/')) return value
    if (value.startsWith('static/') || value.startsWith('/static/')) {
      const localPath = value.startsWith('/static/') ? value.slice(1) : value
      try {
        return await readImageAsCompressedDataUrl(localPath, {
          maxWidth: 768,
          maxHeight: 768,
          quality: 68,
        })
      } catch (err) {
        logTaskWarn('ImageTask', 'reference-read-failed', { path: localPath, error: (err as Error).message })
        return null
      }
    }
    return value
  }))

  return normalized.filter((item): item is string => !!item).slice(0, 6)
}

async function normalizeVideoReferenceUrl(value: string | null | undefined): Promise<string | null> {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (raw.startsWith('data:image/')) return raw
  if (raw.startsWith('static/') || raw.startsWith('/static/')) {
    const localPath = raw.startsWith('/static/') ? raw.slice(1) : raw
    try {
      return await readImageAsCompressedDataUrl(localPath, {
        maxWidth: 768,
        maxHeight: 768,
        quality: 68,
      })
    } catch (err) {
      logTaskWarn('VideoTask', 'reference-read-failed', { path: localPath, error: (err as Error).message })
      return null
    }
  }
  return raw
}

async function normalizeVideoReferenceUrls(refs: string[] | null | undefined): Promise<string[]> {
  if (!Array.isArray(refs) || !refs.length) return []
  const normalized = await Promise.all(
    Array.from(new Set(refs.map((item) => String(item || '').trim()).filter(Boolean))).map((item) => normalizeVideoReferenceUrl(item)),
  )
  return normalized.filter((item): item is string => !!item)
}

/**
 * 将参考视频/音频解析为上游可读取的地址。
 * http(s)/dataURL 直通；本地 static 路径优先使用 PUBLIC_BASE_URL，
 * 本地开发未配置公网入口时转为 data URL，使“从本地上传”可以直接工作。
 */
function resolveReferenceMediaUrl(value: string | null | undefined, kind: 'video' | 'audio'): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw
  if (raw.startsWith('static/') || raw.startsWith('/static/')) {
    const base = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '')
    if (base) {
      const p = raw.startsWith('/') ? raw : `/${raw}`
      return `${base}${p}`
    }
    const localPath = raw.startsWith('/') ? raw.slice(1) : raw
    try {
      return readMediaAsDataUrl(localPath)
    } catch (error) {
      const label = kind === 'video' ? '视频' : '音频'
      throw new Error(`读取本地参考${label}失败：${(error as Error).message}`)
    }
  }
  return raw
}

async function resolveReferenceMediaUrls(refs: string[] | null | undefined, kind: 'video' | 'audio'): Promise<string[]> {
  if (!Array.isArray(refs) || !refs.length) return []
  const items = Array.from(new Set(refs.map((item) => String(item || '').trim()).filter(Boolean)))
  return items.map((item) => resolveReferenceMediaUrl(item, kind)).filter((item): item is string => !!item)
}

// ─── 启动恢复 ─────────────────────────────────────────────────────

/**
 * 恢复单个中断的生成任务（服务重启后调用，仅续跑、绝不重提）。
 * - 有上游 taskId → 续轮询（上游任务可能仍在生成，不重复提交不重复扣费）
 * - 无 taskId → 创建请求已发出但响应丢失（可能已扣费），标记失败让用户手动重试
 * 通过 processTask 统一受并发信号量约束。
 */
export async function resumeTaskById(id: number): Promise<void> {
  const [record] = await db.select().from(schema.sysTask).where(eq(schema.sysTask.id, id))
  if (!record || record.status !== 'processing') return
  const type = record.type as TaskType
  const label = taskLabel(type)

  if (!record.taskId) {
    // 无法区分「请求未发出」与「已扣费但响应丢失」，安全起见不自动重提
    await failTask(id, '服务重启，任务在提交阶段中断。为避免重复扣费已停止自动重试，请手动重新生成')
    return
  }

  const config = await findConfigForTask(record)
  if (!config) {
    await failTask(id, '服务重启后未找到可用的模型配置，任务已标记失败，请重新生成')
    return
  }
  logTaskProgress(label, 'resume', { id, type, hasTaskId: true, provider: config.provider })
  await processTask(id, config)
}

/**
 * 为恢复的任务查找可用模型配置。
 * 1) 优先用创建时持久化的 config_id 精确恢复（多同厂商/模型配置不选错 Base URL/账号）；
 * 2) 旧任务无 config_id 时按 provider+model 精确匹配；
 * 3) 都找不到回退当前启用配置（保证任务能继续，配置差异由模型侧容错）。
 */
async function findConfigForTask(record: SysTaskRecord): Promise<AIConfig | null> {
  const type = record.type as TaskType
  const params = parseTaskParams(record.params)
  const savedConfigId = Number(params.configId)
  if (Number.isInteger(savedConfigId) && savedConfigId > 0) {
    const cfg = await getConfigById(savedConfigId)
    if (cfg) {
      logTaskProgress('SysTask', 'resume-config-by-id', {
        id: record.id,
        configId: savedConfigId,
        provider: cfg.provider,
        model: cfg.model,
      })
      return cfg
    }
    logTaskWarn('SysTask', 'resume-config-by-id-missing', { id: record.id, configId: savedConfigId })
  }
  if (record.provider && record.model) {
    try {
      const rows = await db.select().from(schema.aiServiceConfigs)
        .where(eq(schema.aiServiceConfigs.serviceType, type))
      const matched = rows.find(r => {
        if (!r.isActive || r.provider !== record.provider) return false
        try {
          const models: string[] = JSON.parse(r.model || '[]')
          return models.includes(record.model!)
        } catch {
          return false
        }
      })
      if (matched) {
        logTaskProgress('SysTask', 'resume-config-matched', {
          id: record.id,
          configId: matched.id,
          provider: matched.provider,
          model: record.model,
        })
        return {
          provider: matched.provider!,
          baseUrl: matched.baseUrl,
          apiKey: matched.apiKey,
          model: record.model!,
        }
      }
    } catch (err) {
      logTaskWarn('SysTask', 'resume-config-lookup-failed', { id: record.id, error: (err as Error).message })
    }
  }
  return getActiveConfig(type)
}
