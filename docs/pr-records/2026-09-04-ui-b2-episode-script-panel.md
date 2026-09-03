# Episode UI B2（第二批）：剧本（script）面板下沉 `EpisodeScriptPanel`

> 迭代：# 批 B2 · script 面板（#45 试点后第二块）
> PR：#47（merge commit 待回填）
> 日期：2026-09-04
> 版本：随本批迭代方案推进计划 v2.8（本批合入后由收尾文档提交统一归档）

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
| `frontend/app/views/drama/episode.vue` | SCRIPT PANEL 主体（约 90 行模板）替换为「空态 / 改写中 / EpisodeScriptPanel」三分支；脚本删除下沉的 `rawLen/scriptLen` computed、新增组件 import；scoped CSS 删除编辑器专属类 26 行（`.prod-toolbar` 单行保留）；860px 媒体删除 `.toolbar-right`。主壳净 -50 行 |
| `frontend/app/components/EpisodeScriptPanel.vue` | 新增（125 行）：Step0/Step1 工具条 + 全文文本域受控渲染；props `step/raw/script/hasRaw/hasScript/running/taskType`，emits `save-raw/rewrite/skip-rewrite/update:raw/update:script`；字数统计 derived；scoped CSS 含 860px flex-wrap |
| `frontend/tests/apple-light-theme-structure.test.mjs` | 剧本改写按钮 `:loading="running && taskType === 'script_rewriter'"` 与 `:disabled` 断言目标由 episode.vue 改至 EpisodeScriptPanel.vue（B1 batch7 迁移守卫随拆分迁移，注释同步说明） |

## 4. 行为等价与回归验证

- 结构测试 116/116 通过（含迁移守卫：episode.vue 空态/加载态共享样式断言仍在主壳；LoadingButton 表达式断言已指向新组件）。
- `npm run build` 通过；`npm run generate` 通过。
- 交互路径逐一核对：
  - Step0 输入 → 字数统计 → 保存（`save-raw` → `saveRaw() + toast`）；切 panel 再回内容不丢（主壳受控缓冲）。
  - Step1 有已生成剧本 → 文本域 + 字数 + 「重新改写」LoadingButton（`running && taskType !== 'script_rewriter'` 禁用）；他任务运行时按钮禁用。
  - Step1 无剧本内容且非改写运行 → 改写引导空态（「开始改写/跳过改写」主壳直调 `doRewrite/skipRewrite`）。
  - 改写运行中 → 整块加载态「正在改写剧本…」，完成后 refresh → 文本域态。
  - 底部气泡 prev/next、侧栏步骤导航、localStorage 持久化逻辑全部留主壳，未触碰。

## 5. 已知记录项（视觉微差）

1. 改写引导空态与「改写进行中」整块加载态不再显示顶部的 `02 AI 改写` 步骤工具条（原空态下工具条仅有步骤指示与「跳过改写」按钮，而空态 actions 内已含「跳过改写」入口，功能无缺失）。评审可复核。
2. 原实现「改写进行中」状态下 LoadingButton 局部 spinner 收敛为整块加载态；改写在途不可编辑文本域的交互语义未变（原 loading 分支同样以加载块替换文本域）。

## 6. 对后续迭代的影响

- episode.vue 主壳净减 50 行；SCRIPT PANEL 模板区从主壳剥离为三分支壳（约 40 行），编辑器细节进子组件。
- B2 拆分模式新增一条实证：**「带工具栏的三态面板」在共享态样式与工具栏纠缠时，以『共享态（空态/进行中）留主壳整页渲染 + 编辑器态下沉组件 + 条件判定全部落在主壳可直接访问的页面级状态』为可复用的拆分形态**。
- 剩余拆分候选：assets（角色/场景/道具，与全局生成/上传状态纠缠最深）、storyboard 工作台、video-tasks、task-drawer 内容；以及 C3（各页面接入 `usePagedList`）。
