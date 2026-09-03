# PR 详细记录：A2 语义色板规范批次一——资产类别/状态语义色与 amber 提示横幅 token 化

> 分支：`feat/ui-a2-semantic-batch1`
> 基准：master（A1 全批合入，`cf3a301`）
> 日期：2026-09-03（合入）
> 变更：5 文件
> 关联方案：`docs/ui-optimization-plan.md`（v1.8）P1-A2「设计规范文档」+ 语义色板规范
> PR：#25（merge commit `1c090e1`，提交 `d8587e4`）

---

## 触发条件

A1 全批收口后，A2 语义色板规范启动。A2 首裁对象为 detail 页资产类型色（scene 绿 / prop 琥珀 / amber 横幅系）——该类色横跨「资产类别」与「状态/提示」两种语义（R2 反例），且按「值不变改引用」原则收敛为语义 token，同时产出语义色板规范文档作为后续评审基准。

## 改了什么

| 层面 | 改动 |
|---|---|
| token（studio.css） | 新增资产类别 token `--kind-scene(-strong/-bg)`、`--kind-prop(-bg)`（值不变）；amber 提示横幅 token `--notice-*`（6 个：`-text/-bg/-border/-link/-link-border/-link-hover-bg`，值不变） |
| detail.vue | 场景/道具分组引用 `--kind-*`（值不变）；「制作中」状态字色/光晕归入 success 家族（R3 归一：`#16a34a` → `--success-strong`、光晕 0.35 → 0.32）；封面玻璃徽标复用 `--surface-glass`/`--shadow-float`；区块内 `#16a34a`/`#15803d`/`#b45309` 字面量清零 |
| default.vue | 布局顶 amber 提示横幅（config banner）全量引用 `--notice-*` |
| 文档 | 新增 `docs/ui-semantic-color-spec.md`（语义色板规范 v1）：R1–R6 规则（R2 语义分 token、R3 极小归一、R4 不强收敛、R5 fallback 冗余、R6 内联色禁止）、token 家族表、遗留清单与裁决记录 |
| 测试 | `apple-light-theme-structure.test.mjs` 新增 A2 批次一断言组（token 定义 + detail/default 引用 + `#16a34a` 系清零），全量 81/81 通过 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **scene/prop/amber 按语义分家而非同值合并** | `#16a34a` 同值分任「制作中」状态（→ success）与场景类别（→ `--kind-scene`），`#b45309` 同值分任道具类别（→ `--kind-prop`）与横幅链接（→ `--notice-link`）——颜色按含义归属，各自可被暗色主题独立覆盖（R2） |
| **「制作中」归 success 家族为 R3 轻微归一** | 原 `#16a34a` 与 `--success-strong`（`#248a3d`）同绿语义，统一为深字对比更佳，记录于规范 §3 |
| **规范 v1 与批次一并入** | 评审基准文档随首批裁决落地，后续批次在此基础上增补（批次二升 v2） |

## 回归测试

- 结构测试 81/81 通过（本机 node v22 实跑）；无 lint 错误。
- 值不变改引用为主，视觉零变化；仅「制作中」一处有记录的归一。

## 对后续迭代的影响

- A2 批次二（PR #26）在 `feat/ui-a2-semantic-batch2` 承接：episode 媒体遮罩/白字、R5/R6 清理、index new-style 家族、规范升 v2。
- 遗留字面量清单（规范 §5）明确「不强收敛」范围，组件化（P2-B1）/暗色主题批次随迁。

## 注意事项

- 批次只做「值不变改引用 + 记录归一」；`--kind-*`/`--notice-*` 值域在 `:root` 与字面量原值逐项核对。
- 归档机制沿用：本批归档随后续 docs 小 PR 进入 master。
