# Episode UI B2（第二批）：剧本（script）面板下沉 `EpisodeScriptPanel`

> 迭代：# 批 B2 · script 面板（#45 试点后第二块）
> PR：#47（merge commit 待回填）
> 日期：2026-09-04
> 版本：随本批迭代方案推进计划 v2.8（本批合入后由收尾文档提交统一归档）
> 修订：2026-09-04 P2 评审（Request changes）修复：① 状态分支条件回归（「空内容 + 其他 Agent 运行」保持可编辑编辑器）+ 状态矩阵纯函数化与行为测试；② 父子接线双向结构守卫。详见 §7。

## 1. 迭代背景与触发

- #45（B2 试点——export 面板下沉 `EpisodeExportPanel`）合入后，拆分模式成型；其归档「对后续迭代的影响」明确 **script 面板为下一拆分候选**。
- episode.vue 仍是巨型页面（B2 拆分目标）；script 面板（SCRIPT PANEL 区块）状态与主壳底部气泡、侧栏步骤导航、localStorage 持久化、刷新后内容重置深度纠缠，是 B2 中与主壳耦合度最高的一块之一，作为第二批试点验证「高纠缠面板」的拆分边界。

## 2. 决策与拆分边界

| # | 决策 | 依据 |
|---|---|---|
| 1 | 编辑器工具条 + 全文文本域（Step0 原始内容 / Step1 AI 改写两态）下沉 `EpisodeScriptPanel.vue`（125 行，自包含 scoped CSS） | 编辑器专属类（`.step-toolbar/.toolbar-left/.toolbar-right/.step-indicator/.step-num/.step-name/.char-count/.step-editor/.fill-textarea`）经全模板扫描仅 SCRIPT 面板使用，可整体下沉不留主壳 |
| 2 | 编辑缓冲 `localRaw/localScript` 受控提升留在主壳，以 `:raw/:script` 下发、`update:raw/update:script` 回写 | 跨面板保留（切 tab 不丢输入）+ 刷新后 watch(rawContent/scriptContent) 重置逻辑在主壳；沿用 #45 受控模式，`rawLen/scriptLen` 计算随模板下沉组件内 derived |
| 3 | `saveRaw/saveScr/skipRewrite/doRewrite` 与 `rn/rt` 运行态留主壳，经 `save-raw/rewrite/skip-rewrite` 事件触发 | 改写完成需 `refresh` 全剧数据（后台 runAgent 完成后按 episode 拉取刷新），无法在卸载的子组件内执行；底部气泡/侧栏导航亦共用 `scriptStep`/编辑缓冲 |
| 4 | 改写引导空态（`.step-empty`）与改写进行中整块加载态（`.step-loading`）留主壳 | 两类共享态样式与 production guard 空态、assets 提取中、分镜拆分中（主壳 `.step-empty/.step-loading/.empty-*/.loading-text`）共用，不复制进子组件（#45 同款裁决） |
| 5 | 改造后 step1 的「改写引导 / 改写进行中 / 文本域」三态条件整体上移到主壳分支：引导态与进行中态直接主壳渲染，编辑器态渲染组件 | 条件判定全部为主壳可直接访问的页面级状态（`scriptStep/scriptContent/rn/rt`），不引入组件二次状态 |
| 6 | 新组件沿用 Episode 前缀 + 显式 `import LoadingButton`，CSS 断点 860px 的 `.toolbar-right flex-wrap` 随组件迁移（主壳 860px 媒体仅余 `.step-bubble/.export-bar`） | 与 EpisodeExportPanel 命名/import 规范一致；grep 校验无跨面板复用 `.toolbar-right` |

## 3. 改动文件

| 文件 | 改动 |
|---|---|
| `frontend/app/views/drama/episode.vue` | SCRIPT PANEL 主体（约 90 行模板）替换为「空态 / 改写中 / EpisodeScriptPanel」三分支（P2 修复后分支引用 `scriptPanelState` computed，见 §7）；脚本删除下沉的 `rawLen/scriptLen` computed、新增组件与状态纯函数 import、`scriptPanelState` computed；scoped CSS 删除编辑器专属类 26 行（`.prod-toolbar` 单行保留）；860px 媒体删除 `.toolbar-right`。主壳净减约 42 行 |
| `frontend/app/components/EpisodeScriptPanel.vue` | 新增（125 行）：Step0/Step1 工具条 + 全文文本域受控渲染；props `step/raw/script/hasRaw/hasScript/running/taskType`，emits `save-raw/rewrite/skip-rewrite/update:raw/update:script`；字数统计 derived；scoped CSS 含 860px flex-wrap |
| `frontend/app/utils/episode-script-state.mjs` | 新增：Step1 分支状态矩阵纯函数 `resolveScriptPanelState`（P2 修复，自原模板内联条件提出，语义与拆分前 master 对齐） |
| `frontend/tests/episode-script-state-behavior.test.mjs` | 新增：状态矩阵行为测试 8 用例（P2 修复，含「空内容 + 其他 Agent 运行 → editor」回归守卫） |
| `frontend/tests/apple-light-theme-structure.test.mjs` | 剧本改写按钮 `:loading/:disabled` 断言目标由 episode.vue 改至 EpisodeScriptPanel.vue（B1 batch7 迁移守卫随拆分迁移）；P2 修复后补父子接线双向守卫与 Step0/1 受控 textarea 断言 |

