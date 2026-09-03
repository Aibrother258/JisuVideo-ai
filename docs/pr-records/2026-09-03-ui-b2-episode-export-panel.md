# PR 详细记录：B2 试点——episode.vue 拼接导出面板下沉 EpisodeExportPanel.vue

> 分支：`feat/ui-b2-episode-export-panel`
> 基准：master（最新 PR #44 `363e3d6`）
> 日期：2026-09-03（创建）
> 变更：4 文件（episode.vue +26/−318；新增 EpisodeExportPanel.vue +361；结构测试两处随组件迁移同步）
> 关联方案：`docs/ui-optimization-plan.md`（P2-B2「巨型页面拆分」）——先以风险最高、约 7400 行的 `episode.vue` 拆分试点，试点面板为「拼接导出面板」
> PR：#45（merge commit 待回填）

---

## 触发条件

P2-B1（通用组件抽取）与 B3（分页 hook 封装）已收口（PR #30–#43），下一步按 plan 推进 B2「巨型页面拆分」。episode.vue 约 7400 行（含模板/脚本/scoped 样式），本试点只拆 **拼接导出（export）面板**，原则：
1. **纯搬迁不改逻辑**：模板、面板专属状态、面板专属 scoped CSS 原样迁移；
2. **不破坏主壳全局数据流**：export 面板与主壳纠缠的状态仅三处——`mergeData`（顶栏「查看成片」/侧栏阶段/底部气泡共用）、`activeMerge`（成片大预览弹窗在主壳）、`refresh()` 内的成片列表刷新；
3. 为后续 script/production 巨型面板拆分跑通「依赖边界识别 → 组件接口 → 测试守卫迁移」的模式。

## 改了什么

| 层面 | 改动 |
|---|---|
| 新增 `components/EpisodeExportPanel.vue` | 迁移 export 面板完整模板（成片列表三态 + 镜头素材勾选网格）、镜头选择状态（`exportSelectedIds`/`exportSelTouched`/`exportReadyIds`/`isExportSelected`/`toggleExportSelect`/`toggleSelectAllExport`）、成片列表状态（`exportMerges`/`exportListLoading`/`exportListError` + `loadExportMerges`）、面板专属 scoped CSS（`.export-*`/`.merge-card*`/`.exp-*`/`.dot` + `@media(max-width:1080px)` 列布局） |
| `episode.vue` | 模板：export 分支保留空态（`.step-empty` 与 `.content-panel` 壳共享），主体替换为 `<EpisodeExportPanel>`；脚本：删除已下沉状态块，保留 `mergeError`/`lastMergeIds`（doMerge 轮询结果与重试参数）并新增 `exportListRev` 刷新令牌；`refresh()` 内 `loadExportMerges(initial)` → `exportListRev.value++`；`doMerge` 完成/失败分支同改为令牌通知；CSS 删除已下沉的 export/merge-card/exp 样式，保留 `.merge-viewer-*`（主壳成片大预览弹窗用） |
| `tests/apple-light-theme-structure.test.mjs` | `.merge-card video`/`.exp-thumb`/`.exp-thumb-duration`/`.merge-card`/`.merge-card-play`/`.exp-check` 等断言目标由 episode.vue 改为 EpisodeExportPanel.vue；组件文件并入 surfaces 链与 R5 fallback/字面量清零检查 |
| `tests/three-state-structure.test.mjs` | export panel 三态/重试断言拆分：UI 断言指向组件（emit 重试/关闭），错误写入与轮询状态断言保留主壳，新增 `exportListRev.value++` 令牌断言 |

### 组件接口

