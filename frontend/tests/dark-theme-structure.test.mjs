import { readFileSync, existsSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const exists = (path) => existsSync(new URL(path, root))

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

test('C4 P1-1 batch: built SPA html embeds the theme bootstrap before entry resources (dist check)', { skip: !exists('.output/server/chunks/routes/renderer.mjs') }, () => {
  const dist = read('.output/server/chunks/routes/renderer.mjs')
  const boot = dist.indexOf("setAttribute('data-theme'")
  assert.ok(boot >= 0, 'built renderer should embed the bootstrap script')
  // bootstrap 在 html <head> 中作为内联同步脚本先执行；入口资源引用必须在其后
  const entry = dist.indexOf('/_nuxt/')
  if (entry >= 0) assert.ok(boot < entry, `bootstrap (${boot}) must precede entry script (${entry})`)
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
