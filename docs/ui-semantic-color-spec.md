# UI 语义色板规范（A2 篇）

> 版本：v2（2026-09-03；批次二合入）
> 关联：`docs/ui-optimization-plan.md` P1-A2「设计规范文档 · 色板」；实现基线 `frontend/app/assets/studio.css`
> 范围：Apple Light 主题（当前唯一主题）；暗色主题（P3-C4）在此语义层上覆盖 token 值即可，引用不动
> 原则总纲：**颜色一律语义命名、值只存在于 `:root` token 定义处；页面与组件只写 `var(--*)`**

---

## 1. Token 家族与语义

| 家族 | Token（组） | 语义 | 现成员 |
| --- | --- | --- | --- |
| 中性面 | `--surface-*` / `--bg-*` | 层级：base < soft < raised；hover < active；输入/描边/轮廓 | `--bg-0…3`、`--bg-hover`、`--bg-active`、`--surface-outline(-strong)`、`--surface-muted` |
| 中性文 | `--text-*` | 0 主 / 1 次 / 2 辅 / 3 弱化 | `--text-0…3` |
| 品牌主操作 | `--accent-*` | 系统蓝：主按钮、选中、链接、角色（character）类别色、选中卡浅底 | `--accent(-dark/-text/-bg/-glow/-soft)` |
| 动作 | `--action-*` | 主/次/危险按钮面 | `--action-danger(-bg)` |
| 状态 | `--success/error/warning/info` + `-bg` + `-strong` + `-border(-strong)` | 反馈语义（tag/徽标/描边/圆点/胶囊） | 见 §3 |
| 资产类别 | `--kind-*` | 业务对象类别（素材/分镜对象） | `--kind-scene(-strong/-bg)`、`--kind-prop(-bg)` |
| 提示横幅 | `--notice-*` | 全局警示通知条（amber） | `--notice-bg/-border/-text/-link/-link-border/-link-hover-bg` |
| 未保存 | `--unsaved-*` | 表单未保存警示 tag（amber 深档） | `--unsaved-border/-text/-bg` |
| 新风格高亮 | `--new-style-*` | 「新风格待入库」高亮紫（index 来源徽标/确认卡） | `--new-style`、`--new-style-bg/-soft/-border` |
| 反色/叠层 | `--text-invert`、`--surface-glass`、`--bar-glass`、`--overlay-mask` | 彩底/深底白字、毛玻璃浮层、顶部毛玻璃条、弹窗遮罩 | — |
| 媒体 | `--media-stage-bg`、`--media-scrim(-soft/-strong)`、`--media-text(-dim)`、`--cover-*` | 视频/封面深色画布、画布上深色遮罩档、画布白字层级 | — |
| 阴影 | `--shadow-*` | 层级：xs/sm/lift/lg/xl/float/badge；C4-B2 增 hover（卡抬升）/menu（弹层）/viewer（大图浮层） | — |

## 2. 语义归属规则（评审基准）

- **R1 值不变改引用**：存量字面量收敛只换引用、不改值，杜绝观感漂移；必要时才新建 token 且新 token 值 = 原字面量。
- **R2 同一语义同一 token，不同语义允许同值分 token**：颜色不是按「长相」而是按「含义」归属。反例与裁决记录：绿 `#16a34a` 曾同时担任「制作中」状态字色（`.ep-status-active`，语义=进行中→success）与场景类别色（`.asset-group-head.is-scene`，语义=资产类别）。A2 批次一裁决：状态归 `--success-*` 家族、类别归新建 `--kind-scene`。同理 `#b45309` 同时是道具类别色（`--kind-prop`）与 amber 横幅链接色（`--notice-link`）——同值分属两 token，各自可被暗色主题独立覆盖。
- **R3 语义化允许极小观感归一**：当同一语义的多个近似值并存（Δ 肉眼可忽略）时，合并到该语义标准 token 并记录。案例：detail `.dot-active` 光晕 `rgba(34,197,94,0.35)` → `--success-border-strong`（0.32）；`.ep-status-active` 文字 `#16a34a` → `--success-strong`（`#248a3d`，深字对比更佳）；批次二 episode 媒体遮罩 13 处六档 → 三档 `--media-scrim(-soft/-strong)`（Δ≤0.07，见 §6 归一记录表）。此类合并必须在本文件记录，评审据此放行。
- **R4 单次/低价值字面量不强收敛**：业务数据类颜色（风格预设渐变、provider 品牌色、能力徽标品牌渐变）与孤例 hover/纸面细节色保留字面量，载入 §5 遗留清单；组件抽取（P2-B1）时若变为多处复用再升 token。
- **R5 `var(--x, fallback)` 内联 fallback 属冗余**：fallback 值在 `:root` 定义后永不走通，且历史值常与 token 不符（如 `var(--warning, #b25000)` 现 token 为 `#ff9f0a`），有误导。批次二已全仓清理（episode/settings/ModelSelect）；`--accent-soft`/`--surface-2` 属未定义的 var 名，前者已正式化为 token（值同 fallback），后者改引已定义的 `--surface-muted`（同值 `#f5f5f7`）。
- **R6 禁止内联 style 色值**（`style="color:#xxx"`）：批次二已转 class + token（settings 音频提示图标 `#d9534f` → `.skill-load-error-icon { color: var(--error) }`，R3 归一记录）。

