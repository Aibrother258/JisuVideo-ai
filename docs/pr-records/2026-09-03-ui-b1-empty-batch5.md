# PR 详细记录：B1 batch5——EmptyState 通用空态组件 + index/detail 卡片空态迁移

> 分支：`feat/ui-b1-empty-batch5`
> 基准：master（含 PR #34 `d61683f`）
> 日期：2026-09-03（合入）
> 变更：4 文件（+122/−65，基准 `d61683f` 至 merge `c4cf9eb` 最终差异）
> 关联方案：`docs/ui-optimization-plan.md`（v2.2）P2-B1「通用组件抽取」
> PR：#36（merge commit `c4cf9eb`，提交 `db030a4`）

---

## 触发条件

B1「先抽后改 + 标准面先迁」序列继续：index.vue（项目列表空态）与 detail.vue（素材库「全部为空」+「筛选分类为空」两处）共 3 处手写 `.empty-state`「虚线圈框卡片空态」结构、样式完全同构，且 `.empty-desc` 存在 max-width 240（index）vs 260（detail）的笔头漂移。本轮收敛为通用 `EmptyState` 组件并迁移 3 处用法，继续按「样式逐字节下沉、标题/描述/图标/动作留在调用页」原则推进。

## 改了什么

| 层面 | 改动 |
|---|---|
| 新增 `frontend/app/components/EmptyState.vue` | 收敛「虚线框卡片空态」：props `title: string`（必填）+ `desc?: string`（可选）；图标经 `#icon` 具名插槽传入（各业务私有 SVG 不内置），动作按钮/链接放默认插槽。结构 `.empty-state`（`min-height:280px` + dashed `--border-strong` + `--surface-raised`）→ `.empty-icon`（56px 方块，`--bg-2`/`--text-3`）→ `.empty-title`（14px/700/`--text-1`）→ `.empty-desc`（12px/`--text-3`） |
| index.vue | 项目列表空态（无搜索匹配/首建引导，`v-else` 分支）→ `<EmptyState>`；图标入 `#icon` 插槽，「新建项目」按钮留默认插槽；删除手写 `.empty-state/.empty-icon/.empty-title/.empty-desc` 样式块（原 L1394-1418） |
| detail.vue | 「全部素材为空」与「筛选分类为空」两处 → `<EmptyState>`（动态 `暂无{{ tabLabel }}素材` 文案经模板插值 prop 传入）；删除手写同名样式块（原 L2405-2424） |
| 测试 | 新增 B1 batch5 断言组：组件 props/插槽/卡片样式 token 映射、index+detail 迁移与页面手写类清零、特殊形态不迁移守卫（episode `.step-empty` 展示体空态、detail `.ep-empty` 可点击 CTA 卡） |

## 评审处理（一轮 APPROVED）

| 反馈 | 处理 |
|---|---|
| 复核通过：样式逐字节对齐原页面（`.empty-state` 卡片/`.empty-icon`/`.empty-title`/`.empty-desc` 各属性逐一比对，`.empty-desc` max-width 统一 260px 前已论证 index 侧 desc 均为单行短句不触发换行、视觉零变化）；3 处调用迁移完整、图标与动作经插槽保留在调用页；结构测试 88/88 通过 | 无代码修改 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **先收敛家族再抽组件：范围锁定「卡片式空态」** | 盘点全仓空态后发现形态繁多：episode `.step-empty`（72px 彩色图标 + 22px 展示体大标题 + 按钮的展示体空态）、detail `.ep-empty`（可点击 CTA 卡）、index `.rail-empty`（侧栏纯文字）、settings `.config-empty`/`.skills-empty`（行内文字）、BaseSelect/MentionTextarea 下拉内空提示。仅「虚线圈框卡片」A 家族（index+detail 共 3 处）结构同构，适合先收敛；其余特殊形态保留手写（测试守卫防误迁移） |
| **组件只收骨架，图标/标题/描述/动作全部留在调用页** | 各业务 SVG 图标各不相同、空态文案与出现条件随页面而异；组件以 `title`/`desc` prop + `#icon`/默认插槽承载内容差异，不内置任何业务图标或文案 |
| **`.empty-desc` max-width 240 vs 260 统一为 260** | index 侧 desc 文案均为单行短句（「调整搜索词或筛选条件。」等），240px 与 260px 下均单行不换行，统一 260px 视觉零变化；消除两页笔头漂移 |
| **迁移后页面类清零** | `.empty-state` 等 4 类在 index/detail 的 scoped 手写全部删除，样式只存于组件内，杜绝后续页面误改组件观感 |

## 回归测试

- 结构测试 88/88 通过（本机 node v22 实跑；batch4 后 87/87 + 本批断言组）。
- `npm run build` 通过（Vue 模板编译含 3 处新组件用法无错误）；lint 0 错误。

## 对后续迭代的影响

- B1 通用组件已抽取 AppDialog、AppDrawer、StatusBadge、EmptyState；手写面按边界继续收窄。
- B1 余 Skeleton / LoadingButton / Field（FormRow）待排期；新空态一律引用 EmptyState，禁止在页面手写同款虚线卡片结构。
- 展示体空态（episode `.step-empty` 系）若后续需要收敛，可考虑 EmptyState 增 `hero` 变体或独立组件，但需先明确「72px 图标 + 展示体标题」是否跨页复用面足够。

## 注意事项

- `EmptyState` 图标与按钮不进组件；若业务出现跨页一致的「空态 + 统一 CTA」组合，再考虑组件级插槽预置。
- episode 展示体空态、可点击 CTA 卡等特殊形态保留页面手写；若后续出现第二处同形态用法再行抽取（避免为一个用法做组件）。
- 归档机制沿用：本批归档随 docs 小 PR 进入 master。
