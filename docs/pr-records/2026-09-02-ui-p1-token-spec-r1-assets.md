# PR 详细记录：UI P1 Token 收敛 A1 首批 + episode 资产子资源三态补漏（R1）

> 分支：`feat/ui-p1-token-spec`
> 基准：`7d4f7b8` 附近 master（PR #14 之后）
> 日期：2026-09-02（合入 15:49Z）
> 变更：15 文件（+423/−34），含入库扫描工具与结构测试
> 关联方案：`docs/ui-optimization-plan.md`（升版 v1.3）P1-A1「Token 收敛」首批 + `docs/handoff-ui-three-states-codex.md` R1
> PR：#15（merge commit `12121d9`）

---

## 触发条件

`handoff-ui-three-states-codex.md` 交接单 R1 主任务（加载类 catch → toast 静默清零）与 `ui-optimization-plan.md` P1-A1（token 收敛）同期进入实施；PR #14（C1/C2 三态治理）合入后 master 具备统一骨架/错误态基线，可在其上做「值不变改引用」的样式收敛。

## 改了什么

| 层面 | 改动 |
|---|---|
| token（studio.css） | 新增语义 token：tag/文本强色 `--success-strong #248a3d` / `--info-strong #0b6b94` / `--warning-strong #c93400`；通用填充层级 `--fill-subtle rgba(0,0,0,0.05)` / `--border-hover rgba(0,0,0,0.22)`；反馈色 `--error-outline` / `--action-danger-hover-bg`；`--overlay-mask` / `--switch-track` / `--scrollbar-thumb(-hover)` |
| 原语收敛 | 全局原语（`.tag-*`、`.btn-danger:hover`、`.overlay`、`.switch`、滚动条、`.input/.textarea:hover` 等）内同值字面量替换为 token 引用 |
| 页面残留 | `episode.vue` / `detail.vue` / `layouts/default.vue` / `MentionTextarea.vue` / `ModelSelect.vue` 的同值字面量收敛为引用；上述文件不再重复出现 `#248a3d / #0b6b94 / #c93400 / rgba(0,0,0,0.05) / rgba(0,0,0,0.32)` |
| R1 三态补漏（episode.vue） | 角色/场景/道具子资源统一入口 `loadEpisodeAssets(ep)`：分别捕获、任一失败汇总错误、保留旧数据不清空；无数据失败显示错误态 + 重试，不再误落「开始提取资产」空态；移除旧 `catch { chars/scenes/propItems = [] }` 静默置空 |
| 工具与文档 | 入库 `scripts/scan-hardcoded.mjs` / `scan-tokens.mjs`（硬编码与 token 分布量化）；方案文档升 v1.3；归档 `docs/iteration-logs/2026-09-02-ui-communication-audit.md`（多线状态盘点 + UI 术语索引）；结构测试新增 R1 / token 收敛断言并同步 button-system 断言 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **值不变改引用** | Token 收敛只为暗色主题/组件化打底，一次改动只换引用不换值，杜绝观感漂移；后续可整体灰度切换 |
| **新增语义 token 而非机械映射** | 以用途（success/info/warning 强色、填充层级、遮罩/滚动条/开关）而非色值为命名依据，保证暗色可覆盖 |
| **工具入库、后续批次可量化** | `scan-hardcoded.mjs` 按文件统计硬编码颜色/字号/px，`scan-tokens.mjs` 给出 style 块字号分布与颜色 Top，供后续批次（第二批收敛、字号小数消除）直接取数 |
| **R1 以「旧数据保留 + 内联错误重试」收口** | 资产子资源是高频刷新区，静默置空会让用户误判数据消失；延续 PR #14 三态治理规范 |

## 回归测试

- 结构测试新增 2 组断言（R1 资产子资源三态 / token 收敛），并同步 `button-system` 到 token 引用：**72/72 通过**。
- 值不变改引用，视觉零变化；未跑浏览器构建（CI 执行）。

## 对后续迭代的影响

- `ui-optimization-plan.md` 升 v1.3，P0 收口、P1 进行中；A1 仍有大量残留（episode.vue 289KB / 82 色、index.vue 69 色等），后续按「高频字面量 ≥3 次 → 语义 token」原则分批收敛，并消除 9px/10.5px 等小数字号。
- 入库扫描工具为 A2 设计规范、P3 暗色主题提供数据依据。

## 注意事项

- 运行时 `data/` 未提交（gitignore 覆盖 db/static/storage）。
- PR #15 标题元数据曾因 Windows PowerShell 下 gh 内联中文参数编码问题损坏（远端乱码），已于 PR #17 批次用 `gh api --input`（UTF-8 JSON）修复为「feat(ui): P1 token 收敛 A1 首批 + episode 资产子资源三态补漏（R1）」，规避规范见 `docs/pr-records/README.md`。
