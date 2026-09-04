# UI C4 暗色主题第三批（收尾批）：设置页「外观」三态切换面板 + 持久化

> 分支：`ui-c4-dark-theme-batch3` → master
> 基准：master `219bce3`（PR #55 C4 B1+B2 文档收尾后）
> PR：#56（merge `c58323e`，2026-09-04）
> 日期：2026-09-04
> 关联方案：`docs/ui-dark-theme-spec.md`（v1.2 → v1.3，见 §6 第三批）；plan `ui-optimization-plan.md` v3.2
> 承接：PR #53 首批（`2026-09-04-ui-c4-dark-theme-b1.md`）、PR #54 第二批（`2026-09-04-ui-c4-b2-solid-ink-token.md`）

## 1. 触发条件

按 `docs/ui-dark-theme-spec.md` §6 第三批路线推进 C4 收尾：设置页「外观」三态切换控件（浅色/深色/跟随系统）+ 持久化。C4 前两批已备齐 dark token 覆盖块、首帧 bootstrap、运行时 controller（`useTheme.setTheme` 已暴露待接），本批仅剩切换 UI 接线。评审提出两条 P2 后随 PR 跟进（见 §4）。

## 2. 改了什么

| 文件 | 改动 |
|---|---|
| `frontend/app/pages/settings.vue` | 「基础」组新增 **外观** 一级入口；切换面板 UI 下沉为组件引用，页面逻辑与样式删除 |
| `frontend/app/components/ThemeAppearanceCard.vue`（新） | 三态单选（跟随系统/浅色/深色）+「当前实际外观」实时回显；经 `useTheme` → `setTheme` → controller `setMode` 接线：写 `localStorage['ui-theme']` + 应用 `data-theme` + system 态实时跟随；页面/组件不直接触碰存储（持久化单点）；选项说明文字用 `--text-2`（评审 P2-1） |
| `frontend/vitest.config.ts`（新） | vitest 挂载级测试配置（happy-dom + @vitejs/plugin-vue，`tests/ui` 目录） |
| `frontend/tests/ui/theme-appearance-card.test.ts`（新） | 挂载级交互套件（详见 §3-4） |
| `frontend/tests/dark-theme-core.test.mjs` | 新增 C4 batch3 AA 守卫：`text-2 on surface-raised` 双主题 ≥4.5 实算 + 组件实际引用 token 锚定（防回退 `--text-3`） |
| `frontend/tests/dark-theme-structure.test.mjs` | 外观面板结构守卫拆分：settings 入口断言 + 组件接线断言两组（组件自注册为 Nuxt 自动导入单元） |
| `frontend/package.json` / `package-lock.json` | devDeps（vitest / @vitejs/plugin-vue / @vue/test-utils / happy-dom）；scripts：`test:ui`、`verify` 链含 `test:ui` |
| `.github/workflows/ci.yml` | CI 增加 `npm run test:ui` 步骤（与 `npm test` 同 job，强制） |

主题核心逻辑零改动（`theme-core.mjs` / `theme.client.ts` / studio.css 未变）；light 零变化。

## 3. 关键设计决策

| # | 决策 | 依据 |
|---|---|---|
| 1 | 切换面板抽独立组件 `ThemeAppearanceCard.vue`（Nuxt 自动注册），settings.vue 仅渲染引用 | 接线内聚进组件后可作为挂载级测试的可测单元；与 B1/B2 通用组件抽取范式一致 |
| 2 | 挂载级交互测试让组件跑**真实 `useTheme` + 真实 `createThemeController`**，仅以 stub `useState` 复刻 theme.client 的 Nuxt 装配 | plugin（theme.client）在挂载测试中不执行，但核心逻辑（theme-core 的解析/解析链/存储/监听）全部真实运行，零 mock——测的是真接线 |
| 3 | `useState` stub 语义对齐 Nuxt：`controller` 也以 ref 存入 state（`useTheme` 经 `controller.value` 访问） | Nuxt `useState` 暴露 Ref；首次实现裸对象入 state 导致 `controller.value` undefined、点击静默失效——由挂载测试首跑抓出后修复（详见 §4-1 调试过程） |
| 4 | 选项说明文字由 `--text-3`（dark ≈4.01:1 不达 AA）改 `--text-2`（dark ≈4.60:1），AA 守卫锚定 | 评审 P2-1：11px 普通文本需 AA ≥4.5；改动落在 spec 首批「尽力档/例外」白名单之外，须达标 |
| 5 | 新增 vitest 挂载级套件单列 script `test:ui` 并入 `verify` 与 CI | 交互层此前只有结构守卫/行为级核心测试，浏览器层行为缺失（评审 P2-2） |

## 4. 评审处理（P2 两条，随同一 PR 跟进）

| 轮次 | 意见 | 处理（对应提交） |
|---|---|---|
| P2-1（首次 review） | `.theme-opt-desc`（11px 普通文本）`--text-3` 在 dark 约 4.01:1，低于 AA 4.5 | 改 `--text-2`（dark 4.60:1）；`dark-theme-core` 新增双主题 ≥4.5 实算守卫 + 组件 token 引用锚定（防回退 `--text-3`）；structure 守卫同步（`8edf69a`） |
| P2-2（首次 review） | 缺挂载级/浏览器级交互测试（结构守卫覆盖不到的事件-状态-副作用闭环） | 面板抽 `ThemeAppearanceCard` + vitest（happy-dom + @vue/test-utils）交互套件：已存偏好首屏回显 / 三态选择即时生效（`data-theme`+选中态+文案+storage）/ 存储写入失败（隐私模式）仍即时生效 / system 下 matchMedia 实时回显与手动解除跟随、切回立即重跟（`8edf69a`） |

调试插曲（§3-3）：交互用例初版 3/4 红（点击后 storage/`data-theme` 均不变、无异常）——逐步诊断排除 DOM 事件派发（原生 dispatch 正常）、controller 装配（手动 `setMode` 生效）后定位：bootstrap 把裸 controller 对象入 `useState` state，而 Nuxt `useState` 语义为 Ref，组件 `controller.value?.setMode` 得 undefined 静默空转；改 ref 包装后 4/4 绿。该类问题唯有挂载级测试可捕获，验证了 P2-2 的成立。

## 5. 验证

- frontend `npm test`：**148/148 通过**（原 145 基线 + batch3 AA 守卫 / structure 拆分后组件接线守卫）
- `npm run test:ui`（vitest 挂载级，CI/`verify` 强制）：**4/4 通过**（真实 useTheme + 真实 controller）
- `npm run test:build`：**1/1 通过**（全新 production build + SPA 首帧 bootstrap 顺序断言）
- lint 0 诊断；diffstat 9 文件 +906/−61
- 人工：三态切换暗色视觉验收（light 零变化由 token 守卫保证）

## 6. 已知记录项 / 对后续迭代的影响

1. **C4 暗色主题完结**：spec v1.3、plan v3.2；后续暗色新增颜色 token 由「light 颜色 token 一律需 dark 档或显式豁免」守卫强制，无批内隐患。
2. 挂载级测试基础设施（vitest + happy-dom + @vue/test-utils，`tests/ui`）可在 C5（响应式）或后续交互改动中复用。
3. C5 响应式统一、P4 A11y（D 系）等为 C4 之后的独立专项，见 plan C/E 表。
