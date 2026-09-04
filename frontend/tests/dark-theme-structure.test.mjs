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
  for (const token of ['--surface-paper', '--surface-paper-warm', '--glass-hover', '--dot-idle', '--accent-border', '--sel', '--sel-bg', '--sel-text', '--sel-glow']) {
    assert.match(css, new RegExp(`${token}:`), `${token} light value should exist`)
    assert.match(dark[1], new RegExp(`${token}:`), `${token} dark value should exist`)
  }
})

test('C4 P1-1 batch: first-frame bootstrap lives in nuxt.config static head (not runtime app.vue useHead)', () => {
  const cfg = read('nuxt.config.ts')
  // bootstrap 源码来自 theme-core，经 app.head.script 内联进 SPA HTML <head>
  assert.match(cfg, /import \{ themeBootstrapScript \} from '\.\/app\/utils\/theme-core\.mjs'/)
  assert.match(cfg, /script: \[\{ innerHTML: themeBootstrapScript \}\]/)
  // app.vue 不再运行时注入（SSR:false 下 useHead 注入发生在客户端启动后，首帧已用亮色绘制过）
  const app = read('app/app.vue')
  assert.doesNotMatch(app, /prefers-color-scheme|ui-theme/)
  // 运行时跟随由 client plugin 承担，暴露 useTheme
  assert.match(read('app/plugins/theme.client.ts'), /createThemeController/)
  assert.match(read('app/composables/useTheme.ts'), /setTheme/)
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

test('C4-B1 batch: episode.vue literals tokenized; local .studio --sel vars removed (globalized)', () => {
  const ep = read('app/views/drama/episode.vue')
  assert.doesNotMatch(ep, /rgba\(0,0,0,0\.09\)/)
  assert.doesNotMatch(ep, /rgba\(0,0,0,0\.14\)/)
  assert.doesNotMatch(ep, /rgba\(0,113,227,0\.25\)/)
  assert.match(ep, /var\(--dot-idle\)/)
  assert.match(ep, /var\(--accent-border\)/)
  assert.match(ep, /var\(--fill-hover\)/)
  // P2-4：.studio 不再遮蔽全局 --sel*（否则根级 dark 覆盖无效）
  assert.doesNotMatch(ep, /--sel: #5856d6/)
  assert.doesNotMatch(ep, /--sel-text: #4240b0/)
  // 组件仍消费全局 token
  assert.match(ep, /var\(--sel\)/)
})

test('C4 P2-5 batch: settings.vue skill error uses semantic tokens (no light paper)', () => {
  const s = read('app/pages/settings.vue')
  assert.doesNotMatch(s, /#fdf1f0|#f0c0bb/)
  assert.match(s, /border: 1px solid var\(--error-outline\); background: var\(--error-bg\)/)
})

test('C4-B2 batch: localized semantic colors globalized (danger hover + shadow leftovers), no raw literals', () => {
  const css = read('app/assets/studio.css')
  const dark = css.match(/:root\[data-theme='dark'\] \{\r?\n([\s\S]*?)\r?\n\}/m)[1]
  for (const token of ['--action-danger-hover', '--shadow-hover', '--shadow-menu', '--shadow-viewer', '--solid-ink']) {
    assert.match(css, new RegExp(`${token}:`), `${token} light value should exist`)
    assert.match(dark, new RegExp(`${token}:`), `${token} dark value should exist`)
  }
  // 消费点改引用、字面量清零（A2 §5.1 遗留：ConfirmDialog #d70015、ModelSelect 弹层投影、
  // episode .frame-thumb:hover / .image-viewer-img 投影）
  const confirm = read('app/components/ConfirmDialog.vue')
  assert.doesNotMatch(confirm, /#d70015/)
  assert.match(confirm, /var\(--action-danger-hover\)/)
  const model = read('app/components/ModelSelect.vue')
  assert.doesNotMatch(model, /rgba\(0,0,0,0\.1[46]\)/)
  assert.match(model, /var\(--shadow-menu\)/)
  const ep = read('app/views/drama/episode.vue')
  assert.doesNotMatch(ep, /0 2px 8px rgba\(0,0,0,0\.2\)/)
  assert.doesNotMatch(ep, /0 18px 48px rgba\(0,0,0,0\.18\)/)
  assert.match(ep, /var\(--shadow-hover\)/)
  assert.match(ep, /var\(--shadow-viewer\)/)
  // 反色实心块（filter-chip 激活 / 步骤指示 / logo 方块）改 --solid-ink：
  // --text-0 在 dark 反白，若仍作底会出现白字白底
  for (const f of ['app/pages/index.vue', 'app/layouts/default.vue']) {
    const src = read(f)
    assert.doesNotMatch(src, /background: var\(--text-0\)/, `${f} must not paint solid blocks with --text-0`)
  }
  assert.match(read('app/pages/index.vue'), /background: var\(--solid-ink\)/)
  assert.match(read('app/layouts/default.vue'), /background: var\(--solid-ink\)/)
})

test('C4-B2 batch: every light color token has a dark override unless intentionally unchanged (media/white-on-color)', () => {
  const css = read('app/assets/studio.css')
  const rootBlock = css.match(/^:root \{\r?\n([\s\S]*?)\r?\n\}/m)[1]
  const darkBlock = css.match(/:root\[data-theme='dark'\] \{\r?\n([\s\S]*?)\r?\n\}/m)[1]
  const isColor = (v) => /#[0-9a-fA-F]{3,8}\b|rgba?\(|linear-gradient\(/.test(v)
  const light = new Map()
  for (const m of rootBlock.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) light.set(m[1], m[2].trim())
  const darkSet = new Set([...darkBlock.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]))
  // 有意不变：媒体深色画布/遮罩、媒体白字、彩底白字、封面白字（明暗通用，见 spec §3.1.5）
  const intentionally = new Set([
    'action-primary-text', 'cover-text', 'text-invert',
    'media-stage-bg', 'media-scrim-soft', 'media-scrim', 'media-scrim-strong',
    'media-text', 'media-text-dim',
  ])
  const missing = []
  for (const [name, value] of light) {
    if (value.includes('var(')) continue // 复合引用自动跟随基底 token
    if (!isColor(value)) continue        // 非颜色 token（sp/radius/dur/font 等）
    if (darkSet.has(name)) continue
    if (intentionally.has(name)) continue
    missing.push(name)
  }
  assert.deepEqual(missing, [], 'color tokens missing a dark override must be added to the overlay or the explicit exempt list')
})
