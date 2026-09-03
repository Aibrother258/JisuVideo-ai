# PR 详细记录：B2 试点——episode.vue 拼接导出面板下沉 EpisodeExportPanel.vue

> 分支：`feat/ui-b2-episode-export-panel`
> 基准：master（最新 PR #44 `363e3d6`）
> 日期：2026-09-03（创建）
> 变更：5 文件 2 提交——`b616b73`（迁移：episode.vue +26/−318、新增 EpisodeExportPanel.vue +361、结构测试两处）+ 自查修复提交（episode.vue +24/−4、组件 25/25、three-state 测试 +11）
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
| 新增 `components/EpisodeExportPanel.vue` | 迁移 export 面板完整模板（成片列表三态 + 镜头素材勾选网格）、成片列表状态（`exportMerges`/`exportListLoading`/`exportListError` + `loadExportMerges`）、勾选交互（`isExportSelected`/`toggleExportSelect`/`toggleSelectAllExport`，受控渲染）、面板专属 scoped CSS（`.export-*`/`.merge-card*`/`.exp-*`/`.dot` + `@media(max-width:1080px)` 列布局） |
| `episode.vue` | 模板：export 分支保留空态（`.step-empty` 与 `.content-panel` 壳共享），主体替换为 `<EpisodeExportPanel>`；脚本：保留并延续页面级勾选状态（`exportSelectedIds`/`exportSelTouched`/`exportReadyIds` + watch 自动全选）、`mergeError`/`lastMergeIds`、新增 `exportListRev` 刷新令牌；`refresh()` 内 `loadExportMerges(initial)` → `exportListRev.value++`；`doMerge` 完成/失败分支同改为令牌通知；CSS 删除已下沉的 export/merge-card/exp 样式，保留 `.merge-viewer-*`（主壳成片大预览弹窗用） |
| `tests/apple-light-theme-structure.test.mjs` | `.merge-card video`/`.exp-thumb`/`.exp-thumb-duration`/`.merge-card`/`.merge-card-play`/`.exp-check` 等断言目标由 episode.vue 改为 EpisodeExportPanel.vue；组件文件并入 surfaces 链与 R5 fallback/字面量清零检查 |
| `tests/three-state-structure.test.mjs` | export panel 三态/重试断言拆分：UI 断言指向组件（emit 重试/关闭），错误写入与轮询状态断言保留主壳，新增 `exportListRev.value++` 令牌断言 |

### 组件接口

```
props:  sbs: Array               // 镜头列表（空态由主壳承接）
        episodeId: Number
        selectedIds: Array       // 勾选的镜头 id（页面级受控：主壳持 exportSelectedIds，跨面板切换保留）
        mergeError: String       // doMerge 失败信息（主壳写，组件呈现）
        listRev: Number          // 主壳 refresh/拼接完成自增，组件 watch 静默刷新
emits:  update:selectedIds(ids)  // 勾选/全选交互新集合 → 主壳 onExportSelectedChange
        merge(ids)               // 「拼接所选」→ 主壳 doMerge
        retry-merge              // 内联错误条「重试拼接」→ 主壳 doMerge(lastMergeIds)
        clear-merge-error        // 「关闭」→ 主壳 mergeError = ''
        preview-merge(m)         // 成片卡点击 → 主壳 activeMerge = m（大预览弹窗在主壳）
```

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **doMerge/轮询/mergeData 留在主壳** | doMerge 的轮询更新 `mergeData`，而 `mergeData` 同时被顶栏「查看成片」/侧栏阶段进度/底部气泡共用；且拼接完成后若用户切走面板（组件卸载），轮询仍需在后台继续直到完成——把轮询留在主壳才能保证卸载后仍更新全局状态与 toast |
| **镜头勾选为页面级受控状态（主壳持有，组件受控渲染）** | 自查评审修复：迁移前 `exportSelectedIds` 是主壳页面级状态，用户在 script/production/export 面板间切换时勾选保留、且 sbs 就绪/变化（未手动勾选过）时自动全选；若随组件下沉，切 tab 组件卸载将清空选择并丢失自动全选时机（重挂载时 sbs 已稳定、watch 不触发）→ 需手动重新全选才能拼接，属行为回归。修复：状态留在主壳（`exportSelectedIds`/`exportSelTouched`/`exportReadyIds` + watch 自动全选），组件以 `:selected-ids` + `@update:selected-ids` 受控渲染与上报——与 mergeData 留主壳是同一裁决延伸（与页面级状态纠缠的数据不随组件销毁） |
| **`exportListRev` 刷新令牌替代跨层方法调用** | 原 `refresh()` 直接调用 `loadExportMerges(initial)`；下沉后列表状态在子组件。令牌方案：refresh/拼接完成仅 `exportListRev++`，子组件 watch 到变化即静默刷新；面板未挂载时令牌空转无副作用，切回面板时 `onMounted → loadExportMerges(true)` 自取最新并走 initial 三态——行为与原先「随时可切面板看到最新列表」一致，且避免父子方法互相穿透 |
| **空态（`!sbs.length`）留在主壳** | `.step-empty/.empty-*`/`.content-panel` 均为主壳 scoped 且 script/production 面板共用，留在主壳避免在子组件内复制共享类（B2「跨页重复 CSS 归零」精神）；组件仅携带 `export-*` 独有样式，`.dot/.dot.ok` 因 exp-row-line 使用而随组件携带（值与主壳版本一致） |
| **`activeMerge` 大预览弹窗留在主壳** | 弹窗由 `.merge-viewer-*` scoped 样式支撑且属页面级 overlay；组件只负责发出 `preview-merge` 事件，主壳设 `activeMerge` |
| **事件命名区分发起与重试** | 拼接按钮传选中 ids（`emit('merge', exportSelectedReadyIds)`）；重试按钮无参发 `retry-merge`，主壳回放 `lastMergeIds`（保持轮询/失败记录在主壳单一数据源） |

