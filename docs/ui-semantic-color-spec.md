# UI 语义色板规范（A2 篇）

> 版本：v1（2026-09-03）
> 关联：`docs/ui-optimization-plan.md` P1-A2「设计规范文档 · 色板」；实现基线 `frontend/app/assets/studio.css`
> 范围：Apple Light 主题（当前唯一主题）；暗色主题（P3-C4）在此语义层上覆盖 token 值即可，引用不动
> 原则总纲：**颜色一律语义命名、值只存在于 `:root` token 定义处；页面与组件只写 `var(--*)`**

---

## 1. Token 家族与语义

| 家族 | Token（组） | 语义 | 现成员 |
| --- | --- | --- | --- |
| 中性面 | `--surface-*` / `--bg-*` | 层级：base < soft < raised；hover < active；输入/描边/轮廓 | `--bg-0…3`、`--bg-hover`、`--bg-active`、`--surface-outline(-strong)` |
| 中性文 | `--text-*` | 0 主 / 1 次 / 2 辅 / 3 弱化 | `--text-0…3` |
| 品牌主操作 | `--accent-*` | 系统蓝：主按钮、选中、链接、角色（character）类别色 | `--accent(-dark/-text/-bg/-glow)` |
| 动作 | `--action-*` | 主/次/危险按钮面 | `--action-danger(-bg)` |
| 状态 | `--success/error/warning/info` + `-bg` + `-strong` + `-border(-strong)` | 反馈语义（tag/徽标/描边/圆点/胶囊） | 见 §3 |
| 资产类别 | `--kind-*` | 业务对象类别（素材/分镜对象） | `--kind-scene(-strong/-bg)`、`--kind-prop(-bg)` |
| 提示横幅 | `--notice-*` | 全局警示通知条（amber） | `--notice-bg/-border/-text/-link/-link-border/-link-hover-bg` |
| 未保存 | `--unsaved-*` | 表单未保存警示 tag（amber 深档） | `--unsaved-border/-text/-bg` |
| 反色/叠层 | `--text-invert`、`--surface-glass`、`--overlay-mask` | 彩底/深底白字、毛玻璃浮层、弹窗遮罩 | — |
| 媒体 | `--media-stage-bg`、`--cover-*` | 视频/封面深色画布与占位 | 批次二将追加 scrim 档 |
| 阴影 | `--shadow-*` | 层级：xs/sm/lift/lg/xl/float/badge | — |

## 2. 语义归属规则（评审基准）

- **R1 值不变改引用**：存量字面量收敛只换引用、不改值，杜绝观感漂移；必要时才新建 token 且新 token 值 = 原字面量。
- **R2 同一语义同一 token，不同语义允许同值分 token**：颜色不是按「长相」而是按「含义」归属。反例与裁决记录：绿 `#16a34a` 曾同时担任「制作中」状态字色（`.ep-status-active`，语义=进行中→success）与场景类别色（`.asset-group-head.is-scene`，语义=资产类别）。A2 批次一裁决：状态归 `--success-*` 家族、类别归新建 `--kind-scene`。同理 `#b45309` 同时是道具类别色（`--kind-prop`）与 amber 横幅链接色（`--notice-link`）——同值分属两 token，各自可被暗色主题独立覆盖。
- **R3 语义化允许极小观感归一**：当同一语义的多个近似值并存（Δ 肉眼可忽略）时，合并到该语义标准 token 并记录。案例：detail `.dot-active` 光晕 `rgba(34,197,94,0.35)` → `--success-border-strong`（0.32）；`.ep-status-active` 文字 `#16a34a` → `--success-strong`（`#248a3d`，深字对比更佳）。此类合并必须在本文件记录，评审据此放行。
- **R4 单次/低价值字面量不强收敛**：业务数据类颜色（风格预设渐变、provider 品牌色、能力徽标品牌渐变）与孤例 hover/纸面细节色保留字面量，载入 §5 遗留清单；组件抽取（P2-B1）时若变为多处复用再升 token。
- **R5 `var(--x, fallback)` 内联 fallback 属冗余**：fallback 值在 `:root` 定义后永不走通，且历史值常与 token 不符（如 `var(--warning, #b25000)` 现 token 为 `#ff9f0a`），有误导；A2 批次二清理。
- **R6 禁止内联 style 色值**（`style="color:#xxx"`）：遇之转 class + token（settings 音频提示图标 `#d9534f` 批次二裁决）。

## 3. 状态色规范（`--success/error/warning/info`）

