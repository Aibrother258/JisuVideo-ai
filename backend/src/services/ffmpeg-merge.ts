/**
 * FFmpeg 多镜头拼接 — 将所有生成后的镜头视频拼接为一集
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuid } from 'uuid'
import { db, getInsertId, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { now } from '../utils/response.js'
import { logTaskError, logTaskProgress, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'
import { extractVideoPoster } from '../utils/video-poster.js'
import { ffmpeg, checkFfmpegSuite } from '../utils/ffmpeg.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_ROOT = process.env.STORAGE_PATH || path.resolve(__dirname, '../../../data/static')
const DATA_ROOT = path.resolve(__dirname, '../../../data')

function toAbsPath(relativePath: string): string {
  if (path.isAbsolute(relativePath)) return relativePath
  if (relativePath.startsWith('static/')) return path.join(DATA_ROOT, relativePath)
  return path.join(STORAGE_ROOT, relativePath)
}

/**
 * 拼接一集的镜头视频。
 * 优先使用视频生成产物，兼容历史的 composedVideoUrl 数据。
 * 传入 storyboardIds 时只拼接所选镜头（仍按镜号顺序）。
 */
export async function mergeEpisodeVideos(episodeId: number, dramaId: number, storyboardIds?: number[]): Promise<number> {
  let storyboards = await db.select().from(schema.storyboards)
    .where(eq(schema.storyboards.episodeId, episodeId))
    .orderBy(schema.storyboards.storyboardNumber)

  if (storyboardIds?.length) {
    const allow = new Set(storyboardIds.map(Number))
    storyboards = storyboards.filter(sb => allow.has(sb.id))
  }

  // 允许部分拼接:按镜号顺序拼接已生成的镜头,未生成的跳过
  const clips = storyboards
    .map(sb => ({ sb, url: sb.videoUrl || sb.composedVideoUrl }))
    .filter(c => Boolean(c.url)) as { sb: typeof storyboards[number]; url: string }[]

  if (clips.length === 0) throw new Error('所选镜头还没有可拼接的视频')

  // 拼接前探测 ffmpeg：二进制损坏时 fluent-ffmpeg 的同步 EFTYPE 会崩掉整个进程，
  // 这里提前拦截并给出可操作的修复指引（路由层会作为 400 返回前端）
  const suite = await checkFfmpegSuite()
  if (!suite.ffmpeg || !suite.ffprobe) {
    throw new Error('本机 ffmpeg 不可用，无法拼接视频（常见于 node_modules 跨平台拷贝或 ffmpeg-static 下载损坏）。请删除 node_modules 后在本机重新 npm install，或设置 FFMPEG_BIN 指向有效的 ffmpeg 可执行文件后重启服务')
  }

  // 校验视频文件真实存在:DB 里的 video_url 可能指向已被清理的文件,
  // 直接拼会得到 ffmpeg 的 "No such file or directory" 晦涩报错
  const missing = clips.filter(c => !fs.existsSync(toAbsPath(c.url)))
  if (missing.length > 0) {
    const nums = missing.map(c => `S${c.sb.storyboardNumber}`).join('、')
    throw new Error(`镜头 ${nums} 的视频文件已丢失（本地文件不存在），请重新生成这些镜头的视频，或在拼接时取消勾选`)
  }

  const videos = clips.map(c => c.url)

  logTaskStart('MergeTask', 'episode-merge', { episodeId, dramaId, clips: videos.length })

  // 创建 merge 记录
  const ts = now()
  const res = await db.insert(schema.videoMerges).values({
    episodeId,
    dramaId,
    title: `Episode ${episodeId} Merge`,
    provider: 'ffmpeg',
    model: 'ffmpeg-concat-h264-aac',
    status: 'processing',
    scenes: JSON.stringify(videos),
    createdAt: ts,
  })
  const mergeId = getInsertId(res)

  // 异步执行
  doMerge(mergeId, episodeId, videos).catch(async err => {
    logTaskError('MergeTask', 'episode-merge', { mergeId, episodeId, error: err.message })
    console.error(`[Merge] Failed:`, err)
    await db.update(schema.videoMerges)
      .set({ status: 'failed', errorMsg: err.message })
      .where(eq(schema.videoMerges.id, mergeId))
  })

  return mergeId
}

/** ffprobe 读取单镜头编码信息；读取失败返回 null（视为不一致，走重编码兜底） */
function probeClip(filePath: string): Promise<{
  vCodec: string; width: number; height: number; fps: number; hasAudio: boolean; aCodec: string
} | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata?.streams) { resolve(null); return }
      const video = metadata.streams.find(s => s.codec_type === 'video')
      const audio = metadata.streams.find(s => s.codec_type === 'audio')
      if (!video) { resolve(null); return }
      resolve({
        vCodec: video.codec_name || '',
        width: Number(video.width) || 0,
        height: Number(video.height) || 0,
        fps: parseFrameRate(video.avg_frame_rate),
        hasAudio: Boolean(audio),
        aCodec: audio?.codec_name || '',
      })
    })
  })
}

