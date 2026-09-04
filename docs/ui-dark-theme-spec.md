# JisuVideo-ai 暗色主题专项方案（UI C4）

> 版本：v1.0
> 日期：2026-09-04
> 状态：草案待评审（随 C4 首批实施提交）
> 关联：`docs/ui-optimization-plan.md` C4 条目（plan v3.0 立项）；A1/A2/A3 token 与色板规范收口后依赖已解除
> 适用范围：`frontend/app`（Nuxt 3 SPA，纯 CSS Variables，无 UI 框架）

## 1. 背景与目标

- C4 原定义（plan §5-C4）：新增 dark token 集 + `data-theme` 切换（默认跟随系统）。现状为仅 Apple Light 一套 token，不支持暗色。
- 前置盘点结论（2026-09-04，v3.0 收口后）：
  1. `frontend/app/assets/studio.css` `:root` 已具备完整语义 token 面（surface/text/accent/action/状态/语义/遮罩/阴影/sp/radius/dur/ease），**组件基础区（183–499 行）零硬编码颜色**，全部经 `var()` 消费——暗色主题只需提供一套同名单 dark 值覆盖，无需改组件样式；
  2. token 注释多处已标注「暗色主题可覆盖」（`--fill-subtle`/`--cover-*`/`--media-stage-bg`/`--notice-*`/`--new-style-*` 等），命名即按可覆盖设计；
  3. 页面 scoped 样式与内联残留字面量仅 24 处，分类见 §5（品牌/封面渐变 ≈ 1/2 与主题无关，剩余为纸面白/黑叠加/局部语义色，逐面 token 化量小）。
- 目标：所有页面（index / detail / episode / settings / studio / 弹窗抽屉）在暗色下无「浅色纸片断层」，层次与亮色语义等价；默认跟随系统，可强制亮/暗；亮色观感零变化（light token 值不改）。

## 2. 切换机制（决策）

| # | 决策 | 依据 |
|---|---|---|
| 1 | 主题挂在 `<html data-theme>`：`system`（缺省，跟随 `prefers-color-scheme`）/ `light` / `dark` 三态 | 三态覆盖「默认跟随系统 + 手动覆盖」完整需求；`data-theme` 缺省即 system，DOM 无额外噪声 |
| 2 | token 结构采用两段覆盖：`:root`（light，现状不动）为底，`:root[data-theme='dark']` 定义 dark 覆盖；system 态由 head 内联脚本在首帧前解析 `prefers-color-scheme` 并写入 `data-theme='dark'/'light'` | 避免 CSS 媒体查询与属性选择器双份 dark 定义（纯 CSS 无 mixin，重复一份但把「跟随系统」收敛到 JS 单点）；FOUC 预防见决策 4 |
| 3 | 手动选择存 `localStorage['ui-theme']`（`system/light/dark`），仅在 `system` 态监听 `matchMedia('(prefers-color-scheme: dark)')` 变化实时切换；应用内不引入全局状态（读 localStorage + DOM 属性即时生效） | 主题是纯表现层即时偏好，无需响应式状态参与渲染；SPA 下无跨端同步需求 |
| 4 | FOUC 预防：首帧 bootstrap（`app/utils/theme-core.mjs` 导出的 `themeBootstrapScript`）经 `nuxt.config app.head.script` **静态内联进 SPA HTML `<head>`**，先于样式表/入口脚本同步执行；运行时跟随与手动覆盖在 `plugins/theme.client.ts`（`createThemeController` 依赖注入，system 态注册 `matchMedia` change 监听、手动 light/dark 解除监听），`composables/useTheme.ts` 暴露 `setTheme` 供第三批设置页调用 | `ssr:false` 下组件内 `useHead` 要等客户端 JS 下载启动后才注入，首帧已按亮色绘制过一帧——bootstrap 必须落在静态 HTML；脚本仅 5 行、零依赖，本地存储与系统偏好分开容错（存储不可用仍跟随系统） |
| 5 | `:root` 增加 `color-scheme: light`；`[data-theme='dark']` 与 system 暗色态增加 `color-scheme: dark` | 原生控件（select/checkbox/滚动条/日期选择）跟随主题，避免白表单控件钉在暗页上 |
| 6 | 首批**不做**手动切换 UI（设置页「外观」控件后续批次）；机制先行 + 默认跟随系统，改 `localStorage` 即可验收暗色 | 切换 UI 涉及设置页结构扩展，独立小批次，避免首批范围膨胀 |
| 7 | 阴影在暗色下降低可见度，采用「同族提 alpha + 表面亮度差主导层次」，不新增发光/描边体系 | 保持观感克制，暗色苹果风格以层级亮度而非投影表达深度 |

