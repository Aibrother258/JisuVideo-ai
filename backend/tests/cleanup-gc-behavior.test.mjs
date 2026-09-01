/**
 * 存储清理 GC 回归测试
 *
 * 覆盖：
 * - 缩略图 `uuid_thumb.webp` 与主图 `uuid.png`（不同扩展名）的 stem 保留关系
 * - 视频海报 `uuid_poster.jpg` 与主视频 `uuid.mp4` 的 stem 保留关系
 * - 孤儿文件（超 TTL 且无引用）删除；派生文件主文件不存在时一并回收
 *
 * 通过注入 referencedPaths 跳过 DB 查询，用临时目录隔离文件系统。
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-gc-'))
const storageRoot = path.join(tmpRoot, 'static')
const OLD = new Date(Date.now() - 40 * 24 * 3600_000)

function writeOld(rel) {
  const p = path.join(storageRoot, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, 'x')
  fs.utimesSync(p, OLD, OLD)
}

function writeFresh(rel) {
  const p = path.join(storageRoot, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, 'x')
}

let runStorageCleanup

before(async () => {
  process.env.STORAGE_PATH = storageRoot
  // 模块顶层按 STORAGE_PATH 计算存储根，须在 import 前设置
  ;({ runStorageCleanup } = await import('../src/utils/cleanup.ts'))

  // —— 图片组：主图被引用，缩略图同 stem 保留 ——
  writeOld('images/keep-main.png')
  writeOld('images/keep-main_thumb.webp')
  // —— 视频组：主视频被引用，海报同 stem 保留 ——
  writeOld('videos/keep-video.mp4')
  writeOld('videos/keep-video_poster.jpg')
  // —— 孤儿：主文件无引用且超龄 ——
  writeOld('images/orphan-old.png')
  writeOld('videos/orphan-old.mp4')
  // —— 孤儿派生：主文件不存在，派生文件应被回收 ——
  writeOld('images/orphan_thumb.webp')
  writeOld('videos/orphan_poster.jpg')
  // —— temp：旧列表删除、新列表保留 ——
  writeOld('temp/stale-list.txt')
  writeFresh('temp/fresh-list.txt')
})

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true })
})

test('GC 保留被引用主文件及其缩略图/海报（同 stem 任意扩展名）', async () => {
  const referenced = new Set([
    'static/images/keep-main.png',
    'static/videos/keep-video.mp4',
  ])
  const report = await runStorageCleanup({ referencedPaths: referenced, dryRun: false })

  assert.equal(report.orphan_removed, 4, '应删除 4 个孤儿/孤儿派生文件')
  assert.equal(report.temp_removed, 1, '应删除 1 个过期 temp 文件')
  assert.equal(fs.existsSync(path.join(storageRoot, 'images/keep-main.png')), true, '被引用主图保留')
  assert.equal(fs.existsSync(path.join(storageRoot, 'images/keep-main_thumb.webp')), true, '缩略图(主图存在)保留')
  assert.equal(fs.existsSync(path.join(storageRoot, 'videos/keep-video.mp4')), true, '被引用主视频保留')
  assert.equal(fs.existsSync(path.join(storageRoot, 'videos/keep-video_poster.jpg')), true, '海报(主视频存在)保留')

  assert.equal(fs.existsSync(path.join(storageRoot, 'images/orphan-old.png')), false, '孤儿图片删除')
  assert.equal(fs.existsSync(path.join(storageRoot, 'videos/orphan-old.mp4')), false, '孤儿视频删除')
  assert.equal(fs.existsSync(path.join(storageRoot, 'images/orphan_thumb.webp')), false, '无主文件缩略图回收')
  assert.equal(fs.existsSync(path.join(storageRoot, 'videos/orphan_poster.jpg')), false, '无主文件海报回收')

  assert.equal(fs.existsSync(path.join(storageRoot, 'temp/stale-list.txt')), false, '过期 temp 文件删除')
  assert.equal(fs.existsSync(path.join(storageRoot, 'temp/fresh-list.txt')), true, '新鲜 temp 文件保留')
})

test('dry-run 模式不删除任何文件', async () => {
  fs.writeFileSync(path.join(storageRoot, 'images/dry-run-target.png'), 'x')
  fs.utimesSync(path.join(storageRoot, 'images/dry-run-target.png'), OLD, OLD)
  const report = await runStorageCleanup({ referencedPaths: new Set(), dryRun: true })
  assert.equal(report.orphan_removed, 0, 'dry-run 不落盘删除')
  assert.ok(report.orphan_skipped_dry_run >= 1, 'dry-run 计入跳过数')
  assert.equal(fs.existsSync(path.join(storageRoot, 'images/dry-run-target.png')), true, 'dry-run 目标仍在')
  fs.unlinkSync(path.join(storageRoot, 'images/dry-run-target.png'))
})
