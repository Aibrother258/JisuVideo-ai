# PR 详细记录：B1 batch1——AppDialog 通用弹窗组件 + settings 四个配置弹窗迁移

> 分支：`feat/ui-b1-appdialog`
> 基准：master（含 PR #29 `782ad8f`，A3 动效归档后）
> 日期：2026-09-03（合入）
> 变更：3 文件（+204/−115，基准 `782ad8f` 至 merge `c9be4df` 最终差异）
> 关联方案：`docs/ui-optimization-plan.md`（v2.0）P2-B1「通用组件抽取」首件
> PR：#30（merge commit `c9be4df`，提交 `2c9eeb6`）

---

## 触发条件

P2-B1 目标「AppDialog 吸收各页手写 `.overlay>.dialog`、AppDrawer 吸收任务抽屉，先抽后改、视觉不变」。P2 起步选取 settings.vue 内结构最标准的四个配置/风格弹窗（`cfgDialog` / `addSkillDialog` / `styleDialog` / `stylePromptOpen`）作为首个迁移面——它们骨架完全同构（遮罩 + 面板 + head/body/foot 三段），差异仅在宽度与个别提交行为，是「先抽后改」风险最低的样本。

## 改了什么

| 层面 | 改动 |
|---|---|
| 新增 `frontend/app/components/AppDialog.vue` | 收敛 `.overlay > .dialog` 骨架与 head/body/foot 三段插槽；`form` 开关（渲染 `<form>` 且 `@submit.prevent`）；`width` prop 内联宽度（规避页面 scoped 类跨组件失效）；关闭协议统一：Esc（`escClose`）与遮罩点击（`maskClose`）均派发 `close`，与 ConfirmDialog 行为对齐（`dialogStyle` 多维尺寸 prop 为 batch2 新增，见 `2026-09-03-ui-b1-dialog-batch2.md`） |
| settings.vue | 四个弹窗迁移至 `<AppDialog>`：`cfgDialog`/`styleDialog` 用 `form` + `width="min(720px, calc(100vw - 40px))"` 保留响应式宽度、`addSkillDialog` 用 `width="440px"`、`stylePromptOpen` 为纯展示弹窗；原 `.config-dialog`/`.skill-dialog` 宽度类删除，body 内部布局类保留页面 scoped；裸 `.overlay` / `@click.self` 清零 |
| 测试 | `apple-light-theme-structure.test.mjs` 新增 B1 batch1 断言组：组件骨架四段与关闭协议、settings 四弹窗已迁移、`class="overlay"` 与 `@click.self` 清零、宽度类删除 |

## 评审处理（一轮 APPROVED）

| 反馈 | 处理 |
|---|---|
| 复核通过：form 型弹窗仍渲染 form，保存仍走原 `saveCfg`/`confirmAddSkill`/`saveStyle`；响应式宽度与 440px 均保留；关闭协议保留并新增统一 Esc；84/84 通过 | 无代码修改；评审提出后续批次约束（见下） |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **先抽后改、视觉零变化** | 组件骨架与既有页面结构逐像素同构，迁移只删页面重复骨架，不引入任何布局/交互变更，评审可独立核对差异 |
| **宽度走 prop 内联而非组件内部类** | 插槽内容在调用页作用域编译，页面 scoped 类无法命中组件内部 `.dialog`；`width` 以 `:style` 内联是跨 scoped 边界的可靠通道（本批仅 `width` 单一维度；多维尺寸需求出现后由 batch2 增补 `dialogStyle`） |
| **Esc/遮罩关闭协议统一派发 close** | 各弹窗原本仅支持遮罩关闭，统一后与 ConfirmDialog 行为一致；`escClose`/`maskClose` 提供关闭开关供后续深度定制界面禁用 |
| **form 开关而非让调用方包 form** | settings 三个弹窗本就以 `<form>` 承载提交；组件内建 `@submit.prevent` + `emit('submit')` 使保存按钮保持 `type="submit"` 原生语义，调用方只监听 `@submit` |

## 回归测试

- 结构测试 84/84 通过（本机 node v22 实跑；A3 后基线 83/83 + batch1 断言组）。
- 评审独立差异空白检查通过；四个被迁弹窗互斥（同一时刻至多一个打开），本批不存在多个 AppDialog 同时处理 Esc 的回归面。

## 对后续迭代的影响

- **评审明确 B1 系列边界**：仅标准 head/body/foot 弹窗迁入 AppDialog；素材详情、viewer、多步创建页与任务抽屉等深度定制界面应单独设计后再迁移（该边界在 batch2 迁移对象筛选中生效）。
- 评审建议（转后续约束）：继续迁移可能叠加的弹窗时，应让「最上层弹窗」独占 Esc，并补齐打开聚焦/关闭后焦点返回，避免通用组件在复杂弹窗链路产生键盘焦点问题——落地归属见 batch2/batch3：batch2 三个弹窗互斥无叠加，保持默认 Esc 未做特殊处理；batch3 任务抽屉与 viewer/资产详情叠层，才经 AppDrawer `esc-close=false` 交还页面级优先级（见 batch3 记录「关键设计决策」）。

## 注意事项

- 组件根 `.overlay` 会继承调用页 scope，overlay 级修饰（如 z-index 提升）经根 class 透传即可（batch2 的 `ref-asset-picker-overlay` 即如此）。
- 归档机制沿用：本批归档随后续 docs 小 PR 进入 master。
