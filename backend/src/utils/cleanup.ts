/**
 * 存储清理 — 防磁盘无限增长
 *
 * 1. temp/ 目录 TTL：清理 ffmpeg concat 列表等过期临时文件
 * 2. 孤儿文件 GC：删除 images/videos/uploads/merged 下「未被 DB 引用」且超过 TTL 的文件
 *    （生成产物被删除/失败半成品/已弃用上传等都会沦为孤儿）
 *
 * 引用集来自各业务表的 URL/路径字段（static/... 相对路径），避免误删在用数据。
 * 缩略图(_thumb.webp)与海报帧(_poster.jpg)由主文件派生：主文件不在了才作为孤儿删除。
 *
 * 环境变量（均可选）：
 *   STORAGE_CLEANUP_INTERVAL_HOURS   扫描间隔，默认 24
 *   STORAGE_CLEANUP_TEMP_TTL_HOURS   temp/ 文件保留时长，默认 24
 *   STORAGE_CLEANUP_ORPHAN_TTL_DAYS  孤儿文件保留时长，默认 30
 *   STORAGE_CLEANUP_DRY_RUN          仅报告不删除，默认 false
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { db, schema } from '../db/index.js'
import { logTaskProgress, logTaskSuccess, logTaskWarn } from './task-logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_ROOT = process.env.STORAGE_PATH || path.resolve(__dirname, '../../../data/static')

const INTERVAL_MS = (Number(process.env.STORAGE_CLEANUP_INTERVAL_HOURS) || 24) * 3600_000
const TEMP_TTL_MS = (Number(process.env.STORAGE_CLEANUP_TEMP_TTL_HOURS) || 24) * 3600_000
const ORPHAN_TTL_MS = (Number(process.env.STORAGE_CLEANUP_ORPHAN_TTL_DAYS) || 30) * 24 * 3600_000
const DRY_RUN = process.env.STORAGE_CLEANUP_DRY_RUN === 'true'

/** 扫描的产物目录（temp/ 单独按 TTL 清理） */
const SCAN_SUBDIRS = ['images', 'videos', 'uploads', 'merged']

/** 派生文件后缀：主文件被引用时派生文件天然保留；主文件没了才轮到它被回收 */
const DERIVED_PATTERNS = [/_(thumb\.webp|poster\.jpg)$/]

/** 从 DB 字段文本中提取 static/... 相对路径（可能存 URL、JSON 数组或 dataURL 混排） */
function extractStaticRefs(values: Array<string | null | undefined>): Set<string> {
  const refs = new Set<string>()
  const re = /static\/[A-Za-z0-9_\-/]+(?:\.[A-Za-z0-9]+)?/g
  for (const value of values) {
    if (!value) continue
    const matches = String(value).match(re)
    if (matches) matches.forEach(m => refs.add(m))
  }
  return refs
}

/** 汇总 DB 中所有被引用的 static 相对路径 */
async function collectReferencedPaths(): Promise<Set<string>> {
  const refs = new Set<string>()
  const tables: Array<{ rows: Array<Record<string, string | null | undefined>> }> = []
  const q1 = await db.select({
    url: schema.assets.url, thumbnailUrl: schema.assets.thumbnailUrl, localPath: schema.assets.localPath,
  }).from(schema.assets)
  tables.push({ rows: q1 })
  const q2 = await db.select({
    resultUrl: schema.sysTask.resultUrl, localPath: schema.sysTask.localPath,
  }).from(schema.sysTask)
  tables.push({ rows: q2 })
  const q3 = await db.select({ mergedUrl: schema.videoMerges.mergedUrl }).from(schema.videoMerges)
  tables.push({ rows: q3 })
  const q4 = await db.select({ videoUrl: schema.episodes.videoUrl }).from(schema.episodes)
  tables.push({ rows: q4 })
  const q5 = await db.select({ thumbnail: schema.dramas.thumbnail }).from(schema.dramas)
  tables.push({ rows: q5 })
  const q6 = await db.select({
    imageUrl: schema.characters.imageUrl, referenceImages: schema.characters.referenceImages, localPath: schema.characters.localPath,
  }).from(schema.characters)
  tables.push({ rows: q6 })
  const q7 = await db.select({ imageUrl: schema.scenes.imageUrl, localPath: schema.scenes.localPath }).from(schema.scenes)
  tables.push({ rows: q7 })
  const q8 = await db.select({
    imageUrl: schema.props.imageUrl, referenceImages: schema.props.referenceImages, localPath: schema.props.localPath,
  }).from(schema.props)
  tables.push({ rows: q8 })
  const q9 = await db.select({
    videoUrl: schema.storyboards.videoUrl, firstFrameImage: schema.storyboards.firstFrameImage,
    lastFrameImage: schema.storyboards.lastFrameImage, composedImage: schema.storyboards.composedImage,
    referenceImages: schema.storyboards.referenceImages, subtitleUrl: schema.storyboards.subtitleUrl,
    composedVideoUrl: schema.storyboards.composedVideoUrl,
  }).from(schema.storyboards)
  tables.push({ rows: q9 })
  const q10 = await db.select({ url: schema.storyboardReferenceAssets.url }).from(schema.storyboardReferenceAssets)
  tables.push({ rows: q10 })

  for (const table of tables) {
    for (const row of table.rows) {
      for (const ref of extractStaticRefs(Object.values(row))) refs.add(ref)
    }
  }
  return refs
}

