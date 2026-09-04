/**
 * C4 第三批评审 P2-2 · 设置页「外观」三态切换的挂载级交互测试。
 *
 * 目标：证明 ThemeAppearanceCard（设置页外观面板的实现单元）的真实接线可用，
 * 而非只在源码里正则匹配得到：
 *  - 用户点选 radio 后：data-theme 立即更新、选中态与「当前实际外观」文案随之变化、
 *    localStorage['ui-theme'] 写入成功/失败分支正确；
 *  - system 模式下 matchMedia 变化实时回显；
 *  - 已存的偏好首次渲染即回显。
 *
 * 组件用真实 `useTheme`（composables/useTheme.ts 原样运行），controller 用真实
 * `createThemeController`（utils/theme-core.mjs）；仅 Nuxt 装配层（theme.client.ts）
 * 用等价代码在此复刻（Nuxt plugin 运行时无法在挂载测试中执行）。
 */
import { beforeEach, expect, test, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { mount } from '@vue/test-utils'
import ThemeAppearanceCard from '../../app/components/ThemeAppearanceCard.vue'
import {
  createThemeController,
  readStoredMode,
  writeStoredMode,
  THEME_STORAGE_KEY,
} from '../../app/utils/theme-core.mjs'
import type { ResolvedTheme, ThemeController, ThemeMode } from '../../app/utils/theme-core.mjs'

interface FakeMql {
  matches: boolean
  addEventListener(type: string, cb: () => void): void
  removeEventListener(type: string, cb: () => void): void
  /** 模拟系统深浅色变化并通知监听者 */
  setSystemDark(v: boolean): void
}

function makeFakeMql(initial = false): FakeMql {
  const listeners = new Set<() => void>()
  return {
    matches: initial,
    addEventListener(_type, cb) {
      listeners.add(cb)
    },
    removeEventListener(_type, cb) {
      listeners.delete(cb)
    },
    setSystemDark(v) {
      this.matches = v
      for (const cb of listeners) cb()
    },
  }
}

interface BootstrapOpts {
  stored?: string | null
  systemDark?: boolean
}

/** 模拟用户点选某个主题 radio：置 checked 并派发原生 change 事件 */
async function pick(wrapper: ReturnType<typeof mount<typeof ThemeAppearanceCard>>, value: string) {
  const input = wrapper.get(`input[value="${value}"]`).element as HTMLInputElement
  input.checked = true
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
}

interface ThemeEnv {
  mode: Ref<ThemeMode>
  resolved: Ref<ResolvedTheme>
  controller: ThemeController
  mql: FakeMql
}

/**
 * 复刻 plugins/theme.client.ts 的装配（state 注册 + controller 依赖注入），
 * 使组件的 useTheme() 能取到与运行时一致的全局 state。
 */
function bootstrapThemeEnv(opts: BootstrapOpts = {}): ThemeEnv {
  const storage = window.localStorage
  storage.clear()
  if (opts.stored != null) storage.setItem(THEME_STORAGE_KEY, opts.stored)

  const mql = makeFakeMql(opts.systemDark ?? false)
  const states = new Map<string, unknown>()
  vi.stubGlobal('useState', (key: string, init?: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(typeof init === 'function' ? init() : init))
    return states.get(key)
  })

  // 等价 theme.client.ts 的 state 注册顺序：先 mode/resolved，再 controller
  const useStateStub = (globalThis as { useState?: unknown }).useState as (
    key: string,
    init?: () => unknown,
  ) => Ref<unknown>
  const mode = useStateStub('ui-theme-mode', () => 'system') as Ref<ThemeMode>
  const resolved = useStateStub('ui-theme-resolved', () => 'light') as Ref<ResolvedTheme>
  const controller = createThemeController({
    getMode: () => mode.value,
    setMode: (m: ThemeMode) => {
      mode.value = m
      writeStoredMode((k, v) => storage.setItem(k, v), m)
    },
    systemDark: () => mql.matches,
    onChange: (cb) => {
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    apply: (t: ResolvedTheme) => {
      resolved.value = t
      document.documentElement.setAttribute('data-theme', t)
    },
  })
  mode.value = readStoredMode((k) => storage.getItem(k))
  controller.init()
  // Nuxt useState 暴露的是 Ref：controller 也须 ref 包装，useTheme 的 controller.value 才可访问
  states.set('ui-theme-controller', ref(controller))
  return { mode, resolved, controller, mql }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

test('initial render reflects an existing stored choice (data-theme + checked radio + copy)', () => {
  bootstrapThemeEnv({ stored: 'dark', systemDark: false })
  const wrapper = mount(ThemeAppearanceCard)
  expect((wrapper.get('input[value="dark"]').element as HTMLInputElement).checked).toBe(true)
  expect((wrapper.get('input[value="system"]').element as HTMLInputElement).checked).toBe(false)
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  expect(wrapper.text()).toContain('当前实际外观：深色（深色）')
})

test('selecting a mode applies instantly: data-theme + radio check + copy + persisted value', async () => {
  bootstrapThemeEnv({ stored: 'system', systemDark: false })
  const wrapper = mount(ThemeAppearanceCard)
  expect(wrapper.text()).toContain('当前实际外观：浅色（跟随系统）')

  // 深色
  await pick(wrapper, 'dark')
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  expect((wrapper.get('input[value="dark"]').element as HTMLInputElement).checked).toBe(true)
  expect((wrapper.get('input[value="system"]').element as HTMLInputElement).checked).toBe(false)
  expect(wrapper.text()).toContain('当前实际外观：深色（深色）')

  // 浅色
  await pick(wrapper, 'light')
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  expect((wrapper.get('input[value="light"]').element as HTMLInputElement).checked).toBe(true)
  expect(wrapper.text()).toContain('当前实际外观：浅色（浅色）')
})

test('storage write failure (privacy mode) is swallowed: theme still applies for the session', async () => {
  bootstrapThemeEnv({ stored: 'system', systemDark: false })
  const spy = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('SecurityError')
    })
  const wrapper = mount(ThemeAppearanceCard)
  await pick(wrapper, 'dark')
  // 写入失败被 theme-core writeStoredMode 静默吞掉；即时生效不受影响
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  expect((wrapper.get('input[value="dark"]').element as HTMLInputElement).checked).toBe(true)
  expect(wrapper.text()).toContain('深色')
  spy.mockRestore()
})

test('system mode follows matchMedia changes live and re-renders the copy', async () => {
  const { mql } = bootstrapThemeEnv({ stored: 'system', systemDark: false })
  const wrapper = mount(ThemeAppearanceCard)
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')

  // 系统切深色 → 实时跟随并回显
  mql.setSystemDark(true)
  await nextTick()
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  expect(wrapper.text()).toContain('当前实际外观：深色（跟随系统）')

  // 手动选浅色 → 解除跟随，系统再变不影响
  await pick(wrapper, 'light')
  mql.setSystemDark(true)
  await nextTick()
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  expect(wrapper.text()).toContain('当前实际外观：浅色（浅色）')
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

  // 切回 system → 立即重跟当前系统偏好（仍深色）
  await pick(wrapper, 'system')
  await nextTick()
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  expect(wrapper.text()).toContain('当前实际外观：深色（跟随系统）')
})
