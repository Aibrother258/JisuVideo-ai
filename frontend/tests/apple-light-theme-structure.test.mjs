import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const studioCss = read('../app/assets/studio.css')
const layout = read('../app/layouts/default.vue')
const surfaces = [
  studioCss,
  layout,
  read('../app/pages/index.vue'),
  read('../app/views/drama/detail.vue'),
  read('../app/views/drama/episode.vue'),
  read('../app/pages/settings.vue'),
].join('\n')

test('apple light theme exposes the selected neutral and system-blue tokens', () => {
  assert.match(studioCss, /--surface-base:\s*#f5f5f7/i)
  assert.match(studioCss, /--surface-raised:\s*#ffffff/i)
  assert.match(studioCss, /--accent:\s*#0071e3/i)
  assert.match(studioCss, /--success:\s*#34c759/i)
  assert.match(studioCss, /--font-body:\s*-apple-system,\s*BlinkMacSystemFont,\s*'SF Pro Text'/)
})

test('core surfaces remove the old film-console and graphite decoration', () => {
  assert.doesNotMatch(surfaces, /#d96f27|rgba\(217\s*,\s*111\s*,\s*39/i)
  assert.doesNotMatch(surfaces, /repeating-linear-gradient/i)
  assert.doesNotMatch(surfaces, /#15171a|#1c1f23|#20242a|#30343a/i)
  assert.doesNotMatch(surfaces, /#4c8dff|rgba\(76\s*,\s*141\s*,\s*255/i)
})

test('A1 token batch4: badge/on-dark/panel whites resolve to tokens across core files', () => {
  const settings = read('../app/pages/settings.vue')
  const dialog = read('../app/components/ConfirmDialog.vue')
  const layout = read('../app/layouts/default.vue')
  const detail = read('../app/views/drama/detail.vue')
  // 徽标方形投影 token（cap-badge / style-detail-badge / provider-badge 三处同值）
  assert.match(studioCss, /--shadow-badge: 0 1px 4px rgba\(0,0,0,0\.12\);/)
  // settings：能力/风格/服务徽标白字 + 方形投影
  assert.match(settings, /\.cap-badge[\s\S]*?color: var\(--text-invert\)/)
  assert.match(settings, /box-shadow: var\(--shadow-badge\);/)
  assert.match(settings, /\.cfg-model-check \{ color: var\(--text-invert\);/)
  // ConfirmDialog：危险按钮白字（反色文字）
  assert.match(dialog, /\.confirm-danger-btn[\s\S]*?color: var\(--text-invert\)/)
  // default：品牌字标深块反色白字 + 导航激活段白底
  assert.match(layout, /\.brand-fallback[\s\S]*?color: var\(--text-invert\)/)
  assert.match(layout, /\.nav-link\.active[\s\S]*?background: var\(--surface-raised\)/)
  // detail：页内审阅卡与分集 Tab 选中态白底
  assert.match(detail, /\.episode-inline-review[\s\S]*?background: var\(--surface-raised\)/)
  assert.match(detail, /\.episode-detail-tab\.on[\s\S]*?background: var\(--surface-raised\)/)
  // 批次内 #fff 字面量清零（单文件 amber 横幅体系 #fffbeb 等留待 A2 色板统一）
  for (const src of [settings, dialog, layout, detail]) assert.doesNotMatch(src, /color: #fff/)
  assert.doesNotMatch(settings, /rgba\(0, 0, 0, 0\.12\)/)
})

test('A1 token batch5: episode player dark stage / on-media whites / status outlines resolve to tokens', () => {
  const episode = read('../app/views/drama/episode.vue')
  // 媒体深色台面 token（letterbox 底 #0b0d10×4：历史缩略图 / 播放舞台 / merge 卡视频 / exp 缩略图）
  assert.match(studioCss, /--media-stage-bg: #0b0d10;/)
  assert.match(episode, /\.video-history-item[\s\S]*?background: var\(--media-stage-bg\)/)
  assert.match(episode, /\.video-player-stage[\s\S]*?background: var\(--media-stage-bg\)/)
  assert.match(episode, /\.merge-card video[\s\S]*?background: var\(--media-stage-bg\)/)
  assert.match(episode, /\.exp-thumb[\s\S]*?background: var\(--media-stage-bg\)/)
  // 状态描边：0.30 步骤完成节点 / 0.32 视频任务成功·失败徽标成对描边
  assert.match(studioCss, /--success-border: rgba\(52,199,89,0\.30\);/)
  assert.match(studioCss, /--success-border-strong: rgba\(52,199,89,0\.32\);/)
  assert.match(studioCss, /--warning-border-strong: rgba\(255,159,10,0\.32\);/)
  assert.match(episode, /\.pipe-item\.done \.pipe-icon[\s\S]*?border-color: var\(--success-border\)/)
  assert.match(episode, /\.video-task-metric\.is-done,[\s\S]*?border-color: var\(--success-border-strong\)/)
  assert.match(episode, /\.video-task-status\.is-blocked[\s\S]*?border-color: var\(--warning-border-strong\)/)
  // 深底/彩底白字 → 反色文字 token（播放器叠层、勾选、角标、成功徽标等）
  assert.match(episode, /\.asset-del-btn[\s\S]*?color: var\(--text-invert\)/)
  assert.match(episode, /\.shot-check[\s\S]*?color: var\(--text-invert\)/)
  assert.match(episode, /\.video-history-time[\s\S]*?color: var\(--text-invert\)/)
  assert.match(episode, /\.prod-overlay-badge[\s\S]*?color: var\(--text-invert\)/)
  assert.match(episode, /\.exp-thumb-duration[\s\S]*?color: var\(--text-invert\)/)
  // 白底卡/激活块 → 表面 token；玻璃徽标/浮层 → 既有 glass/float token
  assert.match(episode, /\.stage-subnav-item\.active[\s\S]*?background: var\(--surface-raised\)/)
  assert.match(episode, /\.merge-card[\s\S]*?background: var\(--surface-raised\)/)
  assert.match(episode, /\.asset-cover-badge[\s\S]*?background: var\(--surface-glass\)/)
  // 批次内 #fff 白字白底与深色台面字面量清零（#000/#111/半透明白等单次低价值字面量留待 A2 色板）
  assert.doesNotMatch(episode, /color: #fff/)
  assert.doesNotMatch(episode, /background: #fff/)
  assert.doesNotMatch(episode, /#0b0d10/)
})