## 3. dark token 值设计

### 3.1 规则

1. **表面系**：浅灰底反转为深灰底（Apple dark 窗口 `#1c1c1e` 族），`raised/input` 比 `base` 亮一档，层级关系与 light 一致。
2. **文本系**：`text-0→text-3` 反相为白→灰阶梯（`#f5f5f7 → #a1a1a6 → #86868b → #7c7c81`），保证次级文字对比 ≥ 4.5:1。
3. **黑 alpha 族**（outline/border/hover/active/fill/scrollbar）：全部反转为**白 alpha 族**，alpha 值整体上调 0.03–0.06（暗底需要更明显分隔）。
4. **accent / 状态 / 语义色**：切 Apple dark 亮档（`#0071e3→#0a84ff`、success `#34c759→#30d158`、error `#ff3b30→#ff453a` 等）；`-strong`（浅底深字）反转为亮字档，保证在深底上对比。
5. **不可反相面保持不变**：媒体台面 `--media-stage-bg`（本就是深色）、媒体遮罩/白字 `--media-scrim-*/--media-text-*`、封面白字 `--cover-text`、品牌/类型渐变（vue 内字面量）。
6. **浅色纸面横幅**（notice/unsaved）与**玻璃**（glass/bar-glass）反转为深底同色相半透明；`--text-invert` 保持白（用途为深色媒体/彩色面上的反白字，与暗色无冲突，逐个消费点核对）。
7. 未被列出的非颜色 token（sp/radius/font/dur/ease）不参与。

### 3.2 关键值表（完整映射随首批落 `studio.css`）