## 自查发现与修复（提交 PR 后、评审前逐项比对 master 行为）

对 PR #45 相对 master 做了模板/状态/CSS 三向逐项比对，发现 2 个行为差异已修复，其余为记录项：

| # | 自查发现 | 结论 | 处理 |
|---|---|---|---|
| 1 | 镜头勾选状态随组件下沉后，切 tab（组件卸载）选择清空；重挂载时 sbs 已稳定、`watch(exportReadyIds)` 不触发，自动全选丢失 | **行为回归**（迁移前为页面级状态，切面板保留勾选、sbs 就绪即自动全选） | 已修复：状态提升回主壳受控（`:selected-ids` + `@update:selected-ids`），组件仅渲染/交互；配套新增结构测试断言 |
| 2 | 迁移前 doMerge 完成调 `loadExportMerges(true)`（成功即清空列表错误横幅）；令牌方案为静默刷新，成片列表此前加载失败的错误横幅在拼接完成后残留 | 轻微差异 | 已修复：组件 `loadExportMerges` 成功后清除过时的 `exportListError`，并补断言 |
| 3 | 首次进入 export tab（此前组件未挂载）：迁移前页面级 refresh 已预加载列表（无骨架）；新方案挂载时拉取显示一次骨架 | 记录项 | 列表始终为最新数据，初次骨架极短暂，接受 |
| 4 | 页面初始即停在 export tab 时：组件 onMounted 拉取 + refresh 令牌可能重复一次列表 GET | 记录项 | 幂等只读请求，无功能影响，接受 |
| 5 | `shotVidCount`（`video_url/videoUrl`）与 `hasVid`（含 `composed_*` 回退）口径不一致 | 预存在 | master 同样存在，迁移保持原样，留待统一 |

## 回归测试

- `npm test`：tests 100 / pass 100 / fail 0 / skipped 0（含自查修复新增的受控选择/错误清除断言）。
- `npm run build`：通过（Client + Server 均成功）。
- 拆分后 episode.vue 由 7069 行降至 6802 行（净 −267 行，含修复回增 ~20 行页面级选择状态）；EpisodeExportPanel.vue 350 行，远低于面板 ≤1200 行目标。

## 对后续迭代的影响