## 4. 行为等价与回归验证

- 结构测试 124/124 通过（116 基线 + 8 条状态矩阵行为用例；含迁移守卫：episode.vue 空态/加载态共享样式断言仍在主壳；LoadingButton 表达式断言已指向新组件；接线双向守卫见 §7）。
- `npm run build` 通过；`npm run generate` 通过。
- 交互路径逐一核对：
  - Step0 输入 → 字数统计 → 保存（`save-raw` → `saveRaw() + toast`）；切 panel 再回内容不丢（主壳受控缓冲）。
  - Step1 有已生成剧本 → 文本域 + 字数 + 「重新改写」LoadingButton（`running && taskType !== 'script_rewriter'` 禁用）；他任务运行时按钮禁用。
  - Step1 无剧本内容且全部 Agent 空闲 → 改写引导空态（「开始改写/跳过改写」主壳直调 `doRewrite/skipRewrite`）。
  - Step1 无剧本内容但其他 Agent 运行 → 编辑器（可手工编辑；不落入空态，亦无误导性「开始改写」按钮）——P2 修复点，见 §7。
  - 改写运行中 → 整块加载态「正在改写剧本…」，完成后 refresh → 文本域态。
  - 底部气泡 prev/next、侧栏步骤导航、localStorage 持久化逻辑全部留主壳，未触碰。

## 5. 已知记录项（视觉微差）

1. 改写引导空态与「改写进行中」整块加载态不再显示顶部的 `02 AI 改写` 步骤工具条（原空态下工具条仅有步骤指示与「跳过改写」按钮，而空态 actions 内已含「跳过改写」入口，功能无缺失）。评审可复核。
2. 原实现「改写进行中」状态下 LoadingButton 局部 spinner 收敛为整块加载态；改写在途不可编辑文本域的交互语义未变（原 loading 分支同样以加载块替换文本域）。

## 6. 对后续迭代的影响

- episode.vue 主壳净减 50 行；SCRIPT PANEL 模板区从主壳剥离为三分支壳（约 40 行），编辑器细节进子组件。
- B2 拆分模式新增一条实证：**「带工具栏的三态面板」在共享态样式与工具栏纠缠时，以『共享态（空态/进行中）留主壳整页渲染 + 编辑器态下沉组件 + 条件判定全部落在主壳可直接访问的页面级状态』为可复用的拆分形态**。
- 剩余拆分候选：assets（角色/场景/道具，与全局生成/上传状态纠缠最深）、storyboard 工作台、video-tasks、task-drawer 内容；以及 C3（各页面接入 `usePagedList`）。

## 7. P2 评审修复记录（2026-09-04，Request changes → 修订）

评审 2 条意见与修复对照：

1. **[P2] 行为回归：「无已保存剧本 + 其他 Agent 运行」从「可编辑」退化为改写引导空态**（原空态条件误写成 `!(rn && rt === 'script_rewriter')`，非拆分前 master 的 `!rn`；空态中「开始改写」又会命中 useAgent 运行中守卫，造成不可编辑 + 误导按钮双重问题）。
   - 修复：状态矩阵提为纯函数 `resolveScriptPanelState`（`frontend/app/utils/episode-script-state.mjs`），语义与拆分前 master 逐一对齐——`empty-guide` 仅当 `step===1 && 无内容 && !running`；`script_rewriter` 运行中整块 `rewriting` 态；其余一律 `editor`（含其他 Agent 运行时的手工编辑场景）。episode.vue 经 `scriptPanelState` computed 渲染三分支，模板不再内联条件。
   - 行为变更声明：**无**。本 PR 保持纯搬迁，master 状态矩阵未改。

2. **[P2/Test] 新组件缺少真实父子通信与分支行为测试**。
   - 采用评审给出的「纯函数 + 直接单测」路线（项目测试栈无 DOM/test-utils，沿用 `episode-plan-state` 既有纯函数先例）：
     - `tests/episode-script-state-behavior.test.mjs`：8 条状态矩阵用例，重点覆盖回归守卫「空内容 + 其他 Agent 运行 → editor（仍可手工编辑）」及空态/加载态/编辑态归属；
     - `apple-light-theme-structure.test.mjs`：补父子接线双向守卫（父壳 `:step/:raw/:script` 受控下发、`update:raw/update:script` 回写、`save-raw/rewrite/skip-rewrite` 事件；组件端对应 `emit(...)`），Step0/1 受控 textarea 断言。
   - 说明：组件挂载级事件测试需引入 @vue/test-utils + DOM 运行环境（新依赖、新测试类别），超出本 PR 范围；以纯函数状态测试 + 接线双向守卫覆盖评审点，如需组件级 DOM 测试可单独立项。