| light（现状） | dark | 备注 |
|---|---|---|
| `--surface-base/muted #f5f5f7` | `#161617` | 页面底 |
| `--surface-raised/input #ffffff` | `#1e1e1f` | 卡片/输入面（比底亮一档） |
| `--surface-soft/bg-0 #fafafc` | `#1c1c1e` | 次级面 |
| `--bg-1 #ffffff` | `#1e1e1f` | — |
| `--bg-2 #f0f0f3` | `#262628` | 凹陷/条带 |
| `--bg-3 #e4e4e8` | `#2c2c2e` | 最深条带 |
| `--surface-outline/--border rgba(0,0,0,.08)` | `rgba(255,255,255,.12)` | 分隔 |
| `--border-strong rgba(0,0,0,.14)` | `rgba(255,255,255,.2)` | 输入描边 |
| `--border-hover rgba(0,0,0,.22)` | `rgba(255,255,255,.3)` | — |
| `--bg-hover rgba(0,0,0,.04)` | `rgba(255,255,255,.06)` | — |
| `--bg-active rgba(0,0,0,.06)` | `rgba(255,255,255,.09)` | — |
| `--fill-subtle rgba(0,0,0,.05)` | `rgba(255,255,255,.06)` | — |
| `--fill-hover rgba(0,0,0,.08)` | `rgba(255,255,255,.1)` | — |
| `--text-0 #1d1d1f` | `#f5f5f7` | 主字 |
| `--text-1 #424245` | `#a1a1a6` | 次级 |
| `--text-2 #6e6e73` | `#86868b` | 弱 |
| `--text-3 #86868b` | `#7c7c81` | 占位 |
| `--accent/#border-focus/action-primary #0071e3` | `#0a84ff` | Apple dark accent |
| `--accent-dark/press #0062c4` | `#0a6fd8` | — |
| `--accent-hover #0077ed` | `#3b9aff` | — |
| `--accent-text #0066cc` | `#409cff` | 链接/ghost 字 |
| `--accent-bg rgba(0,113,227,.08)` | `rgba(10,132,255,.16)` | — |
| `--accent-glow rgba(0,113,227,.18)` | `rgba(10,132,255,.32)` | focus 环 |
| `--accent-soft #f0f7ff` | `rgba(10,132,255,.14)` | 选中浅填充转半透明 |
| `--action-secondary/button-bg #e8e8ed` | `#2c2c2e` | 次按钮底 |
| `--button-bg-hover #dedee3` | `#343437` | — |
| `--button-bg-active #d4d4da` | `#3a3a3c` | — |
| `--success #34c759` | `#30d158` | — |
| `--success-strong #248a3d` | `#30d158` | 深底亮档 |
| `--success-bg rgba(52,199,89,.12)` | `rgba(48,209,88,.16)` | — |
| `--error #ff3b30` | `#ff453a` | — |
| `--error-bg rgba(255,59,48,.1)` | `rgba(255,69,58,.16)` | — |
| `--error-outline rgba(255,59,48,.18)` | `rgba(255,69,58,.36)` | — |
| `--info #5ac8fa` | `#64d2ff` | — |
| `--info-strong #0b6b94` | `#64d2ff` | — |
| `--warning #ff9f0a` | `#ff9f0a` | 保持（暗底对比 ≥4.5） |
| `--warning-strong #c93400` | `#ffb340` | 深底亮档 |
| `--switch-track #e9e9ea` | `#39393d` | Apple dark switch |
| `--scrollbar-thumb rgba(0,0,0,.16)` | `rgba(255,255,255,.2)` | — |
| `--overlay-mask rgba(0,0,0,.32)` | `rgba(0,0,0,.55)` | 暗底提遮罩 |
| `--unsaved-bg #fbf3e2` | `rgba(255,190,60,.14)` | 纸面→深底琥珀 |
| `--unsaved-text #a06a0e` | `#ffd97a` | — |
| `--unsaved-border #e0b15a` | `#b98a2f` | — |
| `--notice-*`（琥珀横幅 5 值） | 同 unsaved 法则：bg `rgba(255,180,40,.12)`、border `#8a6d1f`、text `#ffd97a`、link `#ffb340`、hover `rgba(255,180,40,.2)` | — |
| `--surface-glass rgba(255,255,255,.85)` | `rgba(30,30,32,.85)` | 浮层玻璃 |
| `--bar-glass rgba(251,251,253,.72)` | `rgba(22,22,23,.72)` | 顶栏玻璃 |
| `--cover-fallback` 浅渐变 | `linear-gradient(135deg,#2a2f3a,#1c2230)` | 封面占位反深 |
| `--cover-fallback-fg #6a7ba0` | `#8fa2c9` | — |
| `--media-stage-bg` / scrim / media-text / text-invert | 不变 | 深色台面/白字语义 |
| `--kind-scene #16a34a` | `#30d158` | 资产色点亮档 |
| `--kind-scene-strong #15803d` | `#30d158` | — |
| `--kind-prop #b45309` | `#ffb340` | — |
| `--new-style #8642a6` | `#c77dff` | — |
| `--shadow-*` | 同族 alpha ×1.6 | 暗底阴影几乎不可见，加深同族 |
| `--button-shadow*` | `rgba(0,0,0,.3)` 起 | — |

> 完整逐 token 映射以首批提交 `studio.css` 的 dark 覆盖块为准；本表为评审锚点。

## 4. 残留字面量分批清单（vue scoped / 内联）

