/**
 * 拼接快路径与超时回归测试
 *
 * 覆盖 Bugbot 反馈的两个问题：
 * - P0：fluent-ffmpeg 2.1.3 无实例 setTimeout 方法（此前会在 run() 前 TypeError）；
 *      超时改为构造器选项 { timeout }（秒），并做真实 ffmpeg concat 冒烟验证。
 * - P1：-c copy 快路径会静默丢失后续片段音频；新增音频布局一致性判定
 *      （全无声 / 全 aac 同采样率同声道），「静音 + AAC」混排必须走重编码。
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ffmpegBin = require('ffmpeg-static')
const mergeService = fs.readFileSync(new URL('../src/services/ffmpeg-merge.ts', import.meta.url), 'utf8')
const { decideConcatStrategy, normalizeClip } = await import('../src/services/ffmpeg-merge.ts')
const { ffmpeg, checkFfmpegSuite } = await import('../src/utils/ffmpeg.ts')

const P = (over) => ({ vCodec: 'h264', width: 320, height: 240, fps: 30, sampleRate: 0, channels: 0, ...over })

let suiteOk = false
before(async () => {
  try {
    const suite = await checkFfmpegSuite()
    suiteOk = suite.ffmpeg && suite.ffprobe
  } catch {
    suiteOk = false
  }
})

// ─── 1) 拼接策略决策（纯函数）──────────────────────────────

test('全 h264 无声 → copy 快路径', () => {
  assert.equal(decideConcatStrategy([P({ hasAudio: false }), P({ hasAudio: false })]), 'copy')
})

test('全 h264/aac 同采样率同声道 → copy 快路径', () => {
  const a = P({ hasAudio: true, aCodec: 'aac', sampleRate: 48000, channels: 2 })
  assert.equal(decideConcatStrategy([a, { ...a }]), 'copy')
})

test('静音 + AAC 混排 → reencode（否则后段音频被 copy 静默丢弃）', () => {
  const silent = P({ hasAudio: false })
  const withAudio = P({ hasAudio: true, aCodec: 'aac', sampleRate: 48000, channels: 2 })
  assert.equal(decideConcatStrategy([silent, withAudio]), 'reencode')
  assert.equal(decideConcatStrategy([withAudio, silent]), 'reencode')
})

test('音频编码不一致 / 采样率不一致 / 声道不一致 → reencode', () => {
  const base = P({ hasAudio: true, aCodec: 'aac', sampleRate: 48000, channels: 2 })
  assert.equal(decideConcatStrategy([base, P({ hasAudio: true, aCodec: 'mp3', sampleRate: 48000, channels: 2 })]), 'reencode')
  assert.equal(decideConcatStrategy([base, P({ hasAudio: true, aCodec: 'aac', sampleRate: 44100, channels: 2 })]), 'reencode')
  assert.equal(decideConcatStrategy([base, P({ hasAudio: true, aCodec: 'aac', sampleRate: 48000, channels: 1 })]), 'reencode')
})

test('分辨率/帧率/编码不一致 或 探测失败 → reencode', () => {
  const base = P({ hasAudio: false })
  assert.equal(decideConcatStrategy([base, P({ width: 640 })]), 'reencode')
  assert.equal(decideConcatStrategy([base, P({ fps: 60 })]), 'reencode')
  assert.equal(decideConcatStrategy([base, P({ vCodec: 'hevc' })]), 'reencode')
  assert.equal(decideConcatStrategy([base, null]), 'reencode')
  assert.equal(decideConcatStrategy([null]), 'reencode')
  assert.equal(decideConcatStrategy([]), 'reencode')
})

// ─── 2) 源码防回归：构造器 timeout，不再调用实例 setTimeout ──

test('merge 使用构造器 timeout 选项而非实例 setTimeout', () => {
  assert.match(mergeService, /ffmpeg\(undefined,\s*\{\s*timeout:\s*30\s*\*\s*60\s*\}\)/)
  assert.doesNotMatch(mergeService, /\.setTimeout\(/)
  assert.match(mergeService, /decideConcatStrategy\(/)
})

// ─── 3) 真实 ffmpeg 拼接冒烟（ffmpeg 可用时）────────────────

function probeStreams(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) reject(err)
      else resolve(meta?.streams || [])
    })
  })
}

/** lavfi 源用 ffmpeg-static CLI 直接生成（fluent-ffmpeg 对 lavfi 输入格式有校验限制） */
function makeClip(outPath, { withAudio }) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  return new Promise((resolve, reject) => {
    const args = ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=0.5']
    if (withAudio) args.push('-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5')
    args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p')
    if (withAudio) args.push('-c:a', 'aac', '-ar', '48000')
    args.push(outPath)
    const child = spawn(ffmpegBin, args, { windowsHide: true })
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))))
  })
}

