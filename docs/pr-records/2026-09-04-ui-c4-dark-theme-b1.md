# UI C4 暗色主题首批（B1）：dark token 覆盖块 + `data-theme` 切换 + 首帧 FOUC + B1 字面量 token 化

> 分支：`ui-c4-dark-theme-first-batch` → master
> 基准：master `4bf133c`（PR #52「PR #48 closeout + plan v3.0」之后）
> PR：#53（merge `7c99e15`，2026-09-04）
> 日期：2026-09-04
> 关联方案：`docs/ui-dark-theme-spec.md`（v1.0 → v1.1）；plan v3.0 C4 立项
> 后续批次：C4 第二批 = PR #54（见 `2026-09-04-ui-c4-b2-solid-ink-token.md`）

## 1. 触发条件

C4 原定义（plan §5-C4）：新增 dark token 集 + `data-theme` 切换（默认跟随系统），排期 P3，依赖 P1 token 工作线（A1/A2/A3）收口。A3（PR #28）合入后依赖解除，v3.0 立项；前置盘点结论：`studio.css` 组件基础区（183–499 行）零硬编码颜色、全 `var()` 消费，`:root` token 注释多处已标注「暗色主题可覆盖」，页面残留字面量仅 24 处且多为品牌/封面渐变（与主题无关），首批只需处理纸面/玻璃等 B1 面。

## 2. 改了什么

| 层 | 文件 | 改动 |
|---|---|---|
| token 层 | `frontend/app/assets/studio.css` | `:root` 增 `color-scheme: light`；新增 `:root[data-theme='dark']` 同名覆盖块（light 值零改动）：Apple dark 色阶表面 `#161617/#1e1e1f/#262628/#2c2c2e`、文本反相 `#f5f5f7→#7c7c81` 阶梯、黑 alpha 边框/填充反转白 alpha（上调 0.03–0.06）、accent/状态/语义切暗色亮档（`#0a84ff/#30d158/#ff453a/#64d2ff`）、cover/glass/notice/unsaved/kind/new-style 暗色档、阴影同族加深 |
| 页面 scoped | `detail.vue` / `episode.vue` | B1 残留字面量收敛：新增 `--surface-paper`/`--surface-paper-warm`/`--glass-hover`/`--dot-idle`/`--accent-border`（light 值 = 原字面量）；back-btn hover `rgba(0,0,0,.09) → var(--fill-hover)`（归一 alpha 差 ≤0.02，studio.css 注释留痕）；4 处 `color-mix(…, white)` 混合底改 `var(--surface-raised)`（light 即 `#fff` 观感零变化，暗色自动跟深面，避免「白纸片」） |
| 首帧 | `nuxt.config.ts` + `app/utils/theme-core.mjs`(+`.d.mts`) | 首帧 bootstrap 脚本**静态内联**进 SPA HTML `<head>`（`themeBootstrapScript` 5 行零依赖，解析 `localStorage['ui-theme']`，缺省 system 跟随 `prefers-color-scheme`，写入 `<html data-theme>`），先于样式表/入口脚本同步执行；`app.vue` 不再运行时注入（SSR:false 下 useHead 首帧已用亮色绘制过） |
| 运行时 | `app/plugins/theme.client.ts` + `app/composables/useTheme.ts` | `createThemeController`（依赖注入）：system 态注册 `matchMedia` change 监听实时切换、手动 light/dark 解除监听；`useTheme` 暴露 `setTheme` 供第三批设置页调用 |
| 行为测试 | `frontend/tests/dark-theme-core.test.mjs` | 直接运行 `theme-core.mjs`（零 DOM 依赖）：三态解析与非法值回退、存储读写异常容错、bootstrap 全场景矩阵（vm 沙箱）、controller 运行时跟随/手动覆盖/监听生命周期、`--sel` 双主题白字 AA 对比度（WCAG 实算） |
| 结构测试 | `frontend/tests/dark-theme-structure.test.mjs` | dark 块 + `color-scheme` 双态、light 锚点值未改动、首帧 bootstrap 落在 nuxt.config 静态 head、B1 字面量清理无残留 |
| 构建集成测试 | `frontend/tests/build/dark-theme-html.test.mjs` + `.github/workflows/ci.yml` + `frontend/package.json` | `npm run test:build` 每次强制全新 production build，`NITRO_PORT=0` OS 动态端口启动 nitro server，解析进程自身 stdout 监听地址后请求该 URL 的 SPA HTML，断言 bootstrap 先于 stylesheet 与 module entry；子进程 spawn 失败/提前退出直接判失败，结束后 kill 等待退出（无残留进程）。由 CI workflow 与 `npm run verify` 强制执行 |

