# PR 详细记录：B1 batch2——detail/episode 标准弹窗迁移至 AppDialog、新增 dialogStyle

> 分支：`feat/ui-b1-dialog-pages`
> 基准：master（含 PR #30 `c9be4df`）
> 日期：2026-09-03（合入）
> 变更：4 文件（+147/−111，基准 `c9be4df` 至 merge `04b128a` 最终差异）
> 关联方案：`docs/ui-optimization-plan.md`（v2.0）P2-B1「通用组件抽取」
> PR：#31（merge commit `04b128a`，提交 `e9ee0e2`）

---

## 触发条件

batch1（PR #30）把 settings 四个标准弹窗迁入 AppDialog 并明确「仅标准 head/body/foot 弹窗迁入」边界后，本批把该规则应用到业务主页面：detail.vue「创建新集」（`addDialog`）、episode.vue「新增资产」（`assetCreate.open`）与「选择参考资产」（`refAssetPicker.open`）三处骨架同构弹窗。其中参考资产选择器是 episode 工作台内层级最高的标准弹窗（原 `z-index:120` 覆盖普通浮层），迁移需验证层级与尺寸行为不回归。

## 改了什么

| 层面 | 改动 |
|---|---|
| AppDialog.vue | 新增 `dialogStyle?: Record<string, string>` prop，与 `width` 合并到 `:style` 数组——用于 `maxHeight`/`maxWidth` 等宽度之外的内联约束（参考资产选择器的 `maxHeight: 'min(760px, calc(100vh - 48px))'`） |
| detail.vue | 「创建新集」弹窗迁至 `<AppDialog v-if="addDialog" width="min(480px, 100%)">`；head 槽放标题，foot 槽放取消/创建按钮；原 `.dialog-body` 覆盖迁移为页面插槽内私有容器 `.ep-add-fields` |
| episode.vue | 「新增资产」迁至 `<AppDialog v-if="assetCreate.open" width="440px">`、「参考资产选择」迁至 `<AppDialog v-if="refAssetPicker.open" width="min(920px, calc(100vw - 48px))" dialogStyle="{ maxHeight: ... }" class="ref-asset-picker-overlay">`；`@close` 复用原关闭路径 |
| 测试 | 新增 B1 batch2 断言组：三处迁移、`class="ref-asset-picker-overlay"`（组件根透传 z-index:120）、width/maxHeight 内联、body 私有容器类保留、手写 `.ref-asset-picker-dialog` 清零 |

## 评审处理（一轮 APPROVED）

| 反馈 | 处理 |
|---|---|
| 复核通过：创建新集标题/分辨率/创建动作、新增资产三类表单字段与保存动作、参考资产选择器 920px 响应宽度 + 760px 最大高度 + 内容区滚动 + z-index:120 均保留原调用；`dialogStyle` 与 `width` 合并不改变现有宽度逻辑；85/85 通过 | 无代码修改 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **迁移对象严格按「标准弹窗」筛选** | batch1 评审边界落地：本批三处均为 head/body/foot 三段骨架；detail 的素材详情、episode 的图片 viewer / 资产详情 overlay 属深度定制，留待单独设计（结构测试断言其手写骨架仍在页面，形成守卫） |
| **新增 `dialogStyle` 而非扩 width 语义** | `maxHeight` 等是多维内联样式，塞进 width 字符串违反单一职责；以对象型 prop 追加进 `:style` 数组，与 width 合并后**后出现者覆盖**（评审确认不改现有宽度逻辑） |
| **overlay 修饰经组件根 class 透传** | `ref-asset-picker-overlay` 的 `z-index:120` 是页面既有提升需求，组件根 `.overlay` 继承调用页 scope 后该 class 正常命中——组件不需要内置 z-index 参数 |

## 回归测试

- 结构测试 85/85 通过（本机 node v22 实跑；batch1 后 84/84 + 本批断言组）。
- 评审差异空白检查通过；内容区滚动责任随 body 插槽容器保留在页面，未丢失。

## 对后续迭代的影响

- detail.vue 素材详情弹窗、episode.vue 图片 viewer 与资产详情 overlay 保持手写（结构测试守卫），构成 B1 系列「标准弹窗 vs 深度定制」的边界样本。
- 任务抽屉（episode.vue `taskDrawer`）按评审口径「应单独设计后再迁移」，进入 batch3（AppDrawer）处理。

## 注意事项

- 页面内宽高类（`.ref-asset-picker-dialog` 等）已删除，改由 `width`/`dialogStyle` 提供——新增标准弹窗一律走 AppDialog props，不新增手写骨架类。
- 归档机制沿用：本批归档随后续 docs 小 PR 进入 master。