function concat(listPath, outPath, useCopy) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(undefined, { timeout: 120 })
      .input(listPath).inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(useCopy
        ? ['-fflags', '+genpts', '-c', 'copy']
        : ['-fflags', '+genpts', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-ar', '48000'])
      .output(outPath)
    cmd.on('end', () => resolve()).on('error', reject).run()
  })
}

test('真实拼接：静音+AAC 混排判定 reencode，经归一化补音轨后产物保留音频', async (t) => {
  if (!suiteOk) return t.skip('ffmpeg/ffprobe 不可用，跳过真实拼接')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-fp-'))
  try {
    const silent = path.join(dir, 'silent.mp4')
    const withAudio = path.join(dir, 'withaudio.mp4')
    await makeClip(silent, { withAudio: false })
    await makeClip(withAudio, { withAudio: true })

    // 决策：静音 + AAC → reencode（否则 -c copy 会把后段音频静默丢弃）
    const probes = []
    for (const f of [silent, withAudio]) {
      const streams = await probeStreams(f)
      const video = streams.find(s => s.codec_type === 'video')
      const audio = streams.find(s => s.codec_type === 'audio')
      probes.push({
        vCodec: video?.codec_name || '',
        width: Number(video?.width) || 0,
        height: Number(video?.height) || 0,
        fps: 30,
        hasAudio: Boolean(audio),
        aCodec: audio?.codec_name || '',
        sampleRate: Number(audio?.sample_rate) || 0,
        channels: Number(audio?.channels) || 0,
      })
    }
    assert.equal(decideConcatStrategy(probes), 'reencode', '静音+AAC 混排应判定重编码')

    // 兜底路径：逐片段归一化（无声片段补静音音轨），再流复制拼接
    const normSilent = path.join(dir, 'norm-silent.mp4')
    const normAudio = path.join(dir, 'norm-audio.mp4')
    await normalizeClip(silent, normSilent, { width: 320, height: 240, fps: 30, hasAudio: false })
    await normalizeClip(withAudio, normAudio, { width: 320, height: 240, fps: 30, hasAudio: true })

    const list = path.join(dir, 'list.txt')
    fs.writeFileSync(list, `file '${normSilent}'\nfile '${normAudio}'\n`, 'utf8')
    const out = path.join(dir, 'merged-reencode.mp4')
    await concat(list, out, true)

    const outStreams = await probeStreams(out)
    assert.ok(outStreams.some(s => s.codec_type === 'video'), '输出含视频流')
    assert.ok(outStreams.some(s => s.codec_type === 'audio'), '输出含音频流（后段音频未被丢弃）')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('真实拼接：全 aac 一致片段走 -c copy 成功', async (t) => {
  if (!suiteOk) return t.skip('ffmpeg/ffprobe 不可用，跳过真实拼接')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-copy-'))
  try {
    const a = path.join(dir, 'a.mp4')
    const b = path.join(dir, 'b.mp4')
    await makeClip(a, { withAudio: true })
    await makeClip(b, { withAudio: true })

    const list = path.join(dir, 'list.txt')
    fs.writeFileSync(list, `file '${a}'\nfile '${b}'\n`, 'utf8')
    const out = path.join(dir, 'merged-copy.mp4')
    await concat(list, out, true)
    assert.ok(fs.existsSync(out) && fs.statSync(out).size > 0, 'copy 拼接输出存在且非空')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
