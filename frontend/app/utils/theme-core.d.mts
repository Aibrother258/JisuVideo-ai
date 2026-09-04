export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY: string
export const themeBootstrapScript: string

export function parseThemePref(raw: string | null): ThemeMode
export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme
export function readStoredMode(get: (k: string) => string | null): ThemeMode
export function writeStoredMode(set: (k: string, v: string) => void, mode: ThemeMode): void

export interface ThemeSystem {
  getMode(): ThemeMode
  setMode(mode: ThemeMode): void
  systemDark(): boolean
  onChange(cb: () => void): () => void
  apply(resolved: ResolvedTheme): void
}

export interface ThemeController {
  init(): void
  setMode(mode: ThemeMode): void
  dispose(): void
}

export function createThemeController(sys: ThemeSystem): ThemeController
