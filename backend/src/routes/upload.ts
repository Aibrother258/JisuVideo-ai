import { Hono } from 'hono'
import { success, badRequest } from '../utils/response.js'
import { db, getInsertId, schema } from '../db/index.js'
import { now } from '../utils/response.js'
import { saveUploadedFile, generateImageThumb, thumbPathFor } from '../utils/storage.js'

const app = new Hono()

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])
const IMAGE_MAX = 10 * 1024 * 1024 // 10MB

// POST /upload/image
app.post('/image', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    return badRequest(c, 'file is required')
  }

  const ext = extOf(file.name)
  // MIME 可伪造，扩展名兜底；空 / octet-stream 视为未知类型，仅按扩展名校验
  const mimeKnown = file.type && file.type !== 'application/octet-stream'
  if (!IMAGE_EXT.has(ext) || (mimeKnown && !IMAGE_MIME.has(file.type))) {
    return badRequest(c, `仅支持 ${Array.from(IMAGE_EXT).join('/')} 格式的图片`)
  }
  // 先用 file.size 预检（无需读进内存），超限直接拒绝
  if (file.size > IMAGE_MAX) {
    return badRequest(c, `图片大小不能超过 ${Math.round(IMAGE_MAX / 1024 / 1024)}MB`)
  }

  const buffer = await file.arrayBuffer()
  const path = await saveUploadedFile(buffer, 'uploads', file.name)
  // 同步生成列表页缩略图，上传图与生图走同一套展示链路（失败不影响上传结果）
  await generateImageThumb(path)
  const assetId = await saveLibraryAsset(body, file, 'image', path, thumbPathFor(path))
  return success(c, { url: `/${path}`, path, asset_id: assetId })
})

const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.m4v'])
const VIDEO_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'])
const VIDEO_MAX = 50 * 1024 * 1024 // 50MB

const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac'])
const AUDIO_MIME = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/x-flac'])
const AUDIO_MAX = 20 * 1024 * 1024 // 20MB

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

async function saveLibraryAsset(
  body: Record<string, string | File>,
  file: File,
  kind: 'image' | 'video' | 'audio',
  path: string,
  thumbnailPath?: string,
): Promise<number | null> {
  if (String(body['save_to_library'] || '') !== '1') return null
  const ts = now()
  const result = await db.insert(schema.assets).values({
    dramaId: Number(body['drama_id'] || 0) || null,
    episodeId: Number(body['episode_id'] || 0) || null,
    storyboardId: Number(body['storyboard_id'] || 0) || null,
    name: String(body['name'] || file.name || `${kind}素材`),
    description: String(body['description'] || '本地上传的参考素材'),
    type: kind,
    category: String(body['category'] || 'reference'),
    url: `/${path}`,
    thumbnailUrl: thumbnailPath ? `/${thumbnailPath}` : null,
    localPath: path,
    fileSize: file.size || 0,
    mimeType: file.type || null,
    format: extOf(file.name).replace(/^\./, '') || null,
    createdAt: ts,
    updatedAt: ts,
  })
  return getInsertId(result)
}

async function saveMediaUpload(
  c: any,
  kind: 'video' | 'audio',
  allowedExt: Set<string>,
  allowedMime: Set<string>,
  maxBytes: number,
) {
  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || !(file instanceof File)) {
    return badRequest(c, 'file is required')
  }
  const label = kind === 'video' ? '视频' : '音频'
  const ext = extOf(file.name)
  // MIME 可伪造，扩展名兜底；空 / octet-stream 视为未知类型，仅按扩展名校验
  const mimeKnown = file.type && file.type !== 'application/octet-stream'
  if (!allowedExt.has(ext) || (mimeKnown && !allowedMime.has(file.type))) {
    return badRequest(c, `仅支持 ${Array.from(allowedExt).join('/')} 格式的${label}文件`)
  }
  // 先用 file.size 预检（不读进内存），超大文件直接拒绝
  if (file.size > maxBytes) {
    return badRequest(c, `${label}文件大小不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`)
  }
  const buffer = await file.arrayBuffer()
  // 双保险：file.size 可能被伪造，落盘前按实际字节数再校验一次
  if (buffer.byteLength > maxBytes) {
    return badRequest(c, `${label}文件大小不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`)
  }
  const path = await saveUploadedFile(buffer, 'uploads', file.name)
  const assetId = await saveLibraryAsset(body, file, kind, path)
  return success(c, { url: `/${path}`, path, asset_id: assetId })
}

// POST /upload/video — 参考视频上传（Seedance 多模态参考用）
app.post('/video', async (c) => saveMediaUpload(c, 'video', VIDEO_EXT, VIDEO_MIME, VIDEO_MAX))

// POST /upload/audio — 参考音频上传（Seedance 多模态参考用）
app.post('/audio', async (c) => saveMediaUpload(c, 'audio', AUDIO_EXT, AUDIO_MIME, AUDIO_MAX))

export default app
