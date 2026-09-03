# PR 详细记录：A2 语义色板规范批次二——episode 媒体遮罩/白字收敛、R5/R6 全仓清理、new-style 家族

> 分支：`feat/ui-a2-semantic-batch2`
> 基准：master（含 PR #25 `1c090e1`）
> 日期：2026-09-03（合入）
> 变更：9 文件（+197/−91，基准 `1c090e1` 至 merge `5b9ae75` 最终差异）
> 关联方案：`docs/ui-optimization-plan.md`（v1.8）P1-A2 + `docs/ui-semantic-color-spec.md`（升 v2）
> PR：#26（merge commit `5b9ae75`，提交 `dfe826b` + 评审补漏 `c06f7af`/`ecdb02b`）

---

## 触发条件

批次一（PR #25）后剩余 A2 计划项：episode 媒体层深色遮罩（scrim）六档字面量、画布 `#000`/`#111` 与 on-media 白字、accent 焦点环、settings 内联 style 色值与测试结果描边、index「新风格」紫、全仓 `var(--x, fallback)` 冗余（R5）——按「值不变改引用 + R3 归一记录」收口。

## 改了什么

| 层面 | 改动 |
|---|---|
| token（studio.css） | 新增 `--accent-soft`（未定义 var 名正式化，值同原 fallback）、`--bar-glass`、`--media-scrim(-soft/-strong)`、`--media-text(-dim)`、`--error-border-strong`、`--new-style(-bg/-soft/-border)`；注释对齐规范 v2 §6 |
| episode.vue | 媒体遮罩 13 处六档 → 三档 scrim token（Δ≤0.07 R3 归一）；画布 `#000`/`#111` → `--media-stage-bg`（`#0b0d10` 近黑）；on-media 白字/空态标题/勾选白边 → `--media-text(-dim)`；accent ring 0.14/0.15 → 0.18 并入 glow；`.ref-asset-card.locked` → `--success`；`.storyboard-shot-card.is-selected` → `--accent-soft` |
| settings.vue | R6：内联 `style="color:#d9534f"` 转 `.skill-load-error-icon { color: var(--error) }`；`.test-result.ok/bad` 描边 → `--success-border-strong` / 新建 `--error-border-strong`；R5 fallback 清零（含评审补漏 `.cfg-model-box` border fallback） |
| index.vue | source-badge「已有」并 success 家族（R3 记录）；「新风格」紫新建 `--new-style` 家族（值不变）；分段底/激活段 shadow 归 token |
| default.vue | 顶栏玻璃 `rgba(251,251,253,.72)` → `--bar-glass`；`.nav-link.active` shadow → `--shadow-float` |
| ModelSelect.vue | R5 fallback 清零（弹层投影保留记录，规范 §5.1） |
| 文档 | `ui-semantic-color-spec.md` 升 v2：家族表补新成员、§5 残留清单与裁决归档、§6 R3 归一记录表、§7 维护规约 |
| 测试 | `apple-light-theme-structure.test.mjs` 新增 A2 批次二断言组（token 定义 + 引用 + R5/R6 清零），全量 82/82 通过 |

## 评审处理（两轮 CHANGES_REQUESTED）

| 轮次 | 反馈 | 处理 |
|---|---|---|
| 1 | settings `.cfg-model-box` 仍 `var(--border-strong, var(--border))`，与「全仓清理」表述不一致 | 改 `var(--border-strong)`；测试补 `assert.doesNotMatch(settings, /var\(--border-strong,/)` 回归守卫（`c06f7af`） |
| 2 | episode 两处非颜色静态 fallback 漏网：`.storyboard-ref-goto` `var(--radius-sm, 6px)`、`.video-inspector-h3-prompt` `var(--font-mono, ui-mono…)` | 均改纯 var 引用；R5 断言补两条具体守卫（`ecdb02b`）；确认运行时拖拽宽度动态 fallback（`--studio-sidebar-width, 208px`）按裁决保留 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **scrim 六档归一三档** | 邻近档（Δ≤0.07）肉眼不可分，并入 `--media-scrim(-soft/-strong)` 语义档；全部记录于规范 §6 归一表 |
| **`--accent-soft` 正式化 / `--surface-2` 改引** | 原为未定义 var 名（fallback 永不生效）；前者值升为正式 token，后者改引同值 `--surface-muted` |
| **画布近黑并入 `--media-stage-bg`** | `#000`/`#111` 与既有 `#0b0d10`（A1 批五）同属媒体承载面语义，R3 归一（Δ≈近黑） |
| **静态 fallback 全清、动态 fallback 保留** | 静态 `:root` 已定义则 fallback 永不走通且误导（历史值与现 token 常不符）；运行时变量（拖拽宽度）初值兜底必要，保留并记录 |

## 回归测试

- 结构测试 82/82 通过（本机 node v22 实跑）；全仓扫描确认静态 fallback 清零，仅余 7 处运行时动态布局 fallback（`--studio-sidebar-width`、`--storyboard-list-width`、`--storyboard-reference-width`、`--storyboard-description-width`、`--storyboard-video-prompt-height`、`--video-task-list-width`、`--video-preview-height`，均为拖拽/记忆布局的初值兜底，保留）。
- 值不变改引用为主；全部归一（scrim 并档、画布近黑、accent ring 0.18、success 两处、`#d9534f`）记录于规范 §6。

## 对后续迭代的影响

- **A2 至此全部收口**；语义色板规范 v2 为 `studio.css` 注释段与结构测试的对应基准。
- 记录在案（规范 §5.1，不强收敛）：episode 局部 `--sel-*`、settings 红浅横幅与品牌渐变、index 风格预设渐变与封面 text-shadow、ModelSelect 弹层投影、ConfirmDialog 危险钮 hover——待组件抽取（P2-B1）或暗色主题批次处理。
- P1 余 A3（动效体系化）未排期；P2（组件化/拆分）可按路线图启动。

## 注意事项

- 新增 token 均在 `:root` 定义并与规范 §6 归一表一一对应；后续新增字面量色视为违反规范（测试按批补断言）。
- 归档机制沿用：本批归档随后续 docs 小 PR 进入 master（合并点 `5b9ae75`）。
