/**
 * OpenAI DALL-E 图片生成 Adapter
 * 端点: /v1/images/generations (注意 /v1 前缀)
 * 响应格式: { data: [{ url: "..." }] } 或 { data: [{ b64_json: "..." }] }
 */
import type {
  ImageProviderAdapter,
  ProviderRequest,
  AIConfig,
  ImageGenerationRecord,
  ImageGenResponse,
  ImagePollResponse,
} from './types'
import { joinProviderUrl } from './url'

export class OpenAIImageAdapter implements ImageProviderAdapter {
  provider = 'openai'

  buildGenerateRequest(config: AIConfig, record: ImageGenerationRecord): ProviderRequest {
    const model = record.model || config.model || 'gpt-image-2'
    const isGptImage = model.startsWith('gpt-image-')
    const isGptImage2 = model === 'gpt-image-2'
    const isSenseNova = model.toLowerCase().includes('sensenova')
    const size = isGptImage2
      ? this.normalizeGptImage2Size(record.size)
      : isGptImage
        ? this.normalizeGptImageSize(record.size)
        : isSenseNova
          ? this.mapSenseNovaSize(record.size)
          : record.size || '1024x1024'

    const body: any = {
      model,
      prompt: record.prompt,
      size,
      n: 1,
    }

    if (!isGptImage) {
      body.response_format = 'url'
    }

    return {
      url: joinProviderUrl(config.baseUrl, '/v1', '/images/generations'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body,
    }
  }

  private normalizeGptImageSize(size?: string | null): string {
    const allowed = ['1024x1024', '1536x1024', '1024x1536', 'auto']
    if (!size) return '1024x1024'

    const normalized = size.toLowerCase()
    if (allowed.includes(normalized)) return normalized

    const [width, height] = normalized.split('x').map(Number)
    if (!width || !height) return 'auto'
    if (width === height) return '1024x1024'
    return width > height ? '1536x1024' : '1024x1536'
  }

  /**
   * 商汤 SenseNova 图片模型（如 sensenova-u1-fast）只接受固定的一组分辨率，
   * 不支持 OpenAI/DALL-E 的 1024x1024、1536x1024 等。这里把请求尺寸按宽高比
   * 归一化映射到最接近的合法值，保证项目里硬编码的 1920x1080 / 1024x1024 可用。
   */
  private mapSenseNovaSize(size?: string | null): string {
    const allowed = [
      '1664x2496', '2496x1664',
      '1760x2368', '2368x1760',
      '1824x2272', '2272x1824',
      '2048x2048',
      '2752x1536', '1536x2752',
      '3072x1376', '1344x3136',
      '2560x720', '3072x864',
    ]
    if (!size) return '2048x2048'
    if (allowed.includes(size.toLowerCase())) return size.toLowerCase()
    if (size.toLowerCase() === 'auto') return '2048x2048'

    const [w, h] = size.toLowerCase().split('x').map(Number)
    if (!w || !h) return '2048x2048'
    const reqRatio = w / h

    // 先筛同朝向候选（横/竖/方），避免 16:9 映射成竖图
    let pool = allowed.filter(s => {
      const [aw, ah] = s.split('x').map(Number)
      const ar = aw / ah
      if (Math.abs(reqRatio - 1) < 0.15) return Math.abs(ar - 1) < 0.15
      if (reqRatio > 1) return ar > 1
      return ar < 1
    })
    if (pool.length === 0) pool = allowed

    // 在候选里取宽高比最接近者
    pool.sort((a, b) => {
      const [aw, ah] = a.split('x').map(Number)
      const [bw, bh] = b.split('x').map(Number)
      return Math.abs(aw / ah - reqRatio) - Math.abs(bw / bh - reqRatio)
    })
    return pool[0]
  }

  private normalizeGptImage2Size(size?: string | null): string {
    if (!size) return '1024x1024'
    const normalized = size.toLowerCase()
    if (normalized === 'auto') return 'auto'

    const [rawWidth, rawHeight] = normalized.split('x').map(Number)
    if (!rawWidth || !rawHeight) return 'auto'

    const width = this.roundToMultiple(Math.min(4096, Math.max(256, rawWidth)), 16)
    const height = this.roundToMultiple(Math.min(4096, Math.max(256, rawHeight)), 16)
    return `${width}x${height}`
  }

  private roundToMultiple(value: number, multiple: number): number {
    return Math.max(multiple, Math.round(value / multiple) * multiple)
  }

  parseGenerateResponse(result: any): ImageGenResponse {
    // OpenAI DALL-E 3 目前是同步返回，但规范上也有异步 task 模式
    if (result.task_id || result.id) {
      return { isAsync: true, taskId: result.task_id || result.id }
    }
    const imageUrl = result.data?.[0]?.url || result.url
    if (imageUrl) {
      return { isAsync: false, imageUrl }
    }
    // b64_json 模式
    const b64 = result.data?.[0]?.b64_json
    if (b64) {
      // 对于 base64，返回特殊标记，实际处理在 extractImageBase64
      return { isAsync: false, imageUrl: undefined }
    }
    throw new Error('No image URL in response')
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: joinProviderUrl(config.baseUrl, '/v1', `/images/task/${taskId}`),
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): ImagePollResponse {
    if (result.status === 'completed') {
      return {
        status: 'completed',
        imageUrl: result.image_url || result.data?.[0]?.url || null,
      }
    }
    if (result.status === 'failed') {
      return { status: 'failed', error: result.error?.message || 'Generation failed' }
    }
    return { status: result.status || 'processing' }
  }

  extractImageUrl(result: any): string | null {
    return result.data?.[0]?.url || result.image_url || null
  }

  extractImageBase64(result: any): { data: string; mimeType: string } | null {
    const b64 = result.data?.[0]?.b64_json
    if (b64) {
      return { data: b64, mimeType: 'image/png' }
    }
    return null
  }
}
