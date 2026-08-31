/**
 * AutoDL Art ComfyUI 工作流视频 Adapter。
 *
 * 与影策 autodl-comfyui 插件保持同一协议：
 * - POST /api/v1/comfyui/comfyui_workflow/{workflowId}
 * - GET  /api/v1/comfyui/comfyui_workflow/result/{taskId}
 * - Authorization 直接传 Token（不加 Bearer）
 */
import type {
  VideoProviderAdapter,
  ProviderRequest,
  AIConfig,
  VideoGenerationRecord,
  VideoGenResponse,
  VideoPollResponse,
} from './types'
import { joinProviderUrl } from './url'

const DEFAULT_WORKFLOW = 'minimax_h3_image_audio_to_video_v2_15s'
const SUPPORTED_WORKFLOWS = new Set([
  'minimax_h3_image_audio_to_video_v2_15s',
  'minimax_h3_lightx2v_v5_15s',
  'minimax_h3_image_audio_to_video_v2',
  'minimax_h3_image_audio_to_video',
  'minimax_h3_lightx2v_v5',
  'minimax_h3_lightx2v_no_pic',
  'minimax_h3_lightx2v',
])

const REF_LIMITS = { images: 9, audios: 3 } as const

function parseUrlArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value)
      ? value.map(item => String(item || '').trim()).filter(Boolean)
      : []
  } catch {
    return []
  }
}

function messageFrom(result: any, fallback: string): string {
  const message = result?.data?.message || result?.msg || result?.error?.message || result?.error
  if (typeof message === 'string' && message.trim()) return message.trim()
  if (message && typeof message === 'object') return JSON.stringify(message)
  return fallback
}

function isSuccessCode(code: unknown): boolean {
  return code === undefined || code === null || code === 0 || code === '0' || String(code).toLowerCase() === 'success'
}

function resultVideoUrl(result: any): string | null {
  const results = result?.data?.results ?? result?.results
  if (Array.isArray(results)) {
    const video = results.find(item => {
      if (typeof item === 'string') return true
      return item && typeof item === 'object' && (!item.type || item.type === 'video' || item.file_type === 'mp4')
    })
    if (typeof video === 'string') return video
    if (video?.url) return String(video.url)
  }
  return result?.data?.video_url || result?.video_url || null
}

export class AutoDLVideoAdapter implements VideoProviderAdapter {
  provider = 'autodl'

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const workflow = String(record.model || config.model || DEFAULT_WORKFLOW).trim()
    if (!SUPPORTED_WORKFLOWS.has(workflow)) {
      throw new Error(`Huobao 尚未适配该 AutoDL 工作流：${workflow}`)
    }

    const token = String(config.apiKey || '').trim()
    if (!token) throw new Error('AutoDL Token 未配置，请先到「设置 → AI 服务 → 视频」中填写')

    const prompt = String(record.prompt || '').trim()
    if (!prompt && workflow !== 'minimax_h3_image_audio_to_video') {
      throw new Error('AutoDL 视频提示词不能为空')
    }
    if (prompt.length > 10_000) {
      throw new Error(`AutoDL 提示词上限 10000 字符，当前 ${prompt.length}`)
    }

    const images = parseUrlArray(record.referenceImageUrls)
    const audios = parseUrlArray(record.referenceAudioUrls)
    const videos = parseUrlArray(record.referenceVideoUrls)
    if (images.length > REF_LIMITS.images || audios.length > REF_LIMITS.audios) {
      throw new Error(`AutoDL 参考素材超限：图片≤${REF_LIMITS.images}、音频≤${REF_LIMITS.audios}`)
    }
    if (videos.length) {
      throw new Error('当前 AutoDL H3 工作流不接收参考视频，请只使用参考图片和参考音频')
    }