/** '30000/1001' → 29.97；解析失败返回 0 */
function parseFrameRate(raw: string | undefined): number {
  if (!raw) return 0
  const parts = String(raw).split('/')
  const num = Number(parts[0])
  const den = Number(parts[1])
  if (!Number.isFinite(num) || !den) return 0
  return Math.round((num / den) * 100) / 100
}

async function doMerge(mergeId: number, episodeId: number, videos: string[]) {
  const listDir = path.join(STORAGE_ROOT, 'temp')
  fs.mkdirSync(listDir, { recursive: true })
  const listPath = path.join(listDir, `${uuid()}.txt`)
  const outputDir = path.join(STORAGE_ROOT, 'merged')
  fs.mkdirSync(outputDir, { recursive: true })
  const outputFilename = `${uuid()}.mp4`
  const outputPath = path.join(outputDir, outputFilename)

  try {
    const listContent = videos
      .map(v => `file '${toAbsPath(v)}'`)
      .join('\n')
    fs.writeFileSync(listPath, listContent, 'utf-8')

    // 一致性预检：所有镜头编码(均 h264)/分辨率/帧率一致、音频全 aac（或无音频）
    // → -c copy 秒级快速拼接；任一不一致才全量重编码，避免拼接产物卡顿/音画不同步
    const probes = await Promise.all(videos.map(v => probeClip(toAbsPath(v))))
    const first = probes[0]
    let consistent = false
    if (probes.length === videos.length && first) {
      const all = probes.filter((p): p is NonNullable<typeof p> => p !== null)
      consistent = all.length === probes.length
        && all.every(p => p.vCodec === first.vCodec && p.width === first.width && p.height === first.height && p.fps === first.fps)
        && all.every(p => !p.hasAudio || p.aCodec === 'aac')
    }
    const useCopy = consistent && first?.vCodec === 'h264'

    logTaskProgress('MergeTask', 'probe', {
      mergeId,
      clips: videos.length,
      consistent,
      mode: useCopy ? 'copy' : 'reencode',
      codec: first?.vCodec || 'unknown',
      resolution: first ? `${first.width}x${first.height}` : 'unknown',
    })

    await new Promise<void>((resolve, reject) => {
      // setTimeout 是 fluent-ffmpeg 的运行时方法（@types 缺失），用 any 桥接
      const command: any = (ffmpeg() as any)
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(useCopy
          // 快路径：流复制，不重新编码
          ? ['-fflags', '+genpts', '-c', 'copy', '-movflags', '+faststart']
          // 兜底：全量重编码（veryfast 起步，兼顾速度与体积）
          : ['-fflags', '+genpts', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
            '-c:a', 'aac', '-ar', '48000', '-b:a', '192k', '-movflags', '+faststart'])
        .output(outputPath)
        .setTimeout(30 * 60_000) // 超时 30 分钟（fluent-ffmpeg 会 kill 进程并触发 timeout/error）
        .on('end', () => resolve())
        .on('timeout', () => reject(new Error('ffmpeg merge timed out after 30 minutes')))
        .on('error', (err: any) => reject(err))
      command.run()
    })

    // 成功：清理列表文件，更新成片记录
    try { fs.unlinkSync(listPath) } catch {}

    const duration = await getVideoDuration(outputPath)
    const mergedRelative = `static/merged/${outputFilename}`
    await extractVideoPoster(mergedRelative)

    await db.update(schema.videoMerges)
      .set({ status: 'completed', mergedUrl: mergedRelative, duration, completedAt: now() })
      .where(eq(schema.videoMerges.id, mergeId))
    await db.update(schema.episodes)
      .set({ videoUrl: mergedRelative, updatedAt: now() })
      .where(eq(schema.episodes.id, episodeId))

    logTaskSuccess('MergeTask', 'episode-merge', {
      mergeId, episodeId, output: mergedRelative, duration, clips: videos.length,
      mode: useCopy ? 'copy' : 'reencode',
    })
  } catch (err) {
    // 失败清理：concat 列表与半成品输出都要删，避免 temp/ 与 merged/ 持续堆积
    try { fs.unlinkSync(listPath) } catch {}
    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath) } catch {}
    }
    throw err
  }
}

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) { resolve(0); return }
      resolve(Math.round(metadata.format.duration || 0))
    })
  })
}