/** 判断文件名是否是派生文件（缩略图/海报帧），是则返回对应主文件名（不含后缀） */
function derivedBaseName(filename: string): string | null {
  for (const re of DERIVED_PATTERNS) {
    const m = filename.match(re)
    if (m) return filename.slice(0, -m[0].length)
  }
  return null
}

export interface CleanupReport {
  temp_removed: number
  orphan_removed: number
  orphan_skipped_dry_run: number
  scanned_files: number
}

/** 单次清理：返回删除统计 */
export async function runStorageCleanup(): Promise<CleanupReport> {
  const report: CleanupReport = { temp_removed: 0, orphan_removed: 0, orphan_skipped_dry_run: 0, scanned_files: 0 }
  if (!fs.existsSync(STORAGE_ROOT)) return report

  // 1) temp/ TTL
  const tempDir = path.join(STORAGE_ROOT, 'temp')
  if (fs.existsSync(tempDir)) {
    for (const entry of fs.readdirSync(tempDir)) {
      const filePath = path.join(tempDir, entry)
      let stat: fs.Stats | null = null
      try { stat = fs.statSync(filePath) } catch { continue }
      if (!stat.isFile()) continue
      if (Date.now() - stat.mtimeMs > TEMP_TTL_MS) {
        if (DRY_RUN) report.orphan_skipped_dry_run++
        else {
          try { fs.unlinkSync(filePath); report.temp_removed++ } catch (err) { logTaskWarn('Cleanup', 'temp-remove-failed', { file: filePath, error: (err as Error).message }) }
        }
      }
    }
  }

  // 2) 孤儿文件 GC
  const referenced = await collectReferencedPaths()
  for (const subDir of SCAN_SUBDIRS) {
    const dirPath = path.join(STORAGE_ROOT, subDir)
    if (!fs.existsSync(dirPath)) continue
    for (const entry of fs.readdirSync(dirPath)) {
      const filePath = path.join(dirPath, entry)
      let stat: fs.Stats | null = null
      try { stat = fs.statSync(filePath) } catch { continue }
      if (!stat.isFile()) continue
      report.scanned_files++
      const relPath = `static/${subDir}/${entry}`

      // 被 DB 引用 → 保留
      if (referenced.has(relPath)) continue
      // 派生文件：主文件仍存在 → 保留（主文件作为孤儿被删后，派生文件下轮回收）
      const baseName = derivedBaseName(entry)
      if (baseName) {
        const mainExists = fs.existsSync(path.join(dirPath, baseName))
        if (mainExists) continue
      }

      if (Date.now() - stat.mtimeMs <= ORPHAN_TTL_MS) continue
      if (DRY_RUN) report.orphan_skipped_dry_run++
      else {
        try { fs.unlinkSync(filePath); report.orphan_removed++ } catch (err) { logTaskWarn('Cleanup', 'orphan-remove-failed', { file: filePath, error: (err as Error).message }) }
      }
    }
  }
  return report
}

/** 启动定时清理（立即执行一次 + 按间隔循环） */
export function startStorageCleanup(): void {
  const run = async () => {
    try {
      const startedAt = Date.now()
      const report = await runStorageCleanup()
      logTaskSuccess('Cleanup', 'run', {
        mode: DRY_RUN ? 'dry-run' : 'delete',
        durationMs: Date.now() - startedAt,
        tempRemoved: report.temp_removed,
        orphanRemoved: report.orphan_removed,
        scanned: report.scanned_files,
      })
    } catch (err) {
      logTaskWarn('Cleanup', 'run-failed', { error: (err as Error).message })
    }
  }
  void run()
  setInterval(run, INTERVAL_MS)
}
