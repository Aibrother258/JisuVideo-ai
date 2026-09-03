# PR 详细记录：B1 batch3——AppDrawer 右侧抽屉组件 + episode 任务抽屉迁移

> 分支：`feat/ui-b1-dialog-batch3`
> 基准：master（含 PR #31 `04b128a`）
> 日期：2026-09-03（合入）
> 变更：3 文件（+223/−122，基准 `04b128a` 至 merge `e23ec12` 最终差异）
> 关联方案：`docs/ui-optimization-plan.md`（v2.0）P2-B1「通用组件抽取」
> PR：#32（merge commit `e23ec12`，提交 `845d78f`）

---

## 触发条件

batch2（PR #31）评审把任务抽屉明确为「单独设计后再迁移」的深度定制对象；episode.vue 生成任务抽屉是工作台内唯一右侧滑出浮层，手写 `.task-drawer-overlay > .task-drawer > head/metrics/body` 骨架与局部 `@keyframes taskDrawerIn`。B1 的 AppDrawer 抽取以它为迁移面：把抽屉骨架（右滑遮罩、面板宽度/全高/滑入动画、Esc/遮罩关闭协议）下沉组件，任务表格、轮询、刷新、失败重试、图片/视频预览与视频生产链路一概不动。

## 改了什么

| 层面 | 改动 |
|---|---|
| 新增 `frontend/app/components/AppDrawer.vue` | 收敛右侧抽屉骨架：`.overlay.app-drawer-overlay`（复用全局 `.overlay` 遮罩/淡入，scoped 覆盖 `justify-content:flex-end` 把面板移到右端 + `z-index:118`）、`.app-drawer` 面板（flex 列、`--panel-bg`/`--panel-border`/`--shadow-xl`、`appDrawerIn var(--dur-med) var(--ease-out)` 滑入，复用 A3 动效 token）、`.app-drawer-head` 头槽；props `width`/`drawerStyle`/`ariaLabel`/`escClose`/`maskClose`（与 AppDialog API 对齐）；关闭协议统一 emit `close` |
| episode.vue | 任务抽屉手写骨架清零（`.task-drawer-overlay`/`.task-drawer`/`.task-drawer-head` 结构类与 `@keyframes taskDrawerIn` 删除），迁移为 `<AppDrawer v-if="taskDrawer" width="min(560px, 100vw)" :esc-close="false" @close="closeTaskDrawer">` + `#head` 槽（标题/元信息/刷新/关闭）+ 默认插槽（metrics/错误/骨架/空态/任务表格）；内容级布局类（`.task-drawer-head-actions`/`-metrics`/`-body`/`-empty`）保留页面 scoped |
| 测试 | B1 batch3 断言组：组件骨架（右端定位/z-index/遮罩关闭）、episode 迁移（width prop、`#head` 槽、`@close="closeTaskDrawer"`、`:esc-close="false"` 显式声明）、手写抽屉骨架清零 |

## 评审处理（一轮 APPROVED）

| 反馈 | 处理 |
|---|---|
| 复核通过：抽屉保持右侧贴边、全高、560px 响应宽度、z-index:118 与滑入动效；任务表格/骨架/空态/错误重试/metrics 仍在页面插槽，样式与滚动责任未丢失；**Esc 没有重复注册——AppDrawer 显式关闭自身 Esc，由页面按「图片预览→资产详情→任务抽屉」既有优先级统一处理**，顶层预览关闭不误关底层抽屉；86/86 通过 | 无代码修改 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **`esc-close=false`：抽屉 Esc 不上移组件，沿用页面级关闭协议** | episode 任务抽屉的 Esc 由 `handleImageViewerKeydown` 按优先级处理（imageViewer → assetDetail → taskDrawer）；若 AppDrawer 按默认注册 Esc，会在 imageViewer/assetDetail 叠层打开时被最上层误关，破坏既有键盘协议。AppDrawer 保留 `escClose` 能力但本迁移面显式关闭——**通用组件不自作主张，行为归属调用页**（评审明确认可该设计） |
| **动效复用 A3 token** | 抽屉滑入 `appDrawerIn` 在组件内定义 keyframes 但时长/缓动引 `var(--dur-med)/var(--ease-out)`，纳入 A3 归一档字面量清零守卫，不新造档位 |
| **骨架下沉、内容级布局留在页面** | 抽屉面板/头栏是「壳」，任务区布局（metrics 栅格、滚动 body、空态）是页面业务私有，插槽内容仍在页面作用域编译，scoped 类正常命中——与 AppDialog 同一原则 |
| **z-index 语义经 scoped 覆盖而非 prop** | 全局 `.overlay` 是 `z-index:100` 档，抽屉需 118（高于普通浮层低于 viewer/资产详情）；`.app-drawer-overlay` 在组件 scoped 内声明 `z-index:118`，既是组件默认语义也允许调用页经根 class 覆盖 |

## 回归测试

- 结构测试 86/86 通过（本机 node v22 实跑；batch2 后 85/85 + 本批断言组）。
- 评审差异空白检查通过；Esc 行为经优先级协议回归路径（viewer/资产详情叠层时 Esc 先关顶层）人工核对无回归。

## 对后续迭代的影响

- episode 手写浮层现余 `image-viewer-overlay`/`asset-detail-overlay`（深度定制查看类）与指标弹层——继续维持手写，结构测试守卫边界。
- AppDrawer 可复用，但按评审口径仅适合标准右侧抽屉；带复杂层级/焦点管理/多步状态的界面仍单独设计。
- B1 下一步组件（StatusBadge/EmptyState/Skeleton/LoadingButton/Field）可按同类「先抽后改 + 标准面先迁」节奏推进；batch2 评审建议的「最上层弹窗独占 Esc + 焦点返回」可作为后续深度定制界面专项的输入。

## 注意事项

- 后续新增抽屉一律引用 AppDrawer；若叠层键盘协议需要组件内置 Esc，应先抽象「页面级 Esc 仲裁」而非让各组件各自监听。
- 归档机制沿用：本批归档随后续 docs 小 PR 进入 master。