## 3. 关键设计决策（决策 → 逻辑）

| # | 决策 | 依据 |
|---|---|---|
| 1 | 主题挂 `<html data-theme>`：system（缺省）/ light / dark 三态 | 覆盖「默认跟随系统 + 手动覆盖」；缺省即 system，DOM 无额外噪声 |
| 2 | 两段覆盖：`:root`（light 现状不动）为底 + `:root[data-theme='dark']` 覆盖块；system 态由 head 脚本首帧前解析写入 | 避免 CSS 媒体查询与属性选择器双份 dark 定义；「跟随系统」收敛到 JS 单点 |
| 3 | 手动选择存 `localStorage['ui-theme']`，system 态监听 matchMedia 实时切换；无全局状态 | 主题是纯表现层即时偏好，SPA 下无跨端同步 |
| 4 | FOUC 预防：bootstrap 经 nuxt.config `app.head.script` 静态内联，非组件 `useHead` | `ssr:false` 下组件 useHead 客户端启动后才注入，首帧已画亮色一帧；本地存储与系统偏好分开容错 |
| 5 | `color-scheme` 随主题双态 | 原生控件（select/checkbox/滚动条/日期）跟随主题 |
| 6 | 首批不做手动切换 UI；机制先行 + 默认跟随系统 | 切换 UI 属设置页扩展，独立小批次，避免首批范围膨胀 |
| 7 | 阴影暗色下「同族提 alpha + 表面亮度差主导层次」，不新增发光/描边体系 | 暗色苹果风格以层级亮度而非投影表达深度 |
| 8 | 不可反相面保持不变（media 台面/遮罩/白字、封面白字、品牌渐变） | 本就深色/白字设计，与主题无关；`--text-invert` 消费点逐个核对 |

## 4. 评审处理（三轮）

| 轮次 | 意见 → 处理 |
|---|---|
| PR review（commit `4a0930d`） | 首帧 bootstrap 必须在静态 HTML head（`useHead` 时机太晚）；补运行时 system 跟随与手动覆盖（plugin/composable）；暗色下 `--sel` 选区紫/白字 AA 修正 → 落地 `theme-core.mjs`/`theme.client.ts`/`useTheme.ts` 与 `color-scheme` 双态 |
| re-review（commit `f061c10`/`b2a42ef`） | 「dist 存在」弱检查不足 → 真构建产物集成测试（`test:build`：真实 build + 动态端口 + HTML 顺序断言）；CI workflow 与 `npm run verify` 强制，非仅按需运行；server 探活竞态（NITRO_PORT=0 由 OS 分配、解析自身 stdout 监听地址、spawn/就绪失败判红、kill 无残留） |
| final polish（commit `ccc4fd5`） | 子进程正常退出时清除 5s 兜底 timer，杜绝误报残留进程 |

## 5. 验证

- frontend `npm test`：**132/132 通过**（新增 4 组：dark 结构 / light 锚点 / FOUC / B1 清理）
- `npm run test:build`：1/1（全新 build + 真实 HTML bootstrap 顺序断言），双向负面验证：移除 bootstrap 后红、server 入口失效后红
- IDE 诊断：0
- 人工验收方式：系统偏好深色（或 DevTools → Rendering → prefers-color-scheme: dark）即全站暗色；`localStorage['ui-theme']='light'` 强制亮色

## 6. 对后续迭代的影响

- 第二批（PR #54）B2：局部语义色 token 化（danger hover / shadow 残留 / solid-ink 反色实心块）+ dark 覆盖完整性自动守卫。
- 第三批：设置页「外观」三态切换控件 + 持久化（`useTheme.setTheme` 已就位待接）。
- 结构/行为/构建产物三层测试形态成为 UI 工作线后续批次的验证基线（CI 强制 test:build）。
