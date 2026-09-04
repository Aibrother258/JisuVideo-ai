import { readStoredMode, writeStoredMode, createThemeController } from '../utils/theme-core.mjs'
import type { ThemeMode, ResolvedTheme, ThemeController } from '../utils/theme-core.mjs'

/**
 * C4 暗色主题 · 运行时控制器（仅客户端）。
 *
 * 首帧渲染已由 nuxt.config app.head 的内联 bootstrap（themeBootstrapScript）完成——
 * 本插件只负责「长期行为」：把选择值读入全局 state、在 system 模式下注册
 * prefers-color-scheme 的运行时监听（用户中途切换系统深浅色页面实时跟随）、
 * 并暴露 setTheme（手动 light/dark 覆盖时解除监听；切回 system 立即重跟）。
 * 逻辑全部在 utils/theme-core.mjs（可 node 行为测试），此处仅注入真实 DOM 环境。
 */
export default defineNuxtPlugin(() => {
  const mode = useState<ThemeMode>('ui-theme-mode', () => 'system')
  const resolved = useState<ResolvedTheme>('ui-theme-resolved', () => 'light')

  const mqlDark = () => window.matchMedia('(prefers-color-scheme: dark)')

  const controller = createThemeController({
    getMode: () => mode.value,
    setMode: (m: ThemeMode) => {
      mode.value = m
      writeStoredMode((k, v) => window.localStorage.setItem(k, v), m)
    },
    systemDark: () => mqlDark().matches,
    onChange: (cb) => {
      const mql = mqlDark()
      const handler = () => cb()
      if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handler)
      else mql.addListener(handler)
      return () => {
        if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', handler)
        else mql.removeListener(handler)
      }
    },
    apply: (t: ResolvedTheme) => {
      resolved.value = t
      document.documentElement.setAttribute('data-theme', t)
    },
  })

  // 对齐首帧 bootstrap 已写入的 data-theme：读真实选择值入 state（bootstrap 阶段不保证与 state 同步）
  mode.value = readStoredMode((k) => window.localStorage.getItem(k))
  controller.init()

  // 单例控制器注册到全局 state；app/composables/useTheme.ts 经它提供 setTheme（供后续设置页等调用）
  useState<ThemeController | null>('ui-theme-controller', () => controller)
})