- **B2 拆分模式成型**：巨型面板拆分的可复用裁决规则——① 与主壳全局状态（顶栏/侧栏/弹窗共用）纠缠的逻辑留主壳、以令牌/事件协作；② 用户可见的页面级状态（跨面板切换需保留，如本面板勾选集合）同样留主壳受控，仅纯 UI 状态（列表三态）与面板独有样式整体下沉；③ scoped 共享类（空态/布局壳）不复制进子组件；④ 结构测试守卫随 CSS/模板迁移同步改目标文件，保证迁移后仍被断言覆盖。
- 后续 script/production 巨型面板拆分沿用同一模式；EpisodeExportPanel 为 `components/` 下 episode 专用面板组件（命名带 Episode 前缀防误用），后续面板若跨页面复用再提升为通用组件。
- 主壳仍约 6759 行，B2 剩余拆分按 plan 继续排期（script 面板为下一个候选）。

## 注意事项

- 组件根节点为 `.export-split`，其父容器仍是主壳保留的 `<div class="content-panel">`（scoped flex 布局在主壳），勿在子组件内重复声明 `.content-panel`。
- `mergeError` 显示依赖主壳 doMerge 写 ref、经 prop 下发；若后续把发起/轮询也下沉组件，需先解决「组件卸载后轮询与全局 mergeData 同步」问题（本试点刻意保留主壳，避免行为回归）。
- 勾选集合是页面级受控状态：改勾选入口只须 `emit('update:selectedIds', next)`，主壳 `onExportSelectedChange` 置 `exportSelTouched = true` 后不再自动全选；自动全选仅发生在用户未手动操作且 sbs 集合变化时（与迁移前一致）。后续拆分面板若有跨面板保留的用户选择/输入，沿用本「受控提升」模式，勿放组件内一次性状态。

---

## 评审回复（2026-09-03，PR #45 P1 修复）

Reviewer（Aibrother258）结论：**暂不建议合并**，需先修复 1 个 P1 状态一致性问题后复审；组件边界、受控 `selected-ids`、`mergeData`/轮询留主壳等均确认保留，其余不构成阻塞。

### P1：成片列表并发请求无「最新请求获胜」保护

- **入口**：面板挂载 `onMounted(() => loadExportMerges(true))`、主壳 `refresh()`/拼接轮询完成递增 `exportListRev` 触发的静默刷新 watch、用户点「刷新」`loadExportMerges(true)`；
- **旧实现缺陷**（组件 `EpisodeExportPanel.vue` 内裸写三态）：请求无取消/序列号/有效性校验。网络返回乱序时：后发请求已拿到最新成片、先发请求随后返回旧列表覆盖（新成片暂时「消失」）；旧 initial 请求在新请求成功后失败会把 `exportListError` 错误横幅写回一份已成功刷新的列表；旧 initial 的 `finally` 还会关闭较新 initial 请求仍在进行的 loading。
- **修复**：把成片列表三态抽为 `composables/useExportMergesList.ts`（复用 B3/PR #43 paged-hook 的「最新请求获胜」模式）——每次读取递增本地 request revision 并捕获当次 `episodeId`，仅当 `seq === reqSeq`、组件仍挂载（`active`）、`episodeId` 未变化时才允许写 `exportMerges`/`exportListError`/loading；loading 收尾统一由全局最新请求承担（旧请求 `finally` 不得关闭较新 initial 的 loading，被静默刷新超越的旧 initial 也不悬挂）。组件改为消费该 composable：`onMounted` 先 `setActive(true)` 再走 initial 三态，`onUnmounted` `setActive(false)` 使卸载/剧集切换后的迟到响应一律作废。
- **回归测试**：新增 `tests/episode-export-panel-behavior.test.mjs`（受控 Promise，同 paged-hook-behavior 模式）覆盖：① A（挂载 initial）后发起 B（listRev 静默刷新），B 先成功、A 后成功 → 保持 B 列表；② A 后失败（晚于 B 成功）→ 不写错误横幅；③ 手动刷新（新 initial）先成功、旧 initial 后完成 → 保持新列表且 loading 由最新请求收尾；④ 卸载后迟到响应（成功与失败）不写状态；⑤ episodeId 变更后旧剧集迟到响应丢弃；⑥ 无并发时 initial 失败仍内联错误 + 重试成功清错。结构测试同步更新为断言三态收敛 composable 的解构与约束（`seq !== reqSeq` 丢弃 / `seq === reqSeq && active` 收尾）。
- **验证**：`npm test` 106/106 通过（此前 100/100）；`npm run build` 通过（停容器后于完整依赖环境复跑，未污染共享 dev 缓存）；dev 容器重启后 3013 页面恢复 dev 资源正常渲染（`@vite/client`、API 200）。