```
props:  sbs: Array      // 镜头列表（空态由主壳承接）
        episodeId: Number
        mergeError: String      // doMerge 失败信息（主壳写，组件呈现）
        listRev: Number         // 主壳 refresh/拼接完成自增，组件 watch 静默刷新
emits:  merge(ids)              // 「拼接所选」→ 主壳 doMerge
        retry-merge             // 内联错误条「重试拼接」→ 主壳 doMerge(lastMergeIds)
        clear-merge-error       // 「关闭」→ 主壳 mergeError = ''
        preview-merge(m)        // 成片卡点击 → 主壳 activeMerge = m（大预览弹窗在主壳）
```

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **doMerge/轮询/mergeData 留在主壳，只下沉面板 UI 与面板独有状态** | doMerge 的轮询更新 `mergeData`，而 `mergeData` 同时被顶栏「查看成片」/侧栏阶段进度/底部气泡共用；且拼接完成后若用户切走面板（组件卸载），轮询仍需在后台继续直到完成——把轮询留在主壳才能保证卸载后仍更新全局状态与 toast。面板自身的选择状态与列表三态无全局耦合，安全下沉 |
| **`exportListRev` 刷新令牌替代跨层方法调用** | 原 `refresh()` 直接调用 `loadExportMerges(initial)`；下沉后列表状态在子组件。令牌方案：refresh/拼接完成仅 `exportListRev++`，子组件 watch 到变化即静默刷新；面板未挂载时令牌空转无副作用，切回面板时 `onMounted → loadExportMerges(true)` 自取最新并走 initial 三态——行为与原先「随时可切面板看到最新列表」一致，且避免父子方法互相穿透 |
| **空态（`!sbs.length`）留在主壳** | `.step-empty/.empty-*`/`.content-panel` 均为主壳 scoped 且 script/production 面板共用，留在主壳避免在子组件内复制共享类（B2「跨页重复 CSS 归零」精神）；组件仅携带 `export-*` 独有样式，`.dot/.dot.ok` 因 exp-row-line 使用而随组件携带（值与主壳版本一致） |
| **`activeMerge` 大预览弹窗留在主壳** | 弹窗由 `.merge-viewer-*` scoped 样式支撑且属页面级 overlay；组件只负责发出 `preview-merge` 事件，主壳设 `activeMerge` |
| **事件命名区分发起与重试** | 拼接按钮传选中 ids（`emit('merge', exportSelectedReadyIds)`）；重试按钮无参发 `retry-merge`，主壳回放 `lastMergeIds`（保持轮询/失败记录在主壳单一数据源） |

## 回归测试

- `npm test`：tests 100 / pass 100 / fail 0 / skipped 0。
- `npm run build`：通过（Client + Server 均成功）。
- 拆分后 episode.vue 由 7069 行降至 6782 行（净 −287 行）；EpisodeExportPanel.vue 361 行，远低于面板 ≤1200 行目标。

## 对后续迭代的影响

- **B2 拆分模式成型**：巨型面板拆分的可复用裁决规则——① 与主壳全局状态（顶栏/侧栏/弹窗共用）纠缠的逻辑留主壳、以令牌/事件协作；② 纯 UI 状态与面板独有样式整体下沉；③ scoped 共享类（空态/布局壳）不复制进子组件；④ 结构测试守卫随 CSS/模板迁移同步改目标文件，保证迁移后仍被断言覆盖。
- 后续 script/production 巨型面板拆分沿用同一模式；EpisodeExportPanel 为 `components/` 下 episode 专用面板组件（命名带 Episode 前缀防误用），后续面板若跨页面复用再提升为通用组件。
- 主壳仍约 6759 行，B2 剩余拆分按 plan 继续排期（script 面板为下一个候选）。

## 注意事项

- 组件根节点为 `.export-split`，其父容器仍是主壳保留的 `<div class="content-panel">`（scoped flex 布局在主壳），勿在子组件内重复声明 `.content-panel`。
- `mergeError` 显示依赖主壳 doMerge 写 ref、经 prop 下发；若后续把发起/轮询也下沉组件，需先解决「组件卸载后轮询与全局 mergeData 同步」问题（本试点刻意保留主壳，避免行为回归）。
