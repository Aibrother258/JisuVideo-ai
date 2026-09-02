# PR 详细记录：A1 Token 收敛第三批——封面占位/反色白字/毛玻璃浮层语义 token

> 分支：`feat/ui-token-batch3`
> 基准：master（含 PR #18 `b14e950`）
> 日期：2026-09-03（合入）
> 变更：6 文件（+96/−18）
> 关联方案：`docs/ui-optimization-plan.md`（v1.4）P1-A1「Token 收敛」
> PR：#19（merge commit `d58e570`，提交 `cc4123c`）

---

## 触发条件

A1 第二批（PR #18）后，首页封面体系仍残留一批字面量（占位封面渐变、封面静默元素色、反色白字、毛玻璃浮层），且 `#fff`（5 处文字白）、`rgba(255,255,255,0.85/0.95)` 等跨语义值无归属 token；按「值不变改引用」推进第三批。

## 改了什么

| 层面 | 改动 |
|---|---|
| token（studio.css） | 新增封面占位体系 `--cover-fallback`（渐变底）/ `--cover-fallback-fg`（静默元素）/ `--cover-text`（封面大字形白 0.95）；反色白字 `--text-invert`；毛玻璃浮层 `--surface-glass`（白 0.85）与 `--shadow-float`（浮层微阴影 0.08） |
| 首页（index.vue） | 11 处收敛：`.resume-thumb`/`.project-thumb` 占位封面渐变底与字标/图标、`.style-swatch(-name)`/`.filter-chip.on`/`.cover-style-name`/`.step-indicator span.on` 反色白字、`.cover-badge`/`.cover-more` 毛玻璃底与阴影；style 块内 `#fff`/`#eef1f6`/`#6a7ba0`/白色半透明字面量清零 |
| 测试 | `style-preset-structure.test.mjs` 新增 A1 批次三断言（token 定义 + 引用 + 字面量清零），全量 76/76 通过 |
| 文档 | `ui-optimization-plan.md` 升 v1.4；归档 PR #18 记录与索引 HB-20260902-05 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **封面占位独立成组** | 首页两种封面（简历/项目）共用同一渐变占位与静默元素色，语义化后暗色主题可一次覆盖；不并入通用中性色，避免污染主表面体系 |
| **`--text-invert` 承接全部深底白字** | 深色 chip、渐变 swatch、深底胶囊上的白字语义统一为「反色文字」，值统一 `#ffffff`（原 `#fff` 等价），替代零散字面量 |
| **毛玻璃与浮层阴影拆分** | `--surface-glass`（底）与 `--shadow-float`（阴影）分开，避免混在一个「玻璃卡」token 里限制暗色下单独调整 |

## 回归测试

- 结构测试 76/76 通过（本机 node v22 实跑）；`git diff --check` 通过、无 lint 错误。
- 值不变改引用，视觉零变化；浏览器构建由 CI 执行。

## 对后续迭代的影响

- A1 批次四（`feat/ui-token-batch4`）：settings/ConfirmDialog/default/detail 的白字白底语义化 + 徽标投影 `--shadow-badge`。
- 待 A2 语义色板规范裁决的剩余：detail 资产类型色（scene 绿 `#16a34a`/`#15803d`、prop 琥珀 `#b45309`、amber 横幅系）与 episode 播放器深色体系（`#0b0d10`×4、`#fff`×26、绿/紫状态色）。

## 注意事项

- 批次只做「值不变改引用」，源徽标紫绿（source-badge）、单次 text-shadow 等低价值字面量保留，待 A2 色板统一。
- `var(--x, fallback)` 兜底形式与 JS 风格渐变数据（如 index.vue 的 `'ghibli'` 渐变）不视为残留，扫描工具会持续统计但不在收敛范围内。
