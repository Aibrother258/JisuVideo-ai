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
