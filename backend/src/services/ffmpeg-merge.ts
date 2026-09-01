/**
 * FFmpeg 多镜头拼接 — 将所有生成后的镜头视频拼接为一集
 */
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { v4 as uuid } from 'uuid'
import { db, getInsertId, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { now } from '../utils/response.js'
import { logTaskError, logTaskProgress, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'
import { extractVideoPoster } from '../utils/video-poster.js'
import { ffmpeg, checkFfmpegSuite } from '../utils/ffmpeg.js'
import ffmpegPathImport from 'ffmpeg-static'

// ffmpeg-static 类型声明为 string，平台不支持时为 null
const ffmpegPath = ffmpegPathImport as string | null

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

export interface ProbeInfo {
  vCodec: string
  width: number
  height: number
  fps: number
  hasAudio: boolean
  aCodec: string
  sampleRate: number
  channels: number
}

/** ffprobe 读取单镜头编码信息；读取失败返回 null（视为不一致，走重编码兜底） */
function probeClip(filePath: string): Promise<ProbeInfo | null> {
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
        sampleRate: Number(audio?.sample_rate) || 0,
        channels: Number(audio?.channels) || 0,
      })
    })
  })
}

/**
 * 决定拼接策略：仅当全部镜头视频编码(均 h264)/分辨率/帧率一致，
 * 且音频布局一致（全无声，或全有声音频同为 aac 且采样率/声道一致）时才允许 -c copy。
 * 任一不一致退回重编码——特别是「首段无声 + 后段有声音频」混排时，
 * -c copy 会把后段音频悄悄丢弃，必须走重编码/滤镜路径。
 */
export function decideConcatStrategy(probes: Array<ProbeInfo | null>): 'copy' | 'reencode' {
  if (!probes.length) return 'reencode'
  const first = probes[0]
  if (!first) return 'reencode'
  const all = probes.filter((p): p is ProbeInfo => p !== null)
  if (all.length !== probes.length) return 'reencode'
  if (all.some(p => p.vCodec !== first.vCodec || p.width !== first.width || p.height !== first.height || p.fps !== first.fps)) return 'reencode'
  if (first.vCodec !== 'h264') return 'reencode'

  const allSilent = all.every(p => !p.hasAudio)
  const audioConsistent = all.every(p => p.hasAudio
    && p.aCodec === 'aac'
    && p.sampleRate === first.sampleRate
    && p.channels === first.channels)
  return allSilent || audioConsistent ? 'copy' : 'reencode'
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
  // 归一化产生的临时文件（成功/失败都要清理）
  const tempFiles: string[] = []

  try {
    const listContent = videos
      .map(v => `file '${toAbsPath(v)}'`)
      .join('\n')
    fs.writeFileSync(listPath, listContent, 'utf-8')

    // 一致性预检：所有镜头编码(均 h264)/分辨率/帧率一致 + 音频布局一致（全无声，
    // 或全 aac 同采样率/声道）→ -c copy 秒级快速拼接；任一不一致才走兜底路径，
    // 避免拼接产物卡顿/音画不同步/后段音频被 copy 静默丢弃
    const probes = await Promise.all(videos.map(v => probeClip(toAbsPath(v))))
    const strategy = decideConcatStrategy(probes)
    const first = probes[0]

    // concat 实际执行模式：归一化后统一规格即可流复制
    let concatMode: 'copy' | 'reencode' = strategy
    if (strategy === 'reencode' && first) {
      // 兜底：逐片段归一化——统一 h264/分辨率/帧率/音频布局（无声片段补静音音轨）。
      // concat demuxer 要求各输入流布局一致，「静音 + AAC」混排不补轨会静默丢音频；
      // 分辨率/帧率不一致直接拼接会花屏或变速。
      for (let i = 0; i < videos.length; i++) {
        const normPath = path.join(listDir, `${uuid()}.mp4`)
        await normalizeClip(toAbsPath(videos[i]), normPath, {
          width: first.width || 320,
          height: first.height || 240,
          fps: first.fps || 30,
          hasAudio: Boolean(probes[i]?.hasAudio),
        })
        tempFiles.push(normPath)
      }
      const normalizedList = tempFiles.map(f => `file '${f}'`).join('\n')
      fs.writeFileSync(listPath, normalizedList, 'utf-8')
      concatMode = 'copy' // 已统一规格，直接流复制
    }
    const useCopy = concatMode === 'copy'

    logTaskProgress('MergeTask', 'probe', {
      mergeId,
      clips: videos.length,
      consistent: strategy === 'copy',
      mode: strategy,
      codec: first?.vCodec || 'unknown',
      resolution: first ? `${first.width}x${first.height}` : 'unknown',
    })

    await new Promise<void>((resolve, reject) => {
      // fluent-ffmpeg 2.1.3 没有实例 setTimeout 方法；timeout 是构造器选项（单位：秒），
      // 超时时库内部会 kill 进程并走 error 事件（错误消息含 "timeout"）。
      const command = ffmpeg(undefined, { timeout: 30 * 60 })
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(useCopy
          // 快路径：流复制，不重新编码
          ? ['-fflags', '+genpts', '-c', 'copy', '-movflags', '+faststart']
          // 兜底：全量重编码（veryfast 起步，兼顾速度与体积）
          : ['-fflags', '+genpts', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
            '-c:a', 'aac', '-ar', '48000', '-b:a', '192k', '-movflags', '+faststart'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: any) => {
          const msg = String(err?.message || '')
          reject(/timeout/i.test(msg) ? new Error('ffmpeg merge timed out after 30 minutes') : err)
        })
      command.run()
    })

    // 成功：清理列表文件与归一化临时文件，更新成片记录
    try { fs.unlinkSync(listPath) } catch {}
    for (const f of tempFiles) {
      try { fs.unlinkSync(f) } catch {}
    }

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
      mode: strategy,
    })
  } catch (err) {
    // 失败清理：concat 列表、归一化临时文件与半成品输出都要删，避免 temp/ 与 merged/ 持续堆积
    try { fs.unlinkSync(listPath) } catch {}
    for (const f of tempFiles) {
      try { fs.unlinkSync(f) } catch {}
    }
    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath) } catch {}
    }
    throw err
  }
}

/** 用项目内置 ffmpeg-static 二进制执行 CLI 命令（lavfi 源 fluent-ffmpeg 不友好，统一走 spawn） */
function runFfmpegCli(args: string[], errorLabel: string): Promise<void> {
  if (!ffmpegPath) return Promise.reject(new Error('ffmpeg 二进制不可用，无法归一化镜头'))
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${errorLabel} (ffmpeg exit ${code})`))
    })
  })
}

/**
 * 将单个镜头归一化为统一规格：h264 + 目标分辨率/帧率 + aac 48kHz 立体声。
 * 无声片段补一条静音音轨（anullsrc），保证 concat demuxer 各输入流布局一致。
 */
export async function normalizeClip(
  inputPath: string,
  outputPath: string,
  target: { width: number; height: number; fps: number; hasAudio: boolean },
): Promise<void> {
  const args = ['-y', '-i', inputPath]
  if (!target.hasAudio) {
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000')
  }
  args.push(
    '-vf', `scale=${target.width}:${target.height}`,
    '-r', String(target.fps || 30),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-ar', '48000', '-ac', '2',
  )
  if (!target.hasAudio) args.push('-shortest')
  args.push('-movflags', '+faststart', outputPath)
  await runFfmpegCli(args, '镜头归一化失败')
}

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) { resolve(0); return }
      resolve(Math.round(metadata.format.duration || 0))
    })
  })
}
