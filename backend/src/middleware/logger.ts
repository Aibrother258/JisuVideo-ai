import type { MiddlewareHandler } from 'hono'

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

function statusColor(status: number): string {
  if (status >= 500) return colors.red
  if (status >= 400) return colors.yellow
  if (status >= 300) return colors.cyan
  return colors.green
}

function formatTime(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

const secretKeys = new Set([
  'authorization',
  'api_key',
  'apikey',
  'token',
  'access_token',
  'secret',
  'secret_key',
  'password',
])
const creativeContentKeys = new Set([
  'content', 'description', 'source_content', 'script_content', 'review_note', 'review_notes',
  'plan', 'prompt', 'final_prompt', 'image_prompt', 'video_prompt', 'minimax_h3_prompt',
])

function redactRequestBody(text: string): string {
  try {
    const value = JSON.parse(text)
    const visit = (input: unknown): unknown => {
      if (Array.isArray(input)) return input.map(visit)
      if (!input || typeof input !== 'object') return input
      const output: Record<string, unknown> = {}
      for (const [key, child] of Object.entries(input as Record<string, unknown>)) {
        const normalized = key.toLowerCase().replace(/[-\s]/g, '_')
        if (secretKeys.has(normalized) || normalized.includes('token') || normalized.includes('password')) {
          output[key] = '***'
        } else if (creativeContentKeys.has(normalized) || normalized.endsWith('_prompt')) {
          const size = typeof child === 'string' || Array.isArray(child) ? child.length : undefined
          output[key] = size === undefined ? '<creative content omitted>' : `<creative content omitted:${size}>`
        } else {
          output[key] = visit(child)
        }
      }
      return output
    }
    return JSON.stringify(visit(value))
  } catch {
    return `<unparseable body omitted:${text.length}>`
  }
}

/**
 * 全局日志中间件 — 打印请求方法/路径/状态/耗时/请求体
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const method = c.req.method
  const path = c.req.path
  const start = performance.now()

  // 打印请求
  const time = formatTime()
  let bodyInfo = ''
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = c.req.header('content-type') || ''
    const containsCreativeContent = /\/dramas\/(?:analyze-source|import-source|\d+\/(?:analyze-episodes|episode-plan|episodes\/from-plan))$/.test(path)
    if (containsCreativeContent) {
      bodyInfo = `\n  ${colors.dim}body: <creative content omitted>${colors.reset}`
    } else if (contentType.toLowerCase().startsWith('multipart/form-data')) {
      bodyInfo = `\n  ${colors.dim}body: <multipart file omitted>${colors.reset}`
    } else {
    try {
      const clone = c.req.raw.clone()
      const text = redactRequestBody(await clone.text())
      if (text) {
        const truncated = text.length > 500 ? text.slice(0, 500) + '...' : text
        bodyInfo = `\n  ${colors.dim}body: ${truncated}${colors.reset}`
      }
    } catch {}
    }
  }

  console.log(`${colors.dim}${time}${colors.reset} ${colors.cyan}${method}${colors.reset} ${path}${bodyInfo}`)

  await next()

  const ms = (performance.now() - start).toFixed(0)
  const status = c.res.status
  const sc = statusColor(status)
  console.log(`${colors.dim}${time}${colors.reset} ${colors.cyan}${method}${colors.reset} ${path} ${sc}${status}${colors.reset} ${colors.dim}${ms}ms${colors.reset}`)
}

/**
 * 全局错误处理 — 捕获未处理异常，打印完整堆栈
 */
export const errorHandler: MiddlewareHandler = async (c, next) => {
  try {
    await next()
  } catch (err: any) {
    const status = err.status || 500
    console.error(`${colors.red}[ERROR]${colors.reset} ${c.req.method} ${c.req.path}`)
    console.error(err.stack || err.message || err)
    return c.json({ code: status, message: err.message || 'Internal Server Error' }, status)
  }
}
