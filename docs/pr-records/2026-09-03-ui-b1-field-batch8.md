# PR 详细记录：B1 batch8——Field 表单字段组件抽取并迁移 settings/index .field 骨架

> 分支：`feat/ui-b1-field-batch8`
> 基准：master（含 PR #41 `9499498` 归档 batch7 + plan v2.5）
> 日期：2026-09-03（合入）
> 变更：6 文件（+197/−96，commit `cd2c61f` 至 merge `43ee3e2`）
> 关联方案：`docs/ui-optimization-plan.md`（v2.5）P2-B1「通用组件抽取」余项 Field（FormRow）
> PR：#42（merge commit `43ee3e2`，提交 `cd2c61f`）

---

## 触发条件

v2.3（empty batch5）归档时盘点结论：`FormField`（4 文件各自重复 `.field` CSS，gap 5-8/weight 500-600 微差）复用面成立待排期；v2.4/v2.5（loading batch6/7）后 B1 通用组件仅余 **Field（FormRow）** 未抽取。本轮将 settings.vue（22 处）与 index.vue（5 处）手写 `.field` 骨架收敛为 `Field.vue` 组件，**B1 组件抽取面就此收口**。

## 改了什么

| 层面 | 改动 |
|---|---|
| 新增 `components/Field.vue` | `<label class="field">` 纵向骨架：`.field-label`（span，`label` prop 或 `#label` 插槽，末尾 `required` 星标）+ 默认插槽（控件区，任意 DOM/组件不预设类型）+ `.field-hint`（`hint` prop 或 `#hint` 插槽）；样式自包含（gap 5px / label 12px/550 / hint 11px `--text-3` line-height 1.5 margin-top 2px）；`.field-hint:empty` 隐藏避免条件渲染空隙 |
| `studio.css` | `.required` 星标提升为全局类——组件 `required` prop 渲染的 `<span class="required">*</span>` 与 `#label` 插槽内中段手写星标共用同一全局样式（原 settings/index scoped 重复样式下沉删除） |
| settings.vue | 22 处手写 `.field` 行迁移至 `<Field>`；动态文案/条件 hint/附加布局类保留——`style-detail-grid` 的 `.field-wide`/`.source-field`/`.compact-field` 等单次附加类经 class attrs 透传落到组件根元素，视觉零变化；深定制表单行（`.config-row` 等非 label+控件语义的布局容器）不迁移 |
| index.vue | 5 处手写 `.field` 行迁移；custom-style-panel 独立提示仍用页面 `.field-hint`（该处与骨架解耦，保留） |
| 样式归一 | 删除 settings/index 各自重复的 `.field`/`.field-label`/`.field-hint`/`.required`/`.field-row` 骨架定义；index 原 gap 6 / weight 600、hint 原 line-height 1.5（无 margin-top）与 settings 基准（gap 5/weight 550/margin-top 2px）的笔头漂移统一为 settings 基准（gap 5/weight 550/line-height 1.5 + margin-top 2px），视觉零变化 |
| 测试 | `apple-light-theme-structure` 新增 B1 batch8 断言组（组件骨架存在/27 处迁移面抽样/页面 scoped 骨架样式下沉清零/附加布局类透传保留）；`remove-audio-voice` 原 `.field-hint` 断言适配 `#hint` 插槽化 |

## 评审处理（一轮 APPROVED，无修改要求）

| 反馈 | 处理 |
|---|---|
| owner 复核通过：`Field` 组件的 label、required、hint 插槽与 attrs 透传均正确；settings/index 的迁移保留了动态文案、条件提示和页面专属布局类；91 项结构测试通过，差异检查无空白错误，未发现业务回归 | 无需改动，直接合并 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **组件只收「label + 控件 + hint」骨架** | `.field` 的复用点是无状态纵向布局；控件类型千差万别（input/BaseSelect/textarea/复合按钮行）一律走默认插槽，组件不预设控件类型即不改调用页业务 |
| **required 星标样式全局化而非组件私有** | 星标有两种落点：`required` prop 简单场景（label 末尾）与 `#label` 插槽中段手写场景；scoped 样式无法覆盖插槽内容，故提为 `studio.css` 全局 `.required`，两种用法共用单一来源 |
| **label/hint 纯文本 prop + 命名插槽双通道** | 纯文本高频场景走 prop（模板精简）；内嵌 `.dim` 说明、条件渲染 hint 等复杂场景走 `#label`/`#hint` 插槽（`label || $slots.label` 判空避免空 label 渲染空隙） |
| **附加布局类经 attrs 透传** | `.field-wide`/`.source-field`/`.compact-field` 是调用页网格（style-detail-grid）布局上下文的一次性类，不属于骨架；Vue 自动透传 class 到组件根 `<label>`，保持页面网格布局不动 |
| **index 保留 `.field-hint`（custom-style-panel）** | 该提示独立于骨架解耦（非 `#hint` 语义），迁入会造成页面自定义样式回写，保留手写 |
| **笔头漂移归一取 settings 基准** | index 侧 gap 6/weight 600 与 settings gap 5/weight 550 的差异在纯文本单行 label 下不可感知；统一为 settings 基准并以「视觉零变化」守边界，避免为不可见差异维护两套 |

## 回归测试

- 结构测试 91/91 通过（`node --test tests/*.test.mjs`；batch7 后 90/90 + 本批断言组，remove-audio-voice 适配后计数净增 1）。
- 评审复核确认差异检查无空白错误。
- 说明：`frontend/package.json` 无 `lint` 脚本；类型/模板诊断经 IDE 语言服务无 error 级问题。

## 对后续迭代的影响

- **B1 通用组件抽取面收口**：AppDialog、AppDrawer、StatusBadge、EmptyState、LoadingButton、Field 全部落地，settings/index 标准面迁移完毕。
- 手写 `.field` 骨架自此禁止新出现：新表单行一律 `<Field label required hint>` 或命名插槽；中段星标用全局 `.required`。
- B1 收口后 P2 余 **B2（巨型页面拆分）** 与 **B3（分页 hook，已在 `feat/ui-b3-paged-hook` 分支并行评审）**。
- 深定制表单行（settings `.config-row`、index `.source-url-row`、detail 新建集等）不属 Field 语义，保持手写。

## 注意事项

- `Field` 根元素是 `<label>`：含 `input` 控件时点击 label 会聚焦控件（与手写时一致）；含按钮/复合行时语义仍为 label+控件容器，勿在组件内追加交互。
- `.required` 为全局类（非 scoped），命名在 studio.css 唯一；新代码禁止在页面 scoped 内重定义 `.required`。
- index 页面 `.field-hint` 仅剩 custom-style-panel 独立提示一处，后续若再迁需先裁决其与 Field `#hint` 的边界。
