# PR 详细记录：A1 Token 收敛第二批——通用填充/警示色收敛为语义 token

> 分支：`feat/ui-token-batch2`
> 基准：master（含 PR #16 `e9ca6ce` 与 PR #17 前）
> 日期：2026-09-02（合入 16:26Z）
> 变更：4 文件（+40/−10）
> 关联方案：`docs/ui-optimization-plan.md`（v1.3）P1-A1「Token 收敛」
> PR：#18（merge commit `b14e950`，squash 提交 `e5eb724`）

---

## 触发条件

A1 首批（PR #15）建立语义 token 体系后，`scan-hardcoded.mjs` 显示通用填充（`rgba(0,0,0,0.05/0.08)` 等）与警示色仍在首页/设置页多处残留；按「高频字面量 ≥3 次 → 语义 token、值不变改引用」原则推进第二批。

## 改了什么

| 层面 | 改动 |
|---|---|
| token（studio.css） | 新增次级 hover 填充 `--fill-hover: rgba(0,0,0,0.08)`；未保存警示组 `--unsaved-border: #e0b15a` / `--unsaved-text: #a06a0e` / `--unsaved-bg: #fbf3e2` |
| 首页（index.vue） | 搜索框 / 排序下拉 / 筛选 chip / cover-more 的填充与 hover 层级收敛为 `--bg-hover` / `--fill-subtle` / `--fill-hover` / `--surface-raised` 引用（focus 白底用既有 `--surface-raised`） |
| 设置页（settings.vue） | 风格预设 subnav 计数胶囊 hover 收敛为 `--bg-active` + `--text-2`；「未保存修改」警示 tag 由内联 style 收敛为 `--unsaved-*` 引用 |
| 测试 | `style-preset-structure.test.mjs` 新增 A1 第二批断言（token 定义存在 + 页面引用 + 字面量清零） |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **填充层级统一引用** | hover(0.04) < subtle(0.05) < active(0.06) < hover-strong(0.08) 收口为 token 后，暗色主题只需覆盖一层 token 即可整体换肤 |
| **警示色语义词元化** | 由 settings 内联 style 收为 border/text/bg 三个命名 token（`--unsaved-*`），后续同类「未保存」提示直接复用，不再写字面量 |
| **沿用值不变原则** | 本批只换引用不换值，视觉零变化；`0.08` 已存在 `--border`（边框语义）与新增 `--fill-hover`（填充语义）并存，语义分位不合并 |

## 回归测试

- 结构测试全量通过（本机 node v22 实跑）；`git diff --check` 通过、无 lint 错误。
- 值不变改引用，视觉零变化；浏览器构建由 CI 执行。

## 对后续迭代的影响

- A1 推进序列继续：第三批（封面占位渐变/静默元素、反色白字 `--text-invert`、毛玻璃浮层 `--surface-glass`，分支 `feat/ui-token-batch3`）处理首页封面体系；之后为字号小数（9px/10.5px 等）消除与重复工具类收敛。
- 扫描工具可对每批收效量化（页面 style 块残留行数下降）。

## 注意事项

- 本批只收敛「通用填充/警示色」；来源徽标紫/绿（`source-badge` existing/new）、单次 text-shadow 等低价值字面量保留，待 A2 设计规范统一后再定。