## 3. 状态色规范（`--success/error/warning/info`）

| 成员 | 值 | 用途 |
| --- | --- | --- |
| `--success / --success-bg` | `#34c759` / `rgba(52,199,89,.12)` | 进行中/完成主色、tag 底 |
| `--success-strong` | `#248a3d` | tag/胶囊深字 |
| `--success-border(-strong)` | `rgba(52,199,89,.30/.32)` | 步骤节点、徽标描边、圆点光晕 |
| `--error / --error-bg` | `#ff3b30` / `rgba(255,59,48,.10)` | 失败/删除 |
| `--error-border-strong` | `rgba(255,59,48,.40)` | 失败结果卡描边（测试结果 .bad、未来 error 深档） |
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

### 5.1 当前不强收敛（批次二后 master 现状，组件化/暗色批次随迁）

| 位置 | 值 | 说明 |
| --- | --- | --- |
| detail 剧本/审阅面板 | `#fbfbfd`×2、`#fbfaf7`、`rgba(255,255,255,.7/.72)` | 「纸面/手稿」暖白审美，专属于审阅/规划面板，尚未复用到别处 |
| detail `.back-btn:hover` | `rgba(0,0,0,.09)` | 孤例 hover 深档 |
| settings 能力/服务徽标 | `linear-gradient(...)` 系列（t-image/video/audio、amber 预设）、provider 品牌底 | 品牌渐变（业务数据），不强收敛 |
| settings 红浅横幅（skill 读取失败） | `#f0c0bb` / `#fdf1f0` | 单处警示容器，浅红值域与 error token 差大（≈error@0.25），整体替换观感漂移大，保留（图标已归 `--error`） |
| index 风格预设封面渐变 | `linear-gradient(...)`×13 | 业务数据（风格库），强收敛会损坏风格差异 |
| index 封面装饰 | `text-shadow rgba(0,0,0,.4/.24)`、`.cover-style-name` 底 `rgba(0,0,0,.34)` | 封面照片上文字投影/胶囊底，专属于封面视觉 |
| episode 播放器局部 `--sel-*` | `#5856d6` 家族（`.studio` 局部定义） | 裁决：单页面「模型选中/跳转点」语义，维持局部一致；暗色主题批次再决定是否升全局 |
| episode `.back-btn:hover` | `rgba(0,0,0,.09)` | 孤例 hover 深档（与 detail 同款） |
| episode pipeline `.pipe-item.doing .pipe-icon` 边框 | `rgba(0,113,227,.25)` | 单处 accent 描边（0.25 值域高于 glow 0.18），不强收敛 |
| episode 步骤导航未激活点 | `rgba(0,0,0,.14)`（`.sidebar-jump-dot`、`.bubble-dot` 各 1） | 深色小圆点，单页面双处，暗色主题统一时处理 |
| episode `.frame-thumb:hover` | （C4-B2 已收）`0 2px 8px rgba(0,0,0,.2)` → `--shadow-hover` | hover 抬升档，值不变 |
| episode `.ref-asset-card-check` | `rgba(20,20,24,.72)` | 缩略图内「已选」深 pill 底：媒体覆盖深底、明暗通用（暗色主题不反相，同 media-scrim 语义）；保持字面量并记录 |
| episode `.image-viewer-img` | （C4-B2 已收）`0 18px 48px rgba(0,0,0,.18)` → `--shadow-viewer` | 大图浮层投影档，值不变 |
| ModelSelect 菜单弹层 | （C4-B2 已收）`0 12px 32px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.06)` → `--shadow-menu` | 弹层投影档，值不变 |
| ConfirmDialog 危险钮 hover | （C4-B2 已收）`#d70015` → `--action-danger-hover` | 危险实心钮 hover 深档并入 action 系（dark `#cc3b32` 白字 4.95:1） |

### 5.2 批次裁决归档

