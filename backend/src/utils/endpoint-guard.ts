/**
 * 出站 AI Endpoint 安全守卫：SSRF 防护 + 受限读取 + 逐跳重定向校验。
 *
 * 背景：/ai-configs/test 与 /ai-configs/models 会对用户提交的 base_url 发起服务端请求。
 * 应用一旦被局域网/公网访问，未受控的请求会形成 SSRF 探测入口，且 Gemini 路径会把
 * API Key 随请求发往任意地址。本模块统一收口出站请求：
 *
 * - 仅允许 http/https 协议
 * - DNS 解析后拒绝私网/回环/链路本地/保留地址（默认）；确有本地/私网 AI 网关时
 *   通过 ALLOW_PRIVATE_AI_ENDPOINTS=true 显式放行
 * - 手动跟随重定向，每一跳重新校验目标地址；跨 origin 跳转丢弃 Authorization /
 *   x-goog-api-key 头与请求体，避免 Key 随跳转泄漏
 * - 响应体读取设上限，防止异常服务拖垮内存/设置页
 */
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024 // 2MiB
export const MAX_REDIRECTS = 5

export class UnsafeEndpointError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeEndpointError'
  }
}

const ALLOW_PRIVATE_AI_ENDPOINTS = process.env.ALLOW_PRIVATE_AI_ENDPOINTS === 'true'

// ─── 私网/保留地址判断 ──────────────────────────────────────────────────────
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p))) return true
  const [a, b] = parts
  if (a === 0) return true // 0.0.0.0/8 本网络
  if (a === 10) return true // 10.0.0.0/8
  if (a === 127) return true // 127.0.0.0/8 回环
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true // 169.254.0.0/16 链路本地
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 192 && b === 0) return true // 192.0.0.0/24 IETF 保留
  if (a === 198 && (b === 18 || b === 19)) return true // 198.18.0.0/15 基准测试
  if (a >= 224) return true // 224.0.0.0/4 组播与保留
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (lower === '::' || lower === '::1') return true
  const first = lower.split(':')[0] || ''
  if (first.startsWith('fc') || first.startsWith('fd')) return true // fc00::/7 ULA
  if (first.startsWith('fe8') || first.startsWith('fe9') || first.startsWith('fea') || first.startsWith('feb')) return true // fe80::/10
  if (first.startsWith('ff')) return true // 组播
  return false
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) return isPrivateIPv4(ip)
  if (kind === 6) return isPrivateIPv6(ip)
  return true // 无法识别按不安全处理
}

// DNS 解析函数可注入（测试用）；默认使用系统 DNS
let dnsLookup: (hostname: string) => Promise<string> = async (hostname) => {
  const { address } = await lookup(hostname, { verbatim: true })
  return address
}
export function setEndpointLookup(fn: (hostname: string) => Promise<string>): void {
  dnsLookup = fn
}

export async function assertSafeEndpointUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new UnsafeEndpointError('invalid endpoint url')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeEndpointError(`protocol not allowed: ${url.protocol}`)
  }
  if (ALLOW_PRIVATE_AI_ENDPOINTS) return url

  // hostname 是 IP 字面量时直接判断，否则解析后判断
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const ip = isIP(hostname) ? hostname : await dnsLookup(hostname)

  if (isPrivateAddress(ip)) {
    throw new UnsafeEndpointError(`private address not allowed: ${ip}`)
  }
  return url
}

/** 受限读取：超过 maxBytes 抛 UnsafeEndpointError */
export async function readBodyLimited(resp: Response, maxBytes = MAX_RESPONSE_BYTES): Promise<string> {
  const body = resp.body
  if (!body) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  const decoder = new TextDecoder()
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new UnsafeEndpointError(`response body exceeds ${maxBytes} bytes`)
    }
    chunks.push(value)
  }
  let text = ''
  for (const chunk of chunks) text += decoder.decode(chunk, { stream: true })
  text += decoder.decode()
  return text
}

/**
 * 安全出站请求：每跳校验目标地址，跨 origin 跳转丢弃鉴权头与请求体；
 * 响应体受限读取后返回 { resp, body }。
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  opts: { maxBytes?: number; maxRedirects?: number } = {},
): Promise<{ resp: Response; body: string }> {
  const maxRedirects = opts.maxRedirects ?? MAX_REDIRECTS
  const maxBytes = opts.maxBytes ?? MAX_RESPONSE_BYTES

  let url = rawUrl
  let currentInit: RequestInit = init
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeEndpointUrl(url)
    const resp = await fetch(url, { ...currentInit, redirect: 'manual' })

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location')
      await resp.body?.cancel().catch(() => {})
      if (!location) throw new UnsafeEndpointError('redirect without location')
      const next = new URL(location, url)
      // 跨 origin 跳转丢弃鉴权头与请求体（防 Key 随跳转泄漏），仅 GET
      if (next.origin !== new URL(url).origin) {
        currentInit = { ...currentInit, headers: dropAuthHeaders(currentInit.headers), body: undefined, method: 'GET' }
      }
      url = next.toString()
      continue
    }

    const body = await readBodyLimited(resp, maxBytes)
    return { resp, body }
  }
  throw new UnsafeEndpointError(`too many redirects (> ${maxRedirects})`)
}

function dropAuthHeaders(headers: HeadersInit | undefined): HeadersInit {
  const next: Record<string, string> = {}
  const src = new Headers(headers)
  const drop = new Set(['authorization', 'x-goog-api-key'])
  for (const [key, value] of src.entries()) {
    if (!drop.has(key.toLowerCase())) next[key] = value
  }
  return next
}