| 批次 | 面 | 内容 | 动作 |
|---|---|---|---|
| B1（随首批） | episode/detail 纸面与黑叠加 | `detail #fbfbfd/#fbfaf7`、`rgba(255,255,255,.7/.72)` 玻璃、`episode rgba(0,0,0,.09/.14)` hover/遮罩、`rgba(0,113,227,.25)` 描边 | 收敛为可覆盖 token（新增 `--surface-paper` / `--glass-raised` / `--scrim-soft-raise` 等或复用既有族） |
| B2（第二批） | 局部语义色 | `episode --sel*`（选区紫 4 值）、`ConfirmDialog #d70015` danger hover、detail/back-btn hover | 语义 token 化 + dark 档 |
| 保持 | 品牌/类型面 | index 风格渐变（JS 内联）、settings cap/provider-badge 渐变、封面渐变、text-shadow、媒体阴影 | 彩色品牌与阴影，暗色下不反相 |

## 5. 验收标准

1. 五个页面 + 弹窗/抽屉/顶部玻璃在 `data-theme='dark'` 下无浅色纸片/黑断层；层级（浮层>卡片>页面底）与 light 语义一致。
2. 次级文字以上对比满足 WCAG AA（尽力档，tag 等装饰性小字记录例外）。
3. 原生控件（select/滚动条/switch）随 `color-scheme: dark` 变暗，无白底原生控件钉在暗页。
4. 系统偏好暗色时开页即暗（无先亮后闪）；改系统偏好实时切换；`localStorage['ui-theme']='light'` 可强制亮。
5. **light 回归**：`:root` light token 值零改动，亮色观感与合入前逐像素一致。
6. 测试守卫：结构测试锚定 studio.css dark 覆盖块与 `color-scheme`、nuxt.config 首帧 bootstrap（app.vue 不再运行时注入）、B1/P2 字面量清理、light token 值零改动；行为测试直接运行 `theme-core.mjs`（零 DOM 依赖）：三态解析与非法值回退、存储读写异常容错、bootstrap 全场景矩阵（vm 沙箱执行）、controller 运行时跟随/手动覆盖/监听生命周期、`--sel` 双主题 AA 对比度（WCAG 实算）；**构建产物集成测试**（`npm run test:build`，**由 CI workflow `.github/workflows/ci.yml` 与 `npm run verify` 强制执行**，非仅按需运行）每次强制全新 production build，以 `NITRO_PORT=0` 由 OS 动态分配端口启动 nitro server（子进程 spawn 错误或就绪前提前退出直接判失败，杜绝误探旧服务），解析进程自身 stdout 的监听地址后请求该实际 URL 的 SPA HTML，断言 bootstrap 先于 stylesheet 与 module entry——产物缺失、构建失败或顺序破坏均判失败，绝不静默 skip；结束后 kill 并等待子进程退出（无残留进程）。已做双向负面验证：移除 bootstrap 后红、server 入口失效后红。

## 6. 分批路线

| 批次 | 交付 | 验证 |
|---|---|---|
| **首批（本 PR）** | dark token 覆盖块 + `color-scheme` + 首帧 bootstrap（nuxt.config 静态 head）+ system 运行时跟随（plugin/composable）+ B1 纸面字面量 token 化 + 局部暗色修复（`--sel` 提升全局、skill 错误卡语义 token）+ 行为级测试（主题核心/AA 对比度）+ 构建产物集成测试（test:build，动态端口 + 进程生命周期守卫）+ CI workflow | `npm test` 全量 + `npm run test:build`（真构建产物 HTML 顺序断言，CI/`npm run verify` 强制执行）；亮色零变化；暗色人工验收 |
| 第二批 | B2 局部语义色 token 化 + 页面级暗色细节走查修正（对比度/遮罩/玻璃） | 同上 |
| 第三批 | 设置页「外观」切换控件（浅色/深色/跟随系统三态）+ 持久化 | 手工 + 结构守卫 |

## 7. 风险与回滚

- 风险：暗色下部分深色台面（media-stage 本就近黑）与页面底区分不足 → 第二批量产对比度走查兜底；`--text-invert` 消费点个别在浅色面上（非媒体）需核对 → 首批清单内逐个点检。
- 回滚：`data-theme` 覆盖块与脚本均为增量，删除 dark 块即回亮色，组件样式零侵入。
