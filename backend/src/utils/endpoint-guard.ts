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
import http from 'node:http'
import https from 'node:https'
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

function ipv4FromMappedIPv6(ip: string): string | null {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '')
  const [leftRaw, rightRaw] = lower.split('::')
  if (lower.split('::').length > 2) return null
  const expandPart = (part: string) => part ? part.split(':').filter(Boolean) : []
  let left = expandPart(leftRaw)
  let right = rightRaw === undefined ? [] : expandPart(rightRaw)
  const dotted = [...left, ...right].findIndex(item => item.includes('.'))
  if (dotted >= 0) {
    const combined = [...left, ...right]
    const dottedValue = combined[dotted]
    if (dotted !== combined.length - 1 || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(dottedValue)) return null
    const octets = dottedValue.split('.').map(Number)
    if (octets.some(value => value > 255)) return null
    const replacement = [((octets[0] << 8) | octets[1]).toString(16), ((octets[2] << 8) | octets[3]).toString(16)]
    if (dotted < left.length) left = [...left.slice(0, dotted), ...replacement]
    else right = [...right.slice(0, dotted - left.length), ...replacement]
  }
  const missing = 8 - left.length - right.length
  const words = rightRaw === undefined ? left : [...left, ...Array(Math.max(0, missing)).fill('0'), ...right]
  if (words.length !== 8 || words.some(word => !/^[0-9a-f]{1,4}$/.test(word))) return null
  const parsed = words.map(word => Number.parseInt(word, 16))
  // IPv4-compatible (::a.b.c.d) and IPv4-mapped (::ffff:a.b.c.d) addresses both
  // reach the IPv4 network stack; normalize them before evaluating private ranges.
  if (!parsed.slice(0, 5).every(word => word === 0) || (parsed[5] !== 0 && parsed[5] !== 0xffff)) return null
  return `${parsed[6] >> 8}.${parsed[6] & 0xff}.${parsed[7] >> 8}.${parsed[7] & 0xff}`
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (lower === '::' || lower === '::1') return true
  const mappedIPv4 = ipv4FromMappedIPv6(lower)
  if (mappedIPv4) return isPrivateIPv4(mappedIPv4)
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

// DNS 解析函数可注入（测试用）；默认取得全部地址。所有解析结果均须安全，
// 且 safeFetch 只连接本次已校验的地址，避免“校验公网、连接时 DNS 重绑定到私网”。
let dnsLookup: (hostname: string) => Promise<string[]> = async (hostname) => {
  const results = await lookup(hostname, { all: true, verbatim: true })
  return results.map(result => result.address)
}
export function setEndpointLookup(fn: (hostname: string) => Promise<string | string[]>): void {
  dnsLookup = async hostname => {
    const result = await fn(hostname)
    return Array.isArray(result) ? result : [result]
  }
}

export function resetEndpointLookup(): void {
  dnsLookup = async hostname => {
    const results = await lookup(hostname, { all: true, verbatim: true })
    return results.map(result => result.address)
  }
}

interface ResolvedEndpoint {
  url: URL
  address: string
  family: 4 | 6
}

export async function resolveSafeEndpoint(rawUrl: string): Promise<ResolvedEndpoint> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new UnsafeEndpointError('invalid endpoint url')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeEndpointError(`protocol not allowed: ${url.protocol}`)
  }
  // hostname 是 IP 字面量时直接判断，否则解析全部记录；只允许全部为公网地址。
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(hostname) ? [hostname] : await dnsLookup(hostname)
  if (!addresses.length || addresses.some(address => !isIP(address))) {
    throw new UnsafeEndpointError('endpoint DNS lookup returned no valid IP address')
  }
  if (!ALLOW_PRIVATE_AI_ENDPOINTS && addresses.some(isPrivateAddress)) {
    throw new UnsafeEndpointError(`private address not allowed: ${addresses.find(isPrivateAddress)}`)
  }
  const address = addresses[0]
  const family = isIP(address)
  if (family !== 4 && family !== 6) throw new UnsafeEndpointError('endpoint DNS lookup returned invalid IP family')
  return { url, address, family }
}

export async function assertSafeEndpointUrl(rawUrl: string): Promise<URL> {
  return (await resolveSafeEndpoint(rawUrl)).url
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
): Promise<{ resp: SafeResponse; body: string }> {
  const maxRedirects = opts.maxRedirects ?? MAX_REDIRECTS
  const maxBytes = opts.maxBytes ?? MAX_RESPONSE_BYTES

  let url = rawUrl
  let currentInit: RequestInit = init
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const endpoint = await resolveSafeEndpoint(url)
    const { resp, body } = await fetchPinnedEndpoint(endpoint, currentInit, maxBytes)

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location')
      if (!location) throw new UnsafeEndpointError('redirect without location')
      const next = new URL(location, url)
      // 跨 origin 跳转丢弃鉴权头与请求体（防 Key 随跳转泄漏），仅 GET
      if (next.origin !== new URL(url).origin) {
        currentInit = { ...currentInit, headers: dropAuthHeaders(currentInit.headers), body: undefined, method: 'GET' }
      }
      url = next.toString()
      continue
    }

    return { resp, body }
  }
  throw new UnsafeEndpointError(`too many redirects (> ${maxRedirects})`)
}

interface SafeResponse {
  status: number
  statusText: string
  ok: boolean
  headers: Headers
}

/**
 * 使用本次校验后的 IP 建立连接，同时保留原始 Host/SNI。
 * Node 的 fetch 会在校验后自行再次 DNS 解析；这里显式 pin 地址以消除 DNS rebinding 窗口。
 */
async function fetchPinnedEndpoint(
  endpoint: ResolvedEndpoint,
  init: RequestInit,
  maxBytes: number,
): Promise<{ resp: SafeResponse; body: string }> {
  const originalUrl = endpoint.url
  const headers = new Headers(init.headers)
  if (!headers.has('host')) headers.set('host', originalUrl.host)
  const body = init.body === undefined || init.body === null ? undefined : String(init.body)
  const options: https.RequestOptions = {
    protocol: originalUrl.protocol,
    hostname: endpoint.address,
    family: endpoint.family,
    port: originalUrl.port ? Number(originalUrl.port) : undefined,
    path: `${originalUrl.pathname}${originalUrl.search}`,
    method: init.method || 'GET',
    headers: Object.fromEntries(headers.entries()),
    servername: originalUrl.hostname.replace(/^\[|\]$/g, ''),
    signal: init.signal as AbortSignal | undefined,
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const request = (originalUrl.protocol === 'https:' ? https : http).request(options, response => {
      const chunks: Buffer[] = []
      let total = 0
      response.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > maxBytes) {
          const error = new UnsafeEndpointError(`response body exceeds ${maxBytes} bytes`)
          response.destroy(error)
          request.destroy(error)
          fail(error)
          return
        }
        chunks.push(chunk)
      })
      response.on('error', error => fail(error))
      response.on('end', () => {
        if (settled) return
        settled = true
        const responseHeaders = new Headers()
        for (const [key, value] of Object.entries(response.headers)) {
          if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : String(value))
        }
        resolve({
          resp: {
            status: response.statusCode || 0,
            statusText: response.statusMessage || '',
            ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300,
            headers: responseHeaders,
          },
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })
    request.on('error', error => fail(error))
    if (body !== undefined) request.write(body)
    request.end()
  })
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
