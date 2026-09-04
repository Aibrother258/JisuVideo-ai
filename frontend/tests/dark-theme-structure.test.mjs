import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('C4 batch: studio.css defines dark token overlay block + color-scheme without touching light values', () => {
  const css = read('app/assets/studio.css')
  // :root light 段声明 color-scheme: light
  assert.match(css, /^:root \{\r?\n  color-scheme: light;/m)
  // dark 覆盖块存在（在 :root 之后、组件基础区之前）
  const dark = css.match(/:root\[data-theme='dark'\] \{\r?\n([\s\S]*?)\r?\n\}/m)
  assert.ok(dark, 'dark overlay block :root[data-theme=\'dark\'] should exist')
  assert.match(dark[1], /color-scheme: dark;/)
  // light 锚点值未被改动（回归守卫：亮色观感零变化）
  assert.match(css, /--surface-base: #f5f5f7;/)
  assert.match(css, /--accent: #0071e3;/)
  assert.match(css, /--text-0: #1d1d1f;/)
  // dark 关键值（Apple dark 亮档）
  assert.match(dark[1], /--surface-raised: #1e1e1f;/)
  assert.match(dark[1], /--accent: #0a84ff;/)
  assert.match(dark[1], /--text-0: #f5f5f7;/)
  // C4-B1 新增 token 双态齐备
  for (const token of ['--surface-paper', '--surface-paper-warm', '--glass-hover', '--dot-idle', '--accent-border']) {
    assert.match(css, new RegExp(`${token}:`), `${token} light value should exist`)
    assert.match(dark[1], new RegExp(`${token}:`), `${token} dark value should exist`)
  }
})

test('C4 batch: app.vue injects first-frame theme script (localStorage + prefers-color-scheme, no FOUC)', () => {
  const app = read('app/app.vue')
  assert.match(app, /useHead\(\{/)
  assert.match(app, /script: \[\{/)
  assert.match(app, /localStorage\.getItem\('ui-theme'\)/)
  assert.match(app, /matchMedia\('\(prefers-color-scheme: dark\)'\)/)
  assert.match(app, /setAttribute\('data-theme'/)
})

test('C4-B1 batch: detail.vue paper/glass literals tokenized (no raw hex/white-glass/black-hover leftovers)', () => {
  const det = read('app/views/drama/detail.vue')
  assert.doesNotMatch(det, /#fbfbfd/)
  assert.doesNotMatch(det, /#fbfaf7/)
  assert.doesNotMatch(det, /rgba\(255,255,255,0\.7[02]\)/)
  assert.doesNotMatch(det, /rgba\(0,0,0,0\.09\)/)
  assert.doesNotMatch(det, /color-mix\(in srgb, var\(--\w+\) [\d.]+%, white\)/)
  // token 消费到位
  assert.match(det, /var\(--surface-paper\)/)
  assert.match(det, /var\(--surface-paper-warm\)/)
  assert.match(det, /var\(--glass-hover\)/)
  assert.match(det, /var\(--fill-hover\)/)
})

test('C4-B1 batch: episode.vue jump/bubble dots + back-btn hover tokenized', () => {
  const ep = read('app/views/drama/episode.vue')
  assert.doesNotMatch(ep, /rgba\(0,0,0,0\.09\)/)
  assert.doesNotMatch(ep, /rgba\(0,0,0,0\.14\)/)
  assert.doesNotMatch(ep, /rgba\(0,113,227,0\.25\)/)
  assert.match(ep, /var\(--dot-idle\)/)
  assert.match(ep, /var\(--accent-border\)/)
  assert.match(ep, /var\(--fill-hover\)/)
})
