import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import {
  THEME_STORAGE_KEY,
  themeBootstrapScript,
  parseThemePref,
  resolveTheme,
  readStoredMode,
  writeStoredMode,
  createThemeController,
} from '../app/utils/theme-core.mjs'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('C4 P2-6: parseThemePref resolves three states and falls back to system on invalid/null', () => {
  assert.equal(parseThemePref('light'), 'light')
  assert.equal(parseThemePref('dark'), 'dark')
  assert.equal(parseThemePref('system'), 'system')
  assert.equal(parseThemePref(null), 'system')
  assert.equal(parseThemePref(''), 'system')
  assert.equal(parseThemePref('LIGHT'), 'system')
  assert.equal(parseThemePref('blue'), 'system')
})

test('C4 P2-6: resolveTheme maps mode + system preference to resolved theme', () => {
  assert.equal(resolveTheme('light', true), 'light')
  assert.equal(resolveTheme('light', false), 'light')
  assert.equal(resolveTheme('dark', true), 'dark')
  assert.equal(resolveTheme('dark', false), 'dark')
  assert.equal(resolveTheme('system', true), 'dark')
  assert.equal(resolveTheme('system', false), 'light')
})

test('C4 P2-3: storage read failure falls back to system (never surfaces exception)', () => {
  const boom = () => { throw new Error('SecurityError') }
  assert.equal(readStoredMode(() => 'dark'), 'dark')
  assert.equal(readStoredMode(() => null), 'system')
  assert.equal(readStoredMode(boom), 'system') // 隐私模式/嵌入环境 → 跟随系统，而非强制 light
  // 写入失败静默忽略
  assert.doesNotThrow(() => writeStoredMode(boom, 'dark'))
  const written = []
  writeStoredMode((k, v) => written.push([k, v]), 'dark')
  assert.deepEqual(written, [[THEME_STORAGE_KEY, 'dark']])
})

test('C4 P1-1: bootstrap script writes data-theme before paint in every preference scenario', () => {
  const run = ({ stored, storedThrows, systemDark, mqThrows }) => {
    const doc = { documentElement: { theme: null, setAttribute(k, v) { if (k === 'data-theme') this.theme = v } } }
    const sandbox = {
      localStorage: {
        getItem: storedThrows ? () => { throw new Error('SecurityError') } : () => stored,
      },
      matchMedia: mqThrows ? () => { throw new Error('no matchMedia') } : () => ({ matches: systemDark }),
      document: doc,
    }
    vm.runInNewContext(themeBootstrapScript, sandbox)
    return doc.documentElement.theme
  }
  assert.equal(run({ stored: 'dark', systemDark: false }), 'dark')     // 手动深色强于系统浅色
  assert.equal(run({ stored: 'light', systemDark: true }), 'light')     // 手动浅色强于系统深色
  assert.equal(run({ stored: 'system', systemDark: true }), 'dark')     // 跟随系统·深
  assert.equal(run({ stored: null, systemDark: true }), 'dark')         // 缺省 → 跟随系统·深
  assert.equal(run({ stored: null, systemDark: false }), 'light')       // 缺省 → 跟随系统·浅
  assert.equal(run({ stored: 'invalid-value', systemDark: true }), 'dark') // 非法值 → 回退 system
  assert.equal(run({ stored: 'light', storedThrows: true, systemDark: true }), 'dark') // 存储不可用仍跟随系统
  assert.equal(run({ stored: null, systemDark: true, mqThrows: true }), 'light')       // 系统查询也不可用才兜底 light
})

/** 构造假系统偏好环境（监听可手动触发，用于 controller 运行时行为测试） */
function makeThemeEnv(initialDark = true) {
  let stored = 'system'
  let dark = initialDark
  let listener = null
  const applied = []
  return {
    env: {
      getMode: () => stored,
      setMode: (m) => { stored = m },
      systemDark: () => dark,
      onChange: (cb) => { listener = cb; return () => { if (listener === cb) listener = null } },
      apply: (r) => { applied.push(r) },
    },
    applied,
    emitSystemChange() { dark = !dark; if (listener) listener() },
    hasListener: () => listener !== null,
    stored: () => stored,
    systemDark: () => dark,
  }
}

