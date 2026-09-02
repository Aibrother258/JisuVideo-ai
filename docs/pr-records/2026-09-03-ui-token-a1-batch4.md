# PR 详细记录：A1 Token 收敛第四批——白字白底语义化与徽标投影 token

> 分支：`feat/ui-token-batch4`
> 基准：master（含 PR #19 `d58e570`）
> 日期：2026-09-03（合入）
> 变更：9 文件（+94/−15）
> 关联方案：`docs/ui-optimization-plan.md`（v1.5）P1-A1「Token 收敛」
> PR：#20（merge commit `e2f6f42`，提交 `8a66a25`）

---

## 触发条件

A1 第三批（PR #19）后，settings / ConfirmDialog / default / detail 四处仍残留一批同值字面量：彩底徽标与选中态上的白字 `#fff`（应属「反色文字」语义）、激活态/卡片的纯白白底 `#fff`（应属「抬升表面」语义）、以及 settings 三处同值的方形投影 `0 1px 4px rgba(0,0,0,0.12)`；按「值不变改引用」推进第四批。

## 改了什么

| 层面 | 改动 |
|---|---|
| token（studio.css） | 新增徽标方形投影 `--shadow-badge: 0 1px 4px rgba(0,0,0,0.12)`（cap-badge / style-detail-badge / provider-badge 三处同值） |
| settings.vue | 彩底徽标白字（`.cap-badge` / `.style-detail-badge` / `.provider-badge`）与 `.cfg-model-check` 选中白勾 → `var(--text-invert)`；三处方形投影 → `var(--shadow-badge)` |
| ConfirmDialog.vue | `.confirm-danger-btn` 白字 → `var(--text-invert)`（hover 深红 `#d70015` 单次保留） |
| default.vue | `.brand-fallback` 深块字标白字 → `var(--text-invert)`；`.nav-link.active` 白底 → `var(--surface-raised)` |
| detail.vue | `.episode-inline-review` / `.episode-detail-tab.on` 白底 → `var(--surface-raised)` |
| 测试 | `apple-light-theme-structure.test.mjs` 新增 A1 批次四断言（token 定义 + 引用 + 白字字面量清零），全量 77/77 通过 |
| 文档 | `ui-optimization-plan.md` 升 v1.5；归档 PR #19 记录与索引 HB-20260903-01 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **白字统一 `--text-invert`** | 彩底徽标 / 深块 / 选中白勾上的白字语义均为「反色文字」，值 `#ffffff`（原 `#fff` 等价），承接批次三语义，暗色可一次覆盖 |
| **白底统一 `--surface-raised`** | 激活导航段 / 页内审阅卡 / 分集选中 tab 的纯白白底语义为「抬升表面」，与既有 token 同值 `#ffffff`，不新建无谓 token |
| **徽标方形投影独立成 token** | `0.12` 层级高于 `--shadow-float(0.08)`、低于普通卡片浮层，且语义是「彩色徽标/头像的小块投影」，独立命名便于暗色单独调整 |
| **单次值不强收敛** | hover 深红 `#d70015`、amber 横幅体系 `#fffbeb` 等单次/低价值字面量保留，待 A2 语义色板统一 |

## 回归测试

- 结构测试 77/77 通过（本机 node v22 实跑）；`git diff --check` 通过、无 lint 错误。
- 值不变改引用，视觉零变化；浏览器构建由 CI 执行。

## 对后续迭代的影响

- A1 批次五（`feat/ui-token-batch5`）：episode 播放器深色体系与状态色（`#0b0d10`×4 台面、白字白底语义化、绿/琥珀状态描边）。
- 待 A2 语义色板规范裁决的剩余：detail 资产类型色（scene 绿、prop 琥珀、amber 横幅系）与 episode 内单次低价值字面量（`#000`/`#111`/半透明白等）。

## 注意事项

- 批次只做「值不变改引用」；hover 态单次深红、`var(--x, fallback)` 兜底与 JS 风格数据不视为残留。
- episode.vue 体量最大，其白字白底与深色体系按主题拆分到批次五处理，不随本批铺开。
