# PR 详细记录：B1 batch4——StatusBadge 通用状态徽标组件 + detail/episode 迁移

> 分支：`feat/ui-b1-badge-batch4`
> 基准：master（含 PR #33 `8382b96`）
> 日期：2026-09-03（合入）
> 变更：4 文件（+126/−91，基准 `8382b96` 至 merge `d61683f` 最终差异）
> 关联方案：`docs/ui-optimization-plan.md`（v2.1）P2-B1「通用组件抽取」
> PR：#34（merge commit `d61683f`，提交 `b4a5e3c`）

---

## 触发条件

B1「先抽后改 + 标准面先迁」序列继续：detail.vue / episode.vue 内素材封面「玻璃角标」（`.asset-cover-badge`）与资产/最终提示词行内「状态胶囊」（`.mat-detail-state`/`.asset-detail-state`）为跨页重复的标准状态徽标——同一三态语义（ready/pending/缺省）与同一组 token（`--success-bg`/`--accent-bg`/`--fill-subtle`）在两页各写一份。本轮抽取通用 `StatusBadge` 组件并迁移两页共 8 处用法，继续按「样式逐字节下沉、状态判断与文案留在调用页」原则推进。

## 改了什么

| 层面 | 改动 |
|---|---|
| 新增 `frontend/app/components/StatusBadge.vue` | 收敛两类状态徽标：props `variant: 'cover' \| 'pill'`（默认 `pill`）+ `state: '' \| 'ready' \| 'pending'`（默认 `''`），文字经默认插槽传入。`cover` 态 absolute 定位于父容器左上角（玻璃底 + blur + `--shadow-float`，调用处父容器 `.asset-cover`/`.character-portrait` 已具备 `position:relative`）；`pill` 态行内胶囊（`--fill-subtle`/`--text-3`）。配色随 state 映射语义 token（ready→`--success-bg`/`--success-strong`，pending→`--accent-bg`/`--accent-text`） |
| detail.vue | 3 处模板替换 → `<StatusBadge variant="cover" :state="...">`（形象卡 ×1 / 素材网格 ×1）+ pill（素材详情 ×1）；删除手写 `.asset-cover-badge` 与 `.asset-detail-state` 样式块 |
| episode.vue | 5 处模板替换 → cover ×3（角色 / 场景 / 道具卡）+ pill ×2（资产详情 / 最终提示词）；删除手写 `.asset-cover-badge` 与 `.asset-detail-state` 样式块 |
| 测试 | 原断言（A1 batch5 / A2 batch1 的 `.asset-cover-badge`）改指组件 `.sb-cover`（样式随组件下沉）；新增 B1 batch4 断言组：props / state 映射 token / 两页迁移 / 页面手写徽标类清零 |

## 评审处理（一轮 APPROVED）

| 反馈 | 处理 |
|---|---|
| 复核通过：样式逐字节对齐原页面（`.sb-cover`↔`.asset-cover-badge`、`.sb-pill`↔`.asset-detail-state` 各属性逐一比对），状态判断与文案留在调用页、组件只收样式映射；两页手写徽标类清零；结构测试 87/87 通过 | 无代码修改 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **组件只管「形态 + 状态样式」，文案与条件留在调用页** | 状态文案（「形象已生成 / 生成中 / 待生成」「已生成 / 生成中 / 待生成」）随业务变化，条件也各不相同（image_url/imageUrl/pending 判断）；若全部塞进组件会引入业务耦合。组件仅提供样式映射，调用页传 `:state` + 插槽文案 |
| **样式逐字节下沉，视觉零变化** | 与 AppDialog/AppDrawer 同一原则：迁移只改引用不改值。`.sb-cover` 与原 `.asset-cover-badge`、`.sb-pill` 与原 `.mat-detail-state`/`.asset-detail-state` 逐属性一致（含 `backdrop-filter`/`box-shadow`/`font-weight:760` 等细节），排除任何观感漂移 |
| **组件收敛为两形态而非一形态** | cover（角标，父容器 relative 依赖）与 pill（行内，无定位依赖）定位模型不同，用一个组件两个 variant 收敛重复的三态配色映射，避免两套重复代码或过度抽象为多组件 |
| **绝对定位依赖放在 cover 使用侧** | 组件不自行 `position:relative` 父容器（会改动布局树），沿用调用页已有定位上下文，最小化 DOM 变更面 |

## 回归测试

- 结构测试 87/87 通过（本机 node v22 实跑；batch3 后 86/86 + 本批断言组）。
- `npm run build` 通过（Vue 模板编译含 8 处新组件用法无错误）；lint 0 错误。

## 对后续迭代的影响

- B1 通用组件已抽取 AppDialog（settings/detail/episode 弹窗）、AppDrawer（episode 任务抽屉）、StatusBadge（两页状态徽标），手写面按边界继续收窄。
- B1 余 EmptyState / Skeleton / LoadingButton / Field 组件待排期；各页面 `.status-badge` 等页面级类名与组件内部类隔离（scoped），无命名冲突。
- 后续若出现新的「封面玻璃角标 / 行内状态胶囊」用法，一律引用 StatusBadge，禁止在页面手写同类结构。

## 注意事项

- `StatusBadge` 的 cover 态依赖调用处父容器 `position:relative`——新增 cover 用法时须保证定位上下文，否则角标会落到页面上层容器。
- 组件文案不进组件（中文三态文案业务性），i18n 预留时只需收敛调用页模板即可。
- 归档机制沿用：本批归档随后续 docs 小 PR 进入 master。