    const body: Record<string, unknown> = {
      duration: this.normalizeDuration(record.duration, workflow),
      resolution: this.normalizeResolution(record.resolution, record.aspectRatio, workflow),
    }
    if (prompt && workflow !== 'minimax_h3_image_audio_to_video') body.prompt = prompt
    if (workflow === 'minimax_h3_image_audio_to_video') {
      body.audio_duration = body.duration
      delete body.duration
    }

    images.forEach((url, index) => { body[`ref_image_${index}`] = url })
    audios.forEach((url, index) => { body[`ref_audio_${index}`] = url })

    return {
      url: joinProviderUrl(config.baseUrl, '', `/api/v1/comfyui/comfyui_workflow/${encodeURIComponent(workflow)}`),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body,
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    if (!isSuccessCode(result?.code)) {
      throw new Error(messageFrom(result, `AutoDL 提交失败：${String(result?.code || 'unknown')}`))
    }
    const videoUrl = resultVideoUrl(result)
    if (videoUrl) return { isAsync: false, videoUrl }

    const taskId = result?.data?.task_id || result?.task_id
    if (taskId) return { isAsync: true, taskId: String(taskId) }
    throw new Error(messageFrom(result, 'AutoDL 响应中没有 task_id 或视频地址'))
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    const token = String(config.apiKey || '').trim()
    if (!token) throw new Error('AutoDL Token 未配置')
    return {
      url: joinProviderUrl(config.baseUrl, '', `/api/v1/comfyui/comfyui_workflow/result/${encodeURIComponent(taskId)}`),
      method: 'GET',
      headers: { Authorization: token },
      body: undefined,
    }
  }

  parsePollResponse(result: any): VideoPollResponse {
    if (!isSuccessCode(result?.code)) {
      return { status: 'failed', error: messageFrom(result, `AutoDL 查询失败：${String(result?.code || 'unknown')}`) }
    }

    const rawStatus = String(result?.data?.status || result?.status || '').trim().toLowerCase()
    if (['completed', 'complete', 'succeeded', 'success', 'done'].includes(rawStatus)) {
      const videoUrl = resultVideoUrl(result)
      if (!videoUrl) return { status: 'failed', error: 'AutoDL 任务已完成，但结果中没有视频地址' }
      return { status: 'completed', videoUrl }
    }
    if (['failed', 'failure', 'error', 'cancelled', 'canceled'].includes(rawStatus)) {
      return { status: 'failed', error: messageFrom(result, 'AutoDL 视频生成失败') }
    }
    if (['queued', 'pending', 'created'].includes(rawStatus)) return { status: 'pending' }
    return { status: 'processing' }
  }

  extractVideoUrl(result: any): string | null {
    return resultVideoUrl(result)
  }

  private normalizeDuration(duration: number | null | undefined, workflow: string): number {
    const parsed = Math.round(Number(duration || 5))
    const max = workflow === 'minimax_h3_image_audio_to_video_v2' || workflow === 'minimax_h3_lightx2v_v5' ? 10 : 15
    return Math.min(max, Math.max(1, Number.isFinite(parsed) ? parsed : 5))
  }

  private normalizeResolution(resolution: string | null | undefined, aspectRatio: string | null | undefined, workflow: string): string {
    const raw = String(resolution || '').trim().toLowerCase()
    if (/^(480|768|1080)p(竖|横|\(1:1\))$/.test(raw)) return raw

    const vertical = ['9:16', '3:4'].includes(String(aspectRatio || '').trim())
    const horizontal = ['16:9', '4:3'].includes(String(aspectRatio || '').trim())
    if (!vertical && !horizontal) {
      throw new Error(`当前 AutoDL 工作流不支持画幅 ${aspectRatio || '未设置'}，请选择 9:16、3:4、16:9 或 4:3`)
    }

    const quality = raw === '480p' ? '480p' : raw === '1080p' && !workflow.endsWith('_15s') ? '1080p' : '768p'
    return `${quality}${vertical ? '竖' : '横'}`
  }
}