| 项 | 裁决 |
| --- | --- |
| episode 媒体画布 `#000`/`#111` | 并入 `--media-stage-bg`（`#0b0d10`），R3 归一（Δ≈近黑，见 §6） |
| episode scrim 13 处 | 收敛 `--media-scrim(-soft/-strong)` 三档，R3 归一表见 §6 |
| episode `--sel-*` | 维持局部（见 §5.1 记录） |
| settings 测试结果描边 | ok `rgba(52,199,89,.4)` 归 `--success-border-strong`（R3）；bad `rgba(255,59,48,.4)` 新建 `--error-border-strong`（值不变） |
| settings 红浅横幅 | 不强收敛（图标 `#d9534f` 归 `--error`） |
| index source-badge「已有」 | 并 success 家族（`--success-bg`/`--success-strong`，R3 记录） |
| index source-badge「新风格」紫 | 新建 `--new-style` 家族（`--new-style`、`-bg`/`-soft`/`-border`，值不变） |
| default header / episode studio-topbar 玻璃 | 新建 `--bar-glass`（同值 `rgba(251,251,253,.72)`）；`--surface-glass`（0.85 白）语义不同不硬并 |

## 6. R3 归一记录（批次二）

| 语义 | 原值 → 现值 | Δ | 元素 |
| --- | --- | --- | --- |
| 媒体浅遮罩/弱底 | `rgba(0,0,0,.28)` → `--media-scrim-soft` | 0 | `.merge-card-play`（hover 播放大遮罩） |
| 同上 | `rgba(0,0,0,.35)` → `--media-scrim-soft`（.28） | −.07 | `.exp-check` 圆钮未选底 |
| 媒体钮底/索引 | `.5/.55/.56` → `--media-scrim`（.50） | 0 / −.05 / −.06 | `.asset-del-btn`、`.frame-re`、`.prod-idx`、`.video-inspector-asset small`、`.video-task-index`、`.exp-thumb-index` |
| 媒体时间/操作标底 | `.6/.62` → `--media-scrim-strong`（.60） | 0 / −.02 | `.video-history-time`、`.exp-thumb-duration`、`.video-history-del` |
| 媒体空态白字 | `.45/.85` → `--media-text-dim` / `--media-text` | 0 | `.video-player-empty`（icon 层 .45）、title（.85） |
| 勾选钮白边 | `rgba(255,255,255,.9)` → `--media-text`（.85） | −.05 | `.exp-check` border |
| 步骤浮层玻璃 | `rgba(255,255,255,.8)` → `--surface-glass`（.85） | +.05 | `.step-bubble` 播放进度浮层 |
| accent 选中/焦点环 | `.14/.15/.18` → `--accent-glow`（.18） | +.04/+.03/0 | `.dot.pending`、`.storyboard-shot-card.active/.is-selected`、`.exp-card.selected`、`.video-history-item.viewing` |
| 媒体画布底 | `#000` / `#111` → `--media-stage-bg`（`#0b0d10`） | 近黑 | `.prod-video`、`.merge-viewer-video`、`.ref-asset-card img/video` |
| 激活段浮起投影 | `0 1px 4px rgba(0,0,0,.12/.1/.09)` → `--shadow-float`（.08） | −.04/−.02/−.01 | episode `.stage-subnav-item.active`、default `.nav-link.active`、index `.source-method.on` |
| 分段容器底 | `rgba(0,0,0,.045/.04)` → `--fill-subtle`（.05） | +.005/+.01 | index `.source-methods`、episode `.video-task-metric/-status` |
| 「已有素材」徽标 | `rgba(52,199,89,.11)`+`#238a42` → `--success-bg`/`--success-strong` | +.01 / `#238a42→#248a3d` | index `.source-badge.is-existing` |
| 测试结果描边（ok） | `rgba(52,199,89,.4)` → `--success-border-strong`（.32） | −.08 | settings `.test-result.ok` |
| 错误图标 | `#d9534f` → `--error`（`#ff3b30`） | 偏亮 | settings `.skill-load-error-icon` |

> 归一均保持在「同语义同值域」内，Δ 全部肉眼可忽略或属系统色统一；如需精确回退可查上表反推。

## 7. 维护规约

- 新增颜色先找语义归属；无处可归才新建 token，并把新 token 追加到 §1 家族表。
- 主题切换只覆盖 `:root` 值；任何页面出现新字面量颜色即视为违反本规范（结构测试按批补断言）。
- 本规范随 A2 批次推进升版，并保持与 `studio.css` 注释段一一对应。
- 本批合入后遗留清单见 §5.1；「制作中」状态与成功系映射沿用 §3 记录，未在批二改动。
