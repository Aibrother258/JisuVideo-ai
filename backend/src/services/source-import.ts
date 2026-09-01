import { lookup } from 'node:dns/promises'
import { request as httpRequest, type IncomingMessage, type RequestOptions } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'

const MAX_SOURCE_BYTES = 6 * 1024 * 1024
const MAX_SOURCE_CHARS = 200_000
const MAX_REDIRECTS = 4

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
}

function isPrivateIp(address: string) {
  const normalized = address.toLowerCase().split('%')[0]
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized)
  if (isIP(normalized) !== 6) return true
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true
  if (normalized.startsWith('::ffff:')) return isPrivateIpv4(normalized.slice(7))
  return false
}

async function validatePublicUrl(rawUrl: string) {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('小说链接格式不正确')
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('小说链接仅支持 http 或 https')
  if (url.username || url.password) throw new Error('小说链接不能包含账号或密码')
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('小说链接仅支持标准网页端口')
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('不能读取本机或局域网链接')
  const addresses = await lookup(host, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) throw new Error('不能读取本机或局域网链接')
  // 返回已校验的实际地址；后续请求直接连接该地址，避免校验后再次 DNS 解析造成 rebinding。
  return { url, address: addresses[0].address, family: addresses[0].family }
}

async function readLimitedBody(response: IncomingMessage) {
  const declared = Number(response.headers['content-length'] || 0)
  if (declared > MAX_SOURCE_BYTES) throw new Error('链接内容超过 6MB，请改用 TXT 或 MD 文件导入')
  const chunks: Buffer[] = []
  let total = 0
  for await (const value of response) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value)
    total += chunk.byteLength
    if (total > MAX_SOURCE_BYTES) {
      response.destroy()
      throw new Error('链接内容超过 6MB，请改用 TXT 或 MD 文件导入')
    }
    chunks.push(chunk)
  }
  const merged = Buffer.concat(chunks, total)
  const contentType = String(response.headers['content-type'] || '')
  const declaredCharset = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]?.toLowerCase()
  const charset = declaredCharset === 'gbk' || declaredCharset === 'gb2312' ? 'gb18030' : (declaredCharset || 'utf-8')
  try {
    const decoded = new TextDecoder(charset).decode(merged)
    if (!declaredCharset && (decoded.match(/�/g)?.length || 0) / Math.max(1, decoded.length) > 0.001) {
      return new TextDecoder('gb18030').decode(merged)
    }
    return decoded
  } catch {
    return new TextDecoder('utf-8').decode(merged)
  }
}

function requestPinnedPage(target: Awaited<ReturnType<typeof validatePublicUrl>>) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    const { url, address, family } = target
    const options: RequestOptions & { servername?: string } = {
      protocol: url.protocol,
      hostname: address,
      family,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      servername: url.hostname,
      headers: {
        Accept: 'text/html,text/plain,text/markdown;q=0.9,*/*;q=0.5',
        Host: url.host,
        'User-Agent': 'HuobaoDrama/1.0 (+local novel importer)',
      },
    }
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(options, resolve)
    request.setTimeout(15_000, () => request.destroy(Object.assign(new Error('小说链接读取超时，请重试或改用文件导入'), { code: 'SOURCE_TIMEOUT' })))
    request.on('socket', socket => {
      socket.once('connect', () => {
        if (!socket.remoteAddress || isPrivateIp(socket.remoteAddress)) {
          request.destroy(new Error('不能读取本机或局域网链接'))
        }
      })
    })
    request.on('error', reject)
    request.end()
  })
}

function decodeEntities(text: string) {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  }
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (full, name) => named[name.toLowerCase()] ?? full)
}

export function extractReadableText(raw: string, contentType: string) {
  if (!/html|xml/i.test(contentType) && !/<(?:html|body|article|main)[\s>]/i.test(raw)) {
    const content = raw.trim()
    if (content.length > MAX_SOURCE_CHARS) throw new Error('正文超过20万字，请拆分后导入，系统未保存任何截断内容')
    return { title: '', content }
  }
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = decodeEntities((titleMatch?.[1] || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  const content = decodeEntities(raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|iframe|form|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|section|article|main|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n'))
    .trim()
  if (content.length > MAX_SOURCE_CHARS) throw new Error('正文超过20万字，请拆分后导入，系统未保存任何截断内容')
  return { title, content }
}

export async function importNovelSource(rawUrl: string) {
  let target = await validatePublicUrl(rawUrl.trim())
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    try {
      const response = await requestPinnedPage(target)
      const status = response.statusCode || 0
      if (status >= 300 && status < 400) {
        const location = response.headers.location
        response.resume()
        if (!location || redirect === MAX_REDIRECTS) throw new Error('小说链接跳转次数过多')
        target = await validatePublicUrl(new URL(location, target.url).toString())
        continue
      }
      if (status < 200 || status >= 300) {
        response.resume()
        throw new Error(`小说链接读取失败（HTTP ${status}）`)
      }
      const contentType = String(response.headers['content-type'] || '')
      if (contentType && !/text|html|xml|markdown|octet-stream/i.test(contentType)) {
        response.resume()
        throw new Error('该链接不是可读取的小说文本页面')
      }
      const raw = await readLimitedBody(response)
      const parsed = extractReadableText(raw, contentType)
      if (parsed.content.length < 20) throw new Error('链接中没有提取到足够的正文，请改用 TXT 或 MD 文件导入')
      return { ...parsed, source_url: target.url.toString() }
    } catch (error: any) {
      if (error?.code === 'SOURCE_TIMEOUT') throw error
      throw error
    }
  }
  throw new Error('小说链接读取失败')
}