| 成员 | 值 | 用途 |
| --- | --- | --- |
| `--success / --success-bg` | `#34c759` / `rgba(52,199,89,.12)` | 进行中/完成主色、tag 底 |
| `--success-strong` | `#248a3d` | tag/胶囊深字 |
| `--success-border(-strong)` | `rgba(52,199,89,.30/.32)` | 步骤节点、徽标描边、圆点光晕 |
| `--error / --error-bg` | `#ff3b30` / `rgba(255,59,48,.10)` | 失败/删除 |
| `--warning / --warning-bg` | `#ff9f0a` / `rgba(255,159,10,.12)` | 警示 |
| `--warning-strong` | `#c93400` | 警示深字/描边 |
| `--info / --info-bg` | `#5ac8fa` / `rgba(90,200,250,.14)` | 信息 |
| `--info-strong` | `#0b6b94` | 信息深字 |

业务映射记录：「制作中」= success 家族（`.ep-status-active`、`.dot-active`）；「已完成/激活」= accent 家族；「草稿」= 中性。新反馈类 UI 一律先查本表，禁止自造近似绿/红/橙。

## 4. 资产类别色（detail 素材库分组）

| 类别 | Token | 值 | 形态 |
| --- | --- | --- | --- |
| 角色 character | `--accent(-text/-bg)` | 系统蓝 | 分组条 + 全部角色卡 |
| 场景 scene | `--kind-scene` / `--kind-scene-strong` / `--kind-scene-bg` | `#16a34a` / `#15803d` / `rgba(34,197,94,.10)` | 分组左条 / 图标·文字 / 底色 |
| 道具 prop | `--kind-prop` / `--kind-prop-bg` | `#b45309` / `rgba(180,83,9,.10)` | 左条·文字·图标 / 底色 |

> 类别色只表达「对象属于哪类资产」，不表达状态；状态一律走 §3。

## 5. 遗留字面量清单（裁决记录）

### 5.1 不强收敛（记录在案，组件化时随迁）

| 位置 | 值 | 说明 |
| --- | --- | --- |
| detail 剧本/审阅面板 | `#fbfbfd`×2、`#fbfaf7`、`rgba(255,255,255,.7/.72)` | 「纸面/手稿」暖白审美，专属于审阅/规划面板，尚未复用到别处 |
| detail `.back-btn:hover` | `rgba(0,0,0,.09)` | 孤例 hover 深档 |
| settings 音频提示图标（内联） | `#d9534f` | R6 违规，批次二裁决（转 class 或归 error） |
| settings 测试结果描边 | `rgba(52,199,89,.4)`、`rgba(255,59,48,.4)` | 比 `--success-border(-strong)`/`--error-outline` 深；批次二裁决并入 border token 或新建 error-border |
| settings 能力/服务徽标 | `linear-gradient(...)` 系列（t-image/video/audio、amber 预设）、provider 品牌底 | 品牌渐变（业务数据），不强收敛 |
| settings 红浅横幅 | `#f0c0bb`/`#fdf1f0` | 单处警示容器，批次二裁决 |
| index 风格预设封面渐变 | `linear-gradient(...)`×13 | 业务数据（风格库），强收敛会损坏风格差异 |
| index source-badge | `rgba(52,199,89,.11)`+`#238a42`（已有）、紫 `rgba(175,82,222,.11)`+`#8642a6` | 「已有素材」≈ success 可并；「新风格」紫为 highligt 语义，批次二裁决是否建 `--kind-new` |
| episode 媒体画布 | `#000`/`#111`（video/ref 底） | 批次二裁决并入 `--media-stage-bg` 或独立 canvas token |

### 5.2 待批次二（episode 媒体遮罩/播放器）

| 项 | 现状 | 计划 |
| --- | --- | --- |
| 媒体深色遮罩 scrim | `rgba(0,0,0,.28/.35/.5/.55/.56/.6/.62)`×13 | 收敛 2–3 档语义 token（soft/med/strong），记录 R3 归一 |
| 半透明白 on-media | `rgba(255,255,255,.45/.8/.85/.9)` | 归 `--text-invert` 透明度档或媒体文字 token |
| `var(--x, fallback)` 冗余 | episode `--accent-soft`/`--bg-1`/`--surface-2`/`--warning`/`--success`、settings `--accent-bg` | R5 清理 fallback（保留 var 名或改为已定义 token） |
| 播放器局部紫 `--sel-*` | `#5856d6` 家族（局部定义） | 裁决：模型选中语义，升全局 token 或维持局部（批次二评审点） |

### 5.3 其余可精确映射（批次二顺手引用，值不变）

- episode `.video-player-empty-*` 等 on-media 白 → `--text-invert`/玻璃 token（复查口径）
- default header `rgba(251,251,253,.72)` → `--surface-glass` 族核对
- default `.nav-link.active` shadow、index 卡片 shadow 字面量 → `--shadow-float` 等

## 6. 维护规约

- 新增颜色先找语义归属；无处可归才新建 token，并把新 token 追加到 §1 家族表。
- 主题切换只覆盖 `:root` 值；任何页面出现新字面量颜色即视为违反本规范（结构测试按批补断言）。
- 本规范随 A2 批次推进升版（批次二合入后升 v2），并保持与 `studio.css` 注释段一一对应。
