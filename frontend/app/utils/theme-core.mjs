/**
 * C4 暗色主题核心逻辑（纯 ESM，零 DOM / Nuxt 依赖——可在 node 中直接做行为测试）。
 *
 * 职责边界：
 * - `themeBootstrapScript`：首帧防闪脚本源码字符串。由 nuxt.config `app.head.script` 内联进
 *   SPA HTML 的 <head>，保证在样式表与入口脚本之前执行（详见 docs/ui-dark-theme-spec.md §2）。
 * - `parseThemePref` / `resolveTheme` / `readStoredMode` / `writeStoredMode`：偏好解析与存储（三态）。
 * - `createThemeController`：运行时主题控制器（system 跟随运行时切换、手动覆盖优先级、监听生命周期），
 *   浏览器侧由 app/plugins/theme.client.ts 用真实 DOM 注入，node 测试注入假件。
 *
 * 存储容错策略（PR53 评审 P2-3）：localStorage 读取/写入失败（隐私模式、SecurityError 等）分别独立
 * 吞掉——读取失败回退 'system'（仍可跟随系统偏好），只有系统查询也不可用时才回退 light。
 */
export const THEME_STORAGE_KEY = 'ui-theme'

/** 首帧防闪脚本：解析本地偏好（light/dark/system，非法值/读取失败 → system），
 * 按系统偏好计算实际主题后立即写入 <html data-theme>，随后由 bootstrap 声明 color-scheme 语义。
 * 本地存储与 matchMedia 分开容错：存储不可用仍尝试系统偏好；仅系统查询也不可用才回退 light。 */
export const themeBootstrapScript =
  `(function(){var k='ui-theme',t='system';` +
  `try{var s=localStorage.getItem(k);if(s==='light'||s==='dark'||s==='system')t=s}catch(e){}` +
  `var d=false;try{d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)}catch(e){}` +
  `document.documentElement.setAttribute('data-theme',d?'dark':'light')})()`

/** 解析存储/外部写入的偏好字符串：light|dark|system；null 或其它值一律回退 system。 */
export function parseThemePref(raw) {
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

/** 由「选择模式 + 系统当前偏好」求实际主题。 */
export function resolveTheme(mode, systemDark) {
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  return systemDark ? 'dark' : 'light'
}

/** 容错读取本地偏好：get 抛错（SecurityError 等）→ 'system'，绝不把异常冒泡到调用方。 */
export function readStoredMode(get) {
  let raw = null
  try {
    raw = get(THEME_STORAGE_KEY)
  } catch (e) {
    /* 存储不可用：回退 system（仍跟随系统偏好） */
  }
  return parseThemePref(raw)
}

/** 容错写入本地偏好：写入失败静默忽略（不影响本次会话生效）。 */
export function writeStoredMode(set, mode) {
  try {
    set(THEME_STORAGE_KEY, mode)
  } catch (e) {
    /* 存储不可用：静默忽略 */
  }
}

/**
 * 运行时主题控制器（依赖注入，便于测试）。
 * @param {object} sys 由调用方注入的环境能力：
 *  - getMode(): 'light'|'dark'|'system' —— 当前选择值
 *  - setMode(mode): void —— 持久化选择值
 *  - systemDark(): boolean —— 系统当前是否深色
 *  - onChange(cb): () => void —— 注册系统偏好变化监听，返回取消函数
 *  - apply(resolved): void —— 应用实际主题（写 data-theme 等副作用）
 * 行为（PR53 评审 P1-2）：
 *  - init：按当前选择值立即 apply 一次；仅 system 模式注册运行时监听。
 *  - setMode：手动选择 light/dark 时解除 system 监听（此后不跟随系统）；
 *    切回 system 时立即按当前系统偏好 apply，并重启监听。
 *  - dispose：清理监听（页面/应用生命周期终结时调用）。
 */
export function createThemeController(sys) {
  let unsubscribe = null
  const applyCurrent = () => sys.apply(resolveTheme(sys.getMode(), sys.systemDark()))
  const syncListener = () => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    if (sys.getMode() === 'system') unsubscribe = sys.onChange(applyCurrent)
  }
  return {
    init() {
      applyCurrent()
      syncListener()
    },
    setMode(mode) {
      sys.setMode(mode)
      applyCurrent()
      syncListener()
    },
    dispose() {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
    },
  }
}