test('C4 P1-2: controller follows runtime system changes only in system mode; manual choice overrides', () => {
  const h = makeThemeEnv(true)
  const c = createThemeController(h.env)
  c.init()
  assert.deepEqual(h.applied, ['dark'])     // init 立即按当前生效
  assert.equal(h.hasListener(), true)       // system 模式注册了运行时监听

  h.emitSystemChange()                      // 系统切到浅色
  assert.deepEqual(h.applied, ['dark', 'light'])

  c.setMode('light')                        // 手动选浅色：解除监听 + 立即生效
  assert.deepEqual(h.applied, ['dark', 'light', 'light'])
  assert.equal(h.hasListener(), false)      // 不再跟随系统
  h.emitSystemChange()                      // 系统又变深色——不应触发
  assert.deepEqual(h.applied, ['dark', 'light', 'light'])

  c.setMode('dark')
  assert.deepEqual(h.applied, [...h.applied.slice(0, 3), 'dark'])
  assert.equal(h.hasListener(), false)

  c.setMode('system')                       // 切回 system：立即按当前系统偏好刷新
  assert.deepEqual(h.applied, [...h.applied.slice(0, 4), 'dark']) // 此时系统已回到深色
  assert.equal(h.hasListener(), true)       // 监听重新注册
  h.emitSystemChange()
  assert.deepEqual(h.applied, [...h.applied.slice(0, 5), 'light'])
})

test('C4 P1-2: controller.dispose detaches the system listener', () => {
  const h = makeThemeEnv(true)
  const c = createThemeController(h.env)
  c.init()
  assert.equal(h.hasListener(), true)
  c.dispose()
  assert.equal(h.hasListener(), false)
  h.emitSystemChange()
  assert.deepEqual(h.applied, ['dark'])
})

/* ---- WCAG 对比度守卫（P2-4：dark --sel 族需过 AA；light 原值也顺带校验未退化） ---- */
function channelToLinear(c) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  assert.ok(m, `bad hex ${hex}`)
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
function tokenValue(css, name) {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})\\s*;`).exec(css)
  assert.ok(m, `token --${name} missing`)
  return m[1]
}

test('C4 P2-4: sel-indigo tokens pass AA text contrast in both themes', () => {
  const css = read('app/assets/studio.css')
  const dark = css.match(/:root\[data-theme='dark'\] \{\r?\n([\s\S]*?)\r?\n\}/m)[1]
  // dark：--sel-text 用于暗色表面上的活动项文字
  assert.ok(contrast(tokenValue(dark, 'sel-text'), tokenValue(dark, 'surface-raised')) >= 4.5,
    `dark sel-text on dark surface AA (${contrast(tokenValue(dark, 'sel-text'), tokenValue(dark, 'surface-raised')).toFixed(2)}:1)`)
  // dark：白字（icon-active 用 --text-invert #fff）压在 --sel 底上
  assert.ok(contrast('#ffffff', tokenValue(dark, 'sel')) >= 4.5,
    `white on dark sel AA (${contrast('#ffffff', tokenValue(dark, 'sel')).toFixed(2)}:1)`)
  // light 原值不退化
  assert.ok(contrast(tokenValue(css, 'sel-text'), '#ffffff') >= 4.5,
    `light sel-text on white AA (${contrast(tokenValue(css, 'sel-text'), '#ffffff').toFixed(2)}:1)`)
})

test('C4-B2: solid danger button hover keeps AA white label in both themes', () => {
  const css = read('app/assets/studio.css')
  const dark = css.match(/:root\[data-theme='dark'\] \{\r?\n([\s\S]*?)\r?\n\}/m)[1]
  // ConfirmDialog 实心危险钮 hover：白字（--text-invert #fff）压在 hover 底上，双主题均须 ≥4.5
  assert.ok(contrast('#ffffff', tokenValue(css, 'action-danger-hover')) >= 4.5,
    `light danger hover AA (${contrast('#ffffff', tokenValue(css, 'action-danger-hover')).toFixed(2)}:1)`)
  assert.ok(contrast('#ffffff', tokenValue(dark, 'action-danger-hover')) >= 4.5,
    `dark danger hover AA (${contrast('#ffffff', tokenValue(dark, 'action-danger-hover')).toFixed(2)}:1)`)
})
