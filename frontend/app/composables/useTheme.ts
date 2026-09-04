import type { ThemeMode, ResolvedTheme, ThemeController } from '../utils/theme-core.mjs'

/**
 * C4 暗色主题 · 应用侧接口（自动导入）。
 *
 * - `mode`：用户选择值 light | dark | system（持久化于 localStorage['ui-theme']）。
 * - `resolved`：实际生效主题（system 时由系统偏好实时决定，运行时跟随）。
 * - `setTheme(mode)`：手动切换（light/dark 时不再跟随系统；切回 system 立即重跟）。
 *
 * 实际逻辑在 utils/theme-core.mjs / plugins/theme.client.ts（首帧渲染在 nuxt.config 内联 bootstrap）。
 */
export function useTheme() {
  const mode = useState<ThemeMode>('ui-theme-mode')
  const resolved = useState<ResolvedTheme>('ui-theme-resolved')
  const controller = useState<ThemeController | null>('ui-theme-controller', () => null)

  const setTheme = (m: ThemeMode) => controller.value?.setMode(m)

  return { mode, resolved, setTheme }
}
