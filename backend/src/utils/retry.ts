/**
 * 统一重试工具 — 网络层/瞬时错误自动重试，业务失败不重试。
 * 判定规则：AbortError(超时)、TypeError(网络错误)、429/5xx 视为可重试；4xx 业务错误不重试。
 */
import { logTaskWarn } from './task-logger.js'

export interface RetryOptions {
  /** 重试次数（不含首次），默认 2 */
  retries?: number
  /** 首次重试延迟 ms，默认 1000，之后指数退避 */
  baseDelayMs?: number
  /** 最大延迟 ms，默认 10000 */
  maxDelayMs?: number
  scope?: string
  action?: string
  meta?: Record<string, unknown>
  /** 自定义是否可重试；默认走 isRetryableError */
  shouldRetry?: (err: unknown) => boolean
}

export function isRetryableError(err: unknown): boolean {
  const e = err as any
  if (!e) return false
  // 超时
  if (e.name === 'AbortError' || e.name === 'TimeoutError') return true
  // fetch 网络层失败（ECONNREFUSED / DNS / 连接重置等）抛 TypeError
  if (e instanceof TypeError) return true
  // 带状态码的错误：429 限流与 5xx 服务端错误可重试
  if (typeof e.status === 'number') return e.status === 429 || e.status >= 500
  if (typeof e.code === 'number') return e.code === 429 || e.code >= 500
  return false
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 2
  const baseDelayMs = opts.baseDelayMs ?? 1000
  const maxDelayMs = opts.maxDelayMs ?? 10_000
  const scope = opts.scope || 'Retry'
  const action = opts.action || 'operation'
  const shouldRetry = opts.shouldRetry || isRetryableError

  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt >= retries || !shouldRetry(err)) throw err
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt)
      logTaskWarn(scope, `${action}-retry`, {
        ...opts.meta,
        attempt: attempt + 1,
        maxAttempts: retries + 1,
        retryInMs: delay,
        error: (err as Error).message,
      })
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}
