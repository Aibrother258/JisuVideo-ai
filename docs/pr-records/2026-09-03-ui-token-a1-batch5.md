# PR 详细记录：A1 Token 收敛第五批——episode 播放器深色与状态色

> 分支：`feat/ui-token-batch5`
> 基准：master（含 PR #20 `e2f6f42`）
> 日期：2026-09-03（合入）
> 变更：6 文件（+129/−40）
> 关联方案：`docs/ui-optimization-plan.md`（v1.6）P1-A1「Token 收敛」
> PR：#22（merge commit `cf3a301`，提交 `5b16df1`）

---

## 触发条件

A1 第四批（PR #20）后，episode.vue 仍残留既定批次五对象：播放器/媒体深色体系与状态色字面量——深色台面 `#0b0d10`×4（视频历史、播放舞台、merge/exp 缩略图 letterbox 底）、白字白底、成功/警告状态描边 rgba。按「值不变改引用、视觉零变化」推进第五批。

## 改了什么

| 层面 | 改动 |
|---|---|
| token（studio.css） | 新增 `--media-stage-bg: #0b0d10`（媒体深色台面）；`--success-border: rgba(52,199,89,0.30)`（步骤完成节点描边）、`--success-border-strong: rgba(52,199,89,0.32)` / `--warning-border-strong: rgba(255,159,10,0.32)`（视频任务成功·失败徽标成对描边） |
| episode.vue | 深色台面 4 处 `#0b0d10` → `var(--media-stage-bg)`（`.video-history-item` / `.video-player-stage` / `.merge-card video` / `.exp-thumb`）；深底·彩底白字与白勾 20 处 `color:#fff` → `var(--text-invert)`（播放器叠层角标、历史/任务/缩略图角标、`--sel` 选中图标、成功徽标白字、`shot-check` 白勾等）；白底卡/激活块 6 处 → `var(--surface-raised)`（`stage-subnav-item.active` / `storyboard-shot-card(.active)` / `storyboard-ref-item` / `merge-card` / `exp-card`）；玻璃徽标与浮层阴影 2 处 → 复用 `--surface-glass` / `--shadow-float`（`.asset-cover-badge` / `.image-viewer-dialog`）；状态描边 5 处 → 新 token |
| 测试 | `apple-light-theme-structure.test.mjs` 新增 A1 批次五断言（token 定义 + 选择器引用 + `#fff`/`#0b0d10` 清零），全量 78/78 通过 |
| 文档 | `ui-optimization-plan.md` 升 v1.6；归档 PR #20（批次四）记录与索引 HB-20260903-02 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **媒体深色台面独立 token `--media-stage-bg`** | 播放器 letterbox 深底是「媒体承载面」语义，与卡片/表面体系不同维度，暗色可统一覆盖 |
| **状态描边按透明度拆两个 token** | `0.30`（步骤完成节点细描边）与 `0.32`（视频任务徽标成对描边）同语义不同值且各 ≥3 次，拆开命名避免归一；值不变改引用 |
| **白字/白底/玻璃/浮层复用既有语义** | 承接批次三（`--text-invert`/`--surface-glass`/`--shadow-float`）与批次四（`--surface-raised`）产物，不在批内重复定义 |
| **单次/低价值字面量保留** | episode 内 `#000`×2（video 元素底）、`#111`（参考素材占位）、半透明白 rgba（播放器空态文字/白描边/0.8 玻璃）保留待 A2 色板统一 |

## 回归测试

- 结构测试 78/78 通过（本机 node v22 实跑）；`git diff --check` 通过、无 lint 错误。
- 值不变改引用，视觉零变化；浏览器构建由 CI 执行。

## 对后续迭代的影响

- **A1（首批 + 二/三/四/五批）至此全部收口**；`studio.css` token 体系形成「品牌 + 中性文字/表面 + 功能色 + 媒体台面 + 语义阴影」完整骨架。
- A2 语义色板规范待做：裁决 detail 资产类型色（scene 绿、prop 琥珀、amber 横幅系）与 episode/detail 单次低价值字面量（`#000`/`#111`/半透明白等）。
- PR #21（设置页音频服务配置板块与 AutoDL IndexTTS2 预设）仍在评审，独立于 UI token 线。

## 注意事项

- 批次只做「值不变改引用」；`var(--x, fallback)` 兜底、JS 风格数据与 media 缩略图上的品牌底色不视为残留。
- 归档机制沿用：本批归档随后续 docs 小 PR 进入 master（本次合并点 `cf3a301`）。
