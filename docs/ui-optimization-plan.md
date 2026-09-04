# JisuVideo-ai 前端 UI 迭代优化方案

> 版本：v3.4
> 日期：2026-09-04
> 状态：**P0 收口（F 随 PR #13/#16，C1/C2 随 PR #13/#14）；P1 全部收口——A1 Token 收敛（批次一 #15、批次二 #18、批次三 #19、批次四 #20、批次五 #22）、A2 语义色板规范（批次一 #25、批次二 #26，规范 v2）、A3 动效体系化（PR #28，规范 v1，动效 token 六档 + 缓动统一 + keyframes 收敛）；设置页「音频服务」配置板块随 PR #21 合入（音频生成与工作台接入待后续工作流立项）；P2-B1——AppDialog（PR #30，settings 四弹窗迁移）、AppDrawer（PR #32，episode 任务抽屉迁移）、detail/episode 标准弹窗迁移（PR #31）、StatusBadge（PR #34，detail/episode 封面角标 + 行内状态胶囊 8 处迁移）、EmptyState（PR #36，index/detail 三处「虚线框卡片空态」迁移）、LoadingButton（PR #38 settings 9 处 + PR #40 episode 23 处按钮迁移）均随七批 PR 合入，Loader2 图标族按钮面清零，通用组件抽取按「先抽后改 + 标准面先迁 + 深度定制界面保留手写」边界推进；Field（PR #42，settings 22 处 + index 5 处 `.field` 骨架迁移）收口后 **B1 通用组件抽取面完成**；B3 分页 hook（PR #43，`usePagedList` + `dramaAPI.list` 分页参数）封装收口；**B2 试点收口（PR #45，2026-09-04 合入 `b11be06`，7 文件 5 提交 / 4 次正式 review / 测试 116/116）——episode 拼接导出面板下沉 `EpisodeExportPanel` + `useExportMergesList`，拆分模式成型（受控状态留主壳 + 令牌/事件协作 + 共享 scoped 类不复制），episode.vue 非空行 7069→6802（物理 7422→7150）**；**B2 script 面板拆分（PR #47）已合入（merge `58c1e96`，2026-09-04，纯搬迁、测试 124/124）——v2.8 顺序决策执行完毕，episode.vue 主壳降至 6763 非空行/7108 物理行（#45 历史结果 6802/7150 不变）**；**B2 余 assets/storyboard/video-tasks/task-drawer 拆分（等待窗口已解除，v3.3）**；**C3/P4 首轮落地（PR #48 已合入 `0ca0e0e0`，三轮评审收口）——素材库/任务列表分页化**：后端 `GET /assets` 与 `GET /tasks` 改为 SQL 下推分页（count + limit/offset，返回 `{ items, pagination }`），episode 参考素材选择器接入 `usePagedList`（每页 60 + 「加载更多」，hook 首个真实页面接入），分镜视频历史消费点适配；index.vue 项目列表接入 `dramaAPI.list` 仍受顶部统计/「继续上次制作」/「制作概况」全量依赖阻塞，待统计数据流裁决后单列**；**C4 暗色主题三批全部合入 master（PR #53 `7c99e15` / PR #54 `f959214` / PR #56 `c58323e`，2026-09-04）——C4 完结（spec v1.3）**；**多视频类型扩展线已取消（2026-09-04 用户决策，见修订记录 v3.3）**；**UI 治理专项进入维护状态、产品定位收敛为「AI 短剧生产工作台」（2026-09-04 定位裁决，见修订记录 v3.4 与 `docs/product-positioning-roadmap.md`）**
> 适用范围：`f:/JisuVideo/JisuVideo-ai/frontend`（Nuxt 3 SPA + Vue 3 + TypeScript + 纯 CSS Variables）

---

## 0. 修订记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.0 | 2026-09-02 | 初稿。基于 `frontend/app/**` 代码逐文件核实的 UI 体检结论；新增专项「设置页两级导航重构」（一级分组选 A：基础 / 高级）并冻结为 P0 优先项 |
| v1.1 | 2026-09-02 | 提交 PR 前自检修订：① 关键断言逐项核验（episode.vue 296KB/7315 行、detail.vue 124KB/2590 行、settings.vue 58KB/1319 行、index.vue 47KB/1241 行，与代码一致）；② 新增「第 8 章 与其他在途方案的边界」「第 10 章 待 Codex 评审决策点」；③ C 方向补 C6 表单字段级校验、D 方向补 D6 媒体加载占位；④ 第 9 章拆分度量由“单文件 ≤60KB”放宽为“面板文件 ≤1200 行 + 跨页重复样式归零”的可执行口径 |
| v1.2 | 2026-09-02 | PR #13 评审收口：① 头部版本/状态对齐事实（P0-F 已实施、随 PR #13 待合入，P1–P4 仍待排期）；② 第 8 章同步「PR #11（Agent/Skills 数据源）已合入 master」；③ 4.3 表 URL 深链明确为已延期独立增强项（第 10 章新增 D7）；④ 4.3 表补导航按钮 `aria-current` 可访问性条目；⑤ 方案文档合入路径收敛：由 PR #13 携带进入 master，PR #12 关闭避免双份合并 |
| v1.3 | 2026-09-02 | P1 推进记录：在 `feat/ui-p1-token-spec` 分支完成 A1 首批 Token 收敛（studio.css 新增 `--success-strong/--info-strong/--warning-strong/--fill-subtle/--border-hover/--error-outline/--action-danger-hover-bg/--overlay-mask/--switch-track/--scrollbar-thumb/--scrollbar-thumb-hover` 并替换全局原语引用），随后将 `episode.vue/detail.vue/default.vue/MentionTextarea.vue/ModelSelect.vue` 内同值字面量改为 Token 引用（值不变改引用）；R1 加载类失败残留清零（角色/场景/道具子资源加载失败不再静默置空，改内联呈现 + 重试）；同步新增「多线工作流状态排查记录」`docs/iteration-logs/2026-09-02-ui-communication-audit.md`，作为回答 UI/进度类问题的术语索引 |
| v1.4 | 2026-09-03 | P1 推进记录（续，归档体系化）：PR #15 合入 `12121d9`、PR #16 合入 `e9ca6ce`（首页双栏工作台 + 设置页三栏「目录—详情」，P0-F 按此演进收口，归档与索引见 `docs/pr-records/`）；PR #17 合入（新增 `docs/pr-records/README.md` 归档规范，含 Windows PowerShell 下 gh 中文乱码根因与规避——含中文的 gh 输入一律走文件/`gh api --input`，杜绝内联参数乱码）；PR #18 合入 `b14e950`（A1 第二批：通用填充/警示色收敛为 `--fill-hover` / `--unsaved-*`）；A1 第三批（封面占位 `--cover-fallback(-fg)` / `--cover-text`、反色白字 `--text-invert`、毛玻璃浮层 `--surface-glass` / `--shadow-float`）在 `feat/ui-token-batch3` 分支提交待评审 |
| v1.5 | 2026-09-03 | P1 推进记录（续）：PR #19 合入 `d58e570`（A1 第三批收口，归档见 `docs/pr-records/2026-09-03-ui-token-a1-batch3.md`，索引 HB-20260903-01）；A1 第四批在 `feat/ui-token-batch4` 提交待评审（settings/ConfirmDialog/default/detail 白字白底收敛为 `--text-invert`/`--surface-raised`，徽标方形投影新增 `--shadow-badge`；episode 播放器深色体系与 detail 资产类型色 scene/prop/amber 归入 A2 语义色板批次） |
| v1.6 | 2026-09-03 | P1 推进记录（续）：PR #20 合入 `e2f6f42`（A1 第四批收口，归档见 `docs/pr-records/2026-09-03-ui-token-a1-batch4.md`，索引 HB-20260903-02）；A1 第五批在 `feat/ui-token-batch5` 提交待评审（episode 播放器深色体系新增 `--media-stage-bg`，成功/警告状态描边新增 `--success-border(-strong)`/`--warning-border-strong`，白字白底随 `--text-invert`/`--surface-raised`/`--surface-glass`/`--shadow-float` 清零；detail 资产类型色仍归 A2） |
| v1.7 | 2026-09-03 | P1 推进记录（续，**A1 收口**）：PR #22 合入 `cf3a301`（A1 第五批收口，归档见 `docs/pr-records/2026-09-03-ui-token-a1-batch5.md`，索引 HB-20260903-03）；A1（首批 + 二/三/四/五批）全部合入 master；A2 语义色板规范待做（裁决 detail 资产类型 scene/prop/amber 系与 episode/detail 内 `#000`/`#111`/半透明白等单次字面量）；PR #21（设置页音频服务配置板块）独立于 token 线仍在评审 |
| v1.8 | 2026-09-03 | 独立线收口记录：PR #21 合入 `e3c0724`（`feat/audio-service-config`，8 文件 +77/−26）——设置页新增「音频服务」配置板块（AutoDL IndexTTS2 预设、audio 服务商白名单仅 `autodl`、后端 `ServiceType`/`officialProviders` 扩展 audio、默认生效与优先级暗示按接入状态条件化），经两轮评审边界收敛，归档见 `docs/pr-records/2026-09-03-audio-service-config-settings-board.md`，索引 HB-20260903-04；音频生成链路与工作台接入待后续工作流立项；A2 语义色板规范仍待做 |
| v1.9 | 2026-09-03 | P1 推进记录（续，**A2 收口**）：PR #25 合入 `1c090e1`（A2 批次一：detail 资产类别 scene/prop 与 amber 横幅收敛为语义 token + 语义色板规范 v1，归档见 `docs/pr-records/2026-09-03-ui-semantic-a2-batch1.md`，索引 HB-20260903-05）；PR #26 合入 `5b9ae75`（A2 批次二：episode 媒体遮罩/白字/焦点环收敛、R5/R6 全仓清理、`--new-style` 家族，规范升 v2，经两轮 R5 补漏评审收口，归档见 `docs/pr-records/2026-09-03-ui-semantic-a2-batch2.md`，索引 HB-20260903-06）。A2 全部收口，遗留字面量与 R3 归一记录归档于规范 §5/§6；P1 余 A3（动效体系化）待排期 |
| v2.0 | 2026-09-03 | P1 推进记录（续，**P1 全部收口**）：PR #28 合入 `72edeac`（A3 动效体系化：studio.css 新增六档时长 token `--dur-instant/fast/base/med/slow/stagger`，`--dur-slow` 取 0.30/0.32/0.35 中值 0.32 守 0.03s 归一边界；约 30 处默认 ease 显式补 `--ease-out`；detail/index 局部 `@keyframes spin` 收敛至 studio.css 单一来源；settings 内联 `transition:'0.2s'`（缺属性名被忽略）修复；新增动效规范 v1 `docs/ui-motion-spec.md`；经一轮 dur-slow 偏差评审修正，归档见 `docs/pr-records/2026-09-03-ui-motion-a3.md`，索引 HB-20260903-07）。**P1（A1/A2/A3）至此全部收口**，动效与语义色板两规范并列为基准；下一步 P2（组件化/拆分）或暗色主题批次可启动 |
| v2.1 | 2026-09-03 | P2 推进记录（续，**P2-B1 起步收口**）：B1 通用弹窗/抽屉组件抽取经三批 PR 全部合入——PR #30 `c9be4df`（新增 `AppDialog`：`.overlay>.dialog` 骨架 + head/body/foot 三段 + form 开关 + `width` prop 内联宽度 + Esc/遮罩统一关闭；settings 四个配置/风格弹窗迁移，归档见 `docs/pr-records/2026-09-03-ui-b1-dialog-batch1.md`）、PR #31 `04b128a`（detail 创建新集 + episode 新增资产/参考资产选择三处标准弹窗迁移，AppDialog 增 `dialogStyle` 多维尺寸 prop 与 `:style` 数组合并，`ref-asset-picker-overlay` 经组件根透传保留 z-index:120，归档见 `docs/pr-records/2026-09-03-ui-b1-dialog-batch2.md`）、PR #32 `e23ec12`（新增 `AppDrawer`：右侧滑出骨架 + `z-index:118` + `appDrawerIn` 复用 A3 动效 token + 关闭协议对齐；episode 任务抽屉迁移，Esc 经 `esc-close=false` 显式交还页面级 imageViewer→assetDetail→taskDrawer 优先级协议，归档见 `docs/pr-records/2026-09-03-ui-b1-dialog-batch3.md`，索引 HB-20260903-08/09/10）。**边界**：仅标准 head/body/foot 弹窗与标准右侧抽屉迁入组件，素材详情/viewer/多步创建等深度定制界面保留手写（结构测试守卫）；评审建议「最上层弹窗独占 Esc + 焦点返回」记录在案转深度定制界面专项；B1 余 StatusBadge/EmptyState/Skeleton/LoadingButton/Field 与 B2（巨型页面拆分）/B3（分页 hook）待排期 |
| v2.2 | 2026-09-03 | P2 推进记录（续，**B1 组件再收一子**）：PR #34 合入 `d61683f`（新增 `StatusBadge`：cover 封面玻璃角标 / pill 行内胶囊双形态 + `state` 三态语义 token 映射；detail/episode 共 8 处手写 `.asset-cover-badge`/`.mat-detail-state`/`.asset-detail-state` 迁移，样式逐字节下沉、状态判断与文案留在调用页；原 A1 batch5/A2 batch1 断言改指组件 `.sb-cover`，新增 batch4 断言组，归档见 `docs/pr-records/2026-09-03-ui-b1-badge-batch4.md`，索引 HB-20260903-11）。**边界**：组件只收「形态+状态样式」，中文文案与业务条件不外提；cover 态定位上下文依赖调用页父容器 `position:relative`；B1 余 EmptyState/Skeleton/LoadingButton/Field 与 B2（巨型页面拆分）/B3（分页 hook）待排期 |
| v2.3 | 2026-09-03 | P2 推进记录（续，**B1 组件再收一子**）：PR #36 合入 `c4cf9eb`（新增 `EmptyState`：props `title`/`desc` + `#icon`/默认插槽，收敛 index/detail 三处「虚线框卡片空态」（项目列表空态 / 素材库全空 / 分类为空），`.empty-desc` max-width 240 vs 260 笔头漂移统一 260px（index 侧 desc 均单行短句不触发换行，视觉零变化）；episode 展示体空态 `.step-empty`、detail 可点击 `.ep-empty` CTA 卡等特殊形态保留手写并测试守卫；归档见 `docs/pr-records/2026-09-03-ui-b1-empty-batch5.md`，索引 HB-20260903-12）。**边界**：组件只收骨架结构，图标/文案/按钮动作留在调用页（`#icon` + 默认插槽）；空态盘点结论：Skeleton 骨架屏全为内联 style 深度定制（`app-skeleton-line` 已全局、`skeleton-card` 仅 index 单点）不适合抽取；LoadingButton（30+ 处跨 4 文件、已分化 3 种 spinner：Loader2/`ring-spinner`/`spinner-sm`）与 FormField（4 文件各自重复 `.field` CSS，gap 5-8/weight 500-600 微差）复用面成立待排期；B1 余 LoadingButton/Field 与 B2（巨型页面拆分）/B3（分页 hook）待排期 |
| v2.4 | 2026-09-03 | P2 推进记录（续，**B1 组件再收一子**）：PR #38 合入 `bec885a`（新增 `LoadingButton`：props `loading`/`disabled`/`spinnerSize`，模板收敛「busy 时 disabled + `<Loader2>` 前置 + `#icon` 插槽替换 + 默认插槽文案恒渲染」，class/type/@click 经 attrs 透传视觉由调用页决定，`Loader2` 组件内自包含 import——经一轮复核指出父级同名导入不传递给子组件后补入；settings.vue Loader2 图标族 9 处 busy 按钮迁移（`styleExpanding`/`styleSaving`/`agentSaving`/skill 重试与保存/`cfgFetchingModels`/`cfgTesting` 等），非 loading 图标入 `#icon` 插槽、文案三元留默认插槽；settings 内 Loader2 仅剩非按钮「行内加载占位」保留，归档见 `docs/pr-records/2026-09-03-ui-b1-loading-batch6.md`，索引 HB-20260903-13）。**边界**：仅收敛 Loader2 图标族（标准面）；detail/index CSS 环族（`.ring-spinner.sm`/`.spinner-sm`）与 episode 整块加载态（`.step-loading` 24px）视觉不同不迁入，留后续以 settings 为样板逐面推进；B1 余 Field（FormRow）与 B2（巨型页面拆分）/B3（分页 hook）待排期 |
| v2.5 | 2026-09-03 | P2 推进记录（续，**Loader2 图标族按钮面清零**）：PR #40 合入 `2b8b6c4`（episode.vue 全部 23 处 Loader2 图标族 busy 按钮迁移至 `LoadingButton`：剧本改写/资产提取×3/角色场景道具卡行生成与上传×6/分镜拆分 bar 与空态/批量与选择栏视频提示词/storyboard prompt stack + video inspector 的 AI 生成与 MiniMax H3 ×4/videos 空态大按钮/assetDetail 提示词·上传·保存/资产新增；`loading` 与 `disabled` 语义正交拆分——原 `:disabled` 中业务忙条件（`videoPromptBatch.running` 全局忙、`rn && rt !== 'script_rewriter'` 他任务忙、`!selectedSbIds.length` 未选）独立为 `:disabled`，避免并入 loading 误显 spinner；episode 剩余 5 处 `<Loader2>` 全为非按钮加载态（`.step-loading` 整块 24px ×3、视频任务缩略图/素材库占位 18px ×2）保留手写并测试守卫；归档见 `docs/pr-records/2026-09-03-ui-b1-loading-batch7.md`，索引 HB-20260903-14）。**边界**：Loader2 图标族按钮面在 settings/episode 全部清零；CSS 环族与整块加载态留「spinner 视觉收敛专项」；B1 余 Field（FormRow）与 B2（巨型页面拆分）/B3（分页 hook）待排期 |
| v2.6 | 2026-09-03 | P2 推进记录（续，**B1 组件抽取面收口 + B3 分页 hook 封装收口**）：PR #42 合入 `43ee3e2`（B1 batch8——新增 `Field.vue`：`<label class="field">` 骨架 + label/required/hint props + #label/#hint 插槽 + 默认插槽控件，`.required` 星标提为 studio.css 全局类，settings.vue 22 处 + index.vue 5 处手写 `.field` 骨架迁移，附加布局类（.field-wide/.source-field/.compact-field）经 attrs 透传，页面重复骨架样式下沉删除，index 原 gap 6/weight 600 与 settings 基准 gap 5/weight 550 的笔头漂移归一，结构测试 91/91，归档见 `docs/pr-records/2026-09-03-ui-b1-field-batch8.md`，索引 HB-20260903-15）；PR #43 合入 `f93b287`（B3——新增 `usePagedList`：reload 整载/loadMore 追加/reset 作废，`{ ...fixed, page, page_size }` 覆盖顺序保证 fixed 不能篡改分页参数，递增请求代次丢弃过期成功/失败响应；`dramaAPI.list` 扩展 page/page_size/keyword/status；经三轮评审修正——① 参数覆盖顺序与延迟响应行为测试、② 默认测试改 tsx/esm 加载恢复 Node 20 基线（backend 同款）、③ 加载失败按加载器区分 skip/fail，frontend 测试 100/100（Node 20.20 与 v22 实测）且 build/generate 通过，归档见 `docs/pr-records/2026-09-03-ui-b3-paged-hook.md`，索引 HB-20260903-16）。**B1（AppDialog/AppDrawer/StatusBadge/EmptyState/LoadingButton/Field）组件抽取面与 B3 分页能力封装全部收口**；B2（巨型页面拆分）与各页面接入分页（C3/P4）待排期 |
| v2.7 | 2026-09-04 | P2 推进记录（续，**B2 试点收口**，最终数字经 #46 收口修正）：PR #45 合入 `b11be06`（B2 试点——episode.vue 拼接导出面板下沉 `EpisodeExportPanel.vue` + `composables/useExportMergesList.ts`：面板 UI 主体纯搬迁不改交互，评审中补状态一致性修复，共享空态与 `.content-panel` 壳留主壳不复制；`mergeData`/`doMerge`/轮询留主壳、export 列表三态与面板专属 CSS 下沉；镜头勾选集合提升为页面级受控状态（`exportSelectedIds`/`exportSelTouched` + `exportListRev` 刷新令牌）；**共 7 文件 5 提交（`b616b73`/`d5be58a`/`37b26f0`/`806553f`/`2f3a357`），经 4 次正式 review（3 Request changes + 1 Approved）收口，最终测试 116/116**；非空行口径 episode.vue 7069→6802（物理 7422→7150）、EpisodeExportPanel 354 非空行/365 物理行，归档见 `docs/pr-records/2026-09-03-ui-b2-episode-export-panel.md`，索引 HB-20260904-01）。**B2 拆分模式成型**：① 与主壳全局状态（顶栏/侧栏/弹窗共用）纠缠的逻辑留主壳、以令牌/事件协作；② 用户可见的跨面板页面级状态受控提升留主壳；③ 共享 scoped 类（空态/布局壳）不复制进子组件；④ 结构测试守卫随 CSS/模板迁移同步改目标文件。script 面板拆分顺序决策更新见下条 v2.8 |
| v2.8 | 2026-09-04 | **#45 收口修订 + B2 顺序决策更新（#46 收口，评审后修正）**：① #45 最终事实统一入档——7 文件 5 提交、4 次正式 review（3 Request changes + 1 Approved）、最终测试 116/116、行数统一为非空行口径（episode.vue 7069→6802，物理 7422→7150；EpisodeExportPanel 354 非空行/365 物理行），同步 pr-record/iteration-logs/本 plan；② **正式推翻第 8 章/D3 原「B2 拆分等多视频类型扩展前端改造合入后」的冻结顺序**——`docs/multi-video-type-extension-plan.md` 至今仍为「尚未进入生产开发」且无排期，无限期冻结 B2 不成立；script 面板拆分（PR #47，纯搬迁、不改变面板交互）与扩展前端改造（创建/建集入口 + video_type 字段流程）改动区域正交，顺序合入即可避免双向 rebase 冲突；拆分先行把 episode.vue 主壳瘦身至物理 ~7.1K 行量级，后续扩展改造落在更小主壳内、总冲突面更低；**风险控制**：多视频类型扩展进入生产开发前，B2 仅推进 script 面板一块，其余面板（assets/storyboard/video-tasks/task-drawer）拆分暂停待其前端改造，避免冲突面扩大；script 面板拆分已按此合入 **PR #47（merge `58c1e96`，2026-09-04，最终测试 124/124，`npm run build`/`npm run generate` 通过）**，v2.8 顺序决策执行完毕，#47 后 episode.vue 主壳 6763 非空行/7108 物理行（#45 的 6802/7150 保留为历史结果），归档见 `docs/pr-records/2026-09-04-ui-b2-episode-script-panel.md`，索引 HB-20260904-02；③ **行数口径统一为非空行**（凡行数均标注口径）。B2 余 assets/storyboard/video-tasks/task-drawer 拆分（等待窗口）与各页面接入分页（C3/P4）待排期 |
| v2.9 | 2026-09-04 | **C3/P4 首轮落地（PR #48 待评审）——素材库/任务列表分页化**（用户决策选「素材/任务分页化」，解决真正长列表场景）：后端 `GET /assets`（原全表读取后内存 filter/sort）与 `GET /tasks`（已 SQL 下推过滤但无 limit/offset）改为 **SQL 下推分页**——分页参数 clamp 1–100/默认 20（对齐 `GET /dramas`）、count + `desc(createdAt)` + limit/offset、返回 `{ items, pagination }`（items 字段 case 沿用各端点原约定：assets snake / tasks camel）；episode 参考素材选择器接入 **`usePagedList` 首个真实页面**（fetcher `{ drama_id, episode_id, ...q }`、pageSize 60、打开弹窗 `reset()+reload()` 作废在途与累积、上传成功后 `reload()`、loading/loadError 由 hook 同名状态接管驱动既有「加载中/失败内联 + 重试」UI、网格尾部「加载更多素材」按钮 hasMore 时才渲染），分镜视频历史消费点适配 `res.items`（page_size=100 一次取足保持小列表全量语义）；`GET /episodes/:id/generation-tasks`（任务抽屉）**保持 `{tasks, merges}` 不分页**（状态分区渲染 + 4s 轮询依赖完整任务集，分页随 D1 异步任务可视化评估）；index.vue 项目列表接入 `dramaAPI.list` 本轮不做（顶部统计/「继续上次制作」/「制作概况」依赖全量，待统计数据流裁决）。验证：frontend 测试 128/128（终轮修正后 130/130）、backend 结构测试子集 42/42、backend `typecheck` + frontend `build` 通过；PR #48 合入 `0ca0e0e0`（三轮评审收口：结构断言宽松化 / 无参旧契约兼容 / 视频历史截断修复——分镜历史回归不传分页参数的全量旧契约，`taskAPI.list` 返回类型放宽双形态），归档见 `docs/pr-records/2026-09-04-ui-c3-pagination-assets-tasks.md`（索引 HB-20260904-03）。C3 余 index 项目列表接入（数据流裁决后）与虚拟滚动/懒加载，B2 等待窗口拆分、C6 等维持待排期；C4 暗色主题立项见 v3.0 |
| v3.0 | 2026-09-04 | **C3/P4 首轮收口 + C4 暗色主题立项**：PR #48 合入 `0ca0e0e0`（三轮评审收口——① 结构断言宽松化：`const conds` 正则不再锚定类型注解等实现细节；② `/assets`、`/tasks` 未传分页参数时恢复旧契约全量数组、参考素材选择器 type 下推先过滤后分页、loadMore 失败保留现场可重试；③ 终轮 P1：分镜视频历史回归无参全量契约，去除 page_size=100 静默截断，`taskAPI.list` 返回类型放宽为双形态，全仓消费点矩阵自查无同类隐患）；frontend 130/130、backend 结构子集 42/42、build 通过，索引 HB-20260904-03。**C4 暗色主题立项**：A1/A2/A3 收口后依赖解除，细案见 `docs/ui-dark-theme-spec.md`（dark token 集 / `data-theme` 切换 / 默认跟随系统 / 分批路线与验收），首批为 token 集与切换机制落地 |
| v3.1 | 2026-09-04 | **C4 暗色主题 B1+B2 合入收口（P3-C4 推进）**：PR #53 合入 `7c99e15`（首批——studio.css dark 覆盖块 + `color-scheme` 双态 + 首帧 bootstrap 静态内联 nuxt.config head + system 运行时跟随（plugin/composable）+ B1 纸面字面量 token 化 + `--sel` 提全局；行为测试（主题核心/AA 实算）+ 构建产物集成测试（`test:build` 动态端口 + HTML 顺序断言 + CI/`npm run verify` 强制）；三轮评审收口（useHead→静态 head、弱 dist 检查→真构建产物测试、子进程 5s 兜底清理）；frontend 142/142，索引 HB-20260904-04，归档见 `docs/pr-records/2026-09-04-ui-c4-dark-theme-b1.md`）；PR #54 合入 `f959214`（第二批——B2 残留收口：`--action-danger-hover` / `--shadow-hover/menu/viewer` / `--solid-ink`，light 零变化；`--text-0` 作实心块底误用修正（index `.filter-chip.on` / `.step-indicator span.on` / header `.brand-mark`）；dark 覆盖完整性守卫 + B2 残留清零 + 白字 AA 锚定；**三轮 Request Changes 守卫逐级收紧**：① 文件级「至少一次」→ 按三目标选择器逐条断言 ② 规则体 background/background-color 只允许 `var(--solid-ink)`（防 longhand 覆盖 shorthand 颜色层）③ 收集校验全部同名独立规则（防 cascade 后置覆盖）+ 选择器内空白 `\s+` 匹配（防合法换行/多空格格式化误报），每轮均正向全绿 + 负面注入验证（拦截/不误报双向）；frontend 145/145、test:build 通过，索引 HB-20260904-05，归档见 `docs/pr-records/2026-09-04-ui-c4-b2-solid-ink-token.md`）。C4 余第三批（设置页「外观」浅色/深色/跟随系统三态切换 + 持久化，`useTheme.setTheme` 已暴露待接） |
| v3.2 | 2026-09-04 | **C4 暗色主题完结（P3-C4 收口）**：PR #56 合入 `c58323e`（第三批——设置页「外观」切换面板（跟随系统/浅色/深色三态 +「当前实际外观」实时回显）接 `useTheme.setTheme` → controller `setMode`（`localStorage['ui-theme']` 持久化 + `data-theme` 即时生效 + system 实时跟随）；切换 UI 抽独立组件 `ThemeAppearanceCard.vue`（接线内聚、Nuxt 自动注册，settings.vue 仅渲染引用）；评审 P2 跟进：① 深色选项说明文字对比度不足 → 改 `--text-2`（dark 4.60:1 AA）+ dark-theme-core 双主题 ≥4.5 守卫 + 防回退 token 锚定；② 缺挂载级交互测试 → 新增 vitest 挂载级套件（`tests/ui/theme-appearance-card.test.ts`，happy-dom + @vue/test-utils，组件跑真实 `useTheme`、controller 跑真实 `createThemeController`——仅复刻 theme.client 的 Nuxt 装配，核心逻辑零 mock；覆盖已存偏好首屏回显 / 三态选择即时生效 / 存储写入失败仍即时生效 / system 下 matchMedia 实时回显与解除/重跟）；`npm run test:ui` 4/4（CI/`npm run verify` 强制）；frontend 148/148、test:build 通过，索引 HB-20260904-06，归档见 `docs/pr-records/2026-09-04-ui-c4-batch3-appearance-switcher.md`）。**C4 完结**，spec `ui-dark-theme-spec.md` v1.3 |
| v3.3 | 2026-09-04 | **规划变更：主线二「多视频类型扩展」整体取消（用户决策）**——`docs/multi-video-type-extension-plan.md`（v2.2 冻结稿）头部已加注「已取消」保留存档（仓库外工作区根的同类参考稿 `JisuVideo-ai多视频类型扩展完整实施方案.md` 不随本仓库管理，不在修订范围内），不再实施、不再据此排期；**v2.8 冻结的「B2 其余面板拆分（assets/storyboard/video-tasks/task-drawer）等扩展前端改造合入后再拆」时序约束正式解除**（扩展线取消后不存在前端改造冲突），B2 剩余面板拆分恢复独立排期；原方案第 7 章 shuohao 五件套导入改为**「短剧上游导入」独立立项**（与六类型平台脱钩，待另行立项排期，分析成果继续以 `F:/JisuVideo/shuohao-skills` 族文档与根目录结合分析稿为参考）；净化需求稿 `docs/source-purification-requirement.md` 同步解除与扩展线 narrative 类型的耦合（§7 取消、4.1 判定与 §6 shuohao 表改平台自有口径） |
| v3.4 | 2026-09-04 | **产品定位收敛与 PR #58 改造为「战略定位与范围裁决 PR」（2026-09-04 定位裁决）**——**新增定位文档 `docs/product-positioning-roadmap.md`（v1.0，2026-09-04）作为产品定位与路线主文档**：产品定位收敛为「面向个人创作者和小型团队的 AI 短剧生产工作台」（短剧/漫剧共用叙事生产链，不再拆一级视频类型），北极星指标为「从导入原文到获得第一个可用分镜视频所需时间」，裁决记录/路线/核心指标见该文档 §3/§6/§7/§9，本文档自其发布后不再作为产品路线主文档；**UI 治理专项进入维护状态**（A1–A3/B1–B3/C3/C4 主体收口后不再作为产品主线，后续只修影响真实生产闭环的问题，不再扩大 UI 面）；下一专项确定为**「原文整理与智能分集」**（原文净化更名为原文整理，分集定界承接上下文分集，实施稿以修正后的 v0.4 另开 PR 承载）；净化需求稿 `docs/source-purification-requirement.md`（v0.3）与 shuohao 报告 `docs/shuohao-practices-borrowing-report.md` 自本 PR #58 移出——净化稿转 v0.4 另行开 PR、报告降级为参考资料（不等于立项，见 PR body 与定位文档）；本 PR 不再承载净化稿实施细节，多视频取消登记（v3.3）、B2 解冻记录与 iteration-log 术语同步保留 |

---

## 1. 背景与目标

### 1.1 背景

JisuVideo-ai 前端已完成「项目创建 → 剧本 → 资产 → 分镜 → 视频生成 → 合成导出」全流程，功能完备度高于 UI 治理度。当前 UI 以「Apple Light 桌面风格」手写 CSS 为主，存在巨型单文件、样式重复、无暗色主题、反馈体系不完整、窄屏适配不全等问题，随功能继续膨胀将显著抬高维护与改版成本。

### 1.2 目标

1. 建立可持续的设计体系（Token 收敛 + 规范文档），让后续功能开发「默认符合规范」。
2. 通过组件化与巨型文件拆分，把单页 300KB 级别的维护风险降下来。
3. 补全加载 / 空 / 错误三态与大数据量性能，提升弱网与长列表场景体验。
4. 按用户决策完成设置页两级导航重构（方案 A），作为首个可独立交付的 UI 迭代样板。
5. 中长期补齐暗色主题、窄屏适配、可访问性，为多端与国际化预留空间。

---

## 2. 现状体检（代码级结论）

| 维度 | 现状 | 关键位置 |
| --- | --- | --- |
| 技术栈 | Nuxt 3 SPA，纯 CSS + CSS Variables，无 UI 框架 | `frontend/app`，`nuxt.config.ts`（`ssr:false`） |
| 设计 Token | 已有较完整 Apple Light token（surface/text/accent/sp/radius/shadow），但页面内仍有大量硬编码色值/像素/断点 | `frontend/app/assets/studio.css` |
| 页面规模 | 巨型单文件：`episode.vue` ~296KB、`detail.vue` ~123KB、`index.vue`/`settings.vue` 46~58KB | `frontend/app/views/drama/*.vue`、`frontend/app/pages/*.vue` |
| 组件化 | 通用组件仅 5 个（BaseSelect/ModelSelect/MentionTextarea/ConfirmDialog）；Dialog/Drawer/下拉/空态/骨架屏等在各页面内重复手写 | `frontend/app/components/` |
| 反馈三态 | 空态较全；骨架屏仅首页项目列表有；错误依赖零散 `catch→toast`，无统一错误边界 | `index.vue`、各页面 script |
| 暗色主题 | 不支持，无 dark token / `prefers-color-scheme` | `studio.css` |
| 响应式 | 断点碎片化（760/860/900/1080）；`settings.vue` 与全局 header 无窄屏适配 | `index/detail/episode/settings.vue`、`layouts/default.vue` |
| 无障碍 | 部分有意识（sr-only/focus-visible/ConfirmDialog 键盘），不系统 | — |
| 数据量 | 素材库（`GET /assets`）与任务列表（`GET /tasks`）已分页化（SQL 下推 + `{items,pagination}`，v2.9）；episode 参考素材选择器接入 `usePagedList` 落地；剧集/项目列表仍一次拉取——index 顶部统计与「继续上次制作」依赖全量，接入分页待统计数据流裁决 | `useApi.ts`、assets/tasks 路由、episode.vue、index.vue |

### 2.1 设置页当前结构（重构前基线）

`frontend/app/pages/settings.vue` 已是「左导航 + 右内容」，但层级表达弱：

```text
左侧 settings-nav                            右侧 settings-content
├─ [基础] 分组 label
│    ├─ AI 服务      ← 平铺按钮（无层级感）       v-if tab==='ai'
│    └─ 风格预设      ← 平铺按钮                  v-else-if tab==='styles'
└─ "Agent 高级配置" 开关（checkbox，默认收起）  ← 不是目录项
     └─ 展开后出现 [高级] 分组：Agent 配置 / Skills
```

- 数据：`tab = ref('ai')`、`baseTabs`（ai/styles）、`advancedTabs`（agents/skills）、`showAdvanced`（开关）、`watch(showAdvanced)` 收起时回退 tab。
- 右侧四块内容以 `v-if / v-else-if` 按 `tab` 隔离，天然是「tab→内容」映射，可完整复用。
- Skills 区块内部另有第三层子布局（左侧 Agent 列表 + 右侧 Skill 管理），保持不变。

---

## 3. 迭代方向总览

| 方向 | 主攻点 | 对应主线 |
| --- | --- | --- |
| A. 设计体系规范化 | Token 收敛、字号/断点统一、动效体系、规范文档 | 打地基 |
| B. 组件化与结构重构 | 通用组件抽取、巨型页面拆分 | 可维护性 |
| C. 通用体验增强 | 骨架屏、分页/虚拟滚动、三态统一、暗色、响应式 | 用户体验 |
| D. 业务深度体验 | 异步任务可视化、Onboarding、媒体对照预览、数据仪表盘 | 产品差异化 |
| E. 无障碍与国际化 | 焦点管理、aria 语义、对比度、i18n 预留 | 长期正确性 |
| **F. 设置页两级导航重构** | 一级分组 + 二级目录 + 右侧内容联动（选 A：基础/高级） | **本期 P0 优先** |

> 说明：F 是 v1.0 新增的独立立项条目，原属于 D 方向中「信息架构（IA）」的范畴，因需求明确、改动面小、用户已拍板，故单列并提前至 P0。

---

## 4. 专项：设置页两级导航重构（方案 A，P0 优先）

### 4.1 需求与决策记录

- 需求：设置页左侧改为「一级目录 + 二级目录」树形导航；风格预设、Agent 配置、Skills 与 AI 服务都以二级目录形式常驻可见；点击二级目录，右侧展示对应详细内容。
- 决策（已确认选 A）：一级分两组 ——
  - `基础` = [AI 服务, 风格预设]
  - `高级` = [Agent 配置, Skills]
- 不变量：Skills 页内部已有的「Agent 列表 → Skill 管理」第三层结构不动；所有业务接口/数据结构不动。

### 4.2 目标结构

```text
设置中心
└─ 左侧树形导航（一级=分组，二级=可点目录）          右侧内容区（按二级切换，复用现有 v-if 区块）
   [基础]
     ├─ AI 服务      ───────────────────────────► AI 服务配置
     └─ 风格预设     ───────────────────────────► 风格预设管理
   [高级]
     ├─ Agent 配置   ───────────────────────────► Agent 运行配置
     └─ Skills       ───────────────────────────► Skills 管理（内部保留 Agent 列表三级结构）
```

### 4.3 改动清单（`frontend/app/pages/settings.vue`）

| # | 改动 | 说明 |
| --- | --- | --- |
| 1 | 数据结构合并 | 删 `showAdvanced`、`watch(showAdvanced)`、`baseTabs`/`advancedTabs` 平铺数组；改为嵌套结构：`navGroups = [{ id:'basic', label:'基础', items:[{id:'ai',...},{id:'styles',...}] }, { id:'advanced', label:'高级', items:[{id:'agents',...},{id:'skills',...}] }]`，`tab` 状态保留 |
| 2 | 导航模板双层渲染 | `<aside class="settings-nav">` 内 `v-for="group in navGroups"` 渲染分组，`v-for="t in group.items"` 渲染二级目录按钮（`t.id === tab` 高亮 active）；删除 `.nav-advanced` 开关整块 |
| 3 | 右侧内容区 | 四个 `v-if/else-if` 区块**不动**（已是 tab→内容映射），仅校验各区块容器 id 或注释与二级目录一一对应 |
| 4 | 默认与回退逻辑 | 保留 `tab = ref('ai')` 默认值；去掉「收起高级自动回退」的 watch 逻辑 |
| 5 | 样式收敛 | 删 `.advanced-*` 样式；`.nav-item` 激活态沿用 `--accent-bg`；分组间保留现有间距与分隔线即可 |
| 6 | （已延期为独立增强项）URL 深链 | 用 `useRoute`/`useRouter` 同步 `?tab=styles`，刷新/分享保持所在二级目录。本期**不实施**：避免为临时 tab 状态引入路由耦合，待 P2-B2 页面拆分时一并评估（见第 10 章 D7） |
| 7 | （可选）窄屏适配 | 本页当前无任何 `@media`；在 ≤768px 时左侧导航折叠为顶部横向滚动 tab 或抽屉，与全局断点策略（见 5.C.5）对齐 |
| 8 | （本期已实施）可访问性基线 | 导航二级目录按钮对当前项输出 `aria-current="page"`（`v-for="t in g.items"` 内 `:aria-current`），配合既有 `:focus-visible` 键盘态不回归 |

### 4.4 回归与验收标准

- 验收：四个二级目录常驻可见、无开关隐藏；点击每个二级目录右侧均显示对应详情；默认进入仍停在「AI 服务」；Skills 页内第三层（Agent 列表→Skill 编辑）行为不变。
- 回归：仅触及导航模板 + tab 数据结构 + 少量样式；不触碰任何 API / 业务逻辑；`npm run build` 通过；桌面 + 窄屏人工走查一次。

---

## 5. 分方向条目明细

工作量：S（≤1 人日）/ M（2–3 人日）/ L（1–2 周）；优先级：P0（快赢）/ P1（打地基）/ P2（结构）/ P3（主题多端）/ P4（深化）

### A. 设计体系规范化（P1）

| 条目 | 说明 | 工作量 | 价值 |
| --- | --- | --- | --- |
| A1 Token 收敛 | 把散落硬编码色值/像素/断点替换为 CSS 变量；统一字号阶梯（消除 10.5px/9px 等小数）；删重复工具类（`.spinner-sm`/`.ring-spinner`/`.step-loading`/`.empty-state` 等各自一份 → 收敛进 `studio.css`） | M | 高（暗色/组件化的前置条件） |
| A2 设计规范文档 | 色板/字号/间距/圆角/阴影/动效/按钮与 tag 用法成文，作为后续评审基准 | S | 高 |
| A3 动效体系化 | 统一缓动曲线与进入/切换动画用法；梳理 `page-enter`/`stagger` 应用面 | S | 中 |

### B. 组件化与结构重构（P2）

| 条目 | 说明 | 工作量 | 价值 |
| --- | --- | --- | --- |
| B1 通用组件抽取 | `AppDialog`（吸收各页手写 `.overlay>.dialog`）、`AppDrawer`（吸收任务抽屉）、`StatusBadge`、`EmptyState`、`LoadingButton`、`Field`（PR #42：settings 22 处 + index 5 处 `.field` 骨架迁移）；先抽后改，视觉不变（六件全部收口） | L | 高 |
| B2 巨型页面拆分 | `episode.vue`（296KB）按业务面板拆：storyboard / video-tasks / export / assets / task-drawer；`detail.vue` 拆 ep-list / asset-grid / planner。纯搬移不改行为，复用 Nuxt 自动注册 | L | 高（风险最大项，需分批） |
| B3 列表分页能力封装 | `usePagedList` hook + `dramaAPI.list` 分页参数扩展（PR #43 收口）；**episode 素材库首轮接入（v2.9）**打通 reload/reset/loadMore/hasMore 全路径，供后续分页/虚拟滚动统一接入 | M | 中 |

### C. 通用体验增强（P0 起 + P3）

| 条目 | 说明 | 工作量 | 价值 | 阶段 |
| --- | --- | --- | --- | --- |
| C1 骨架屏补齐 | 剧集列表、素材库、工作台各阶段、任务抽屉接入 skeleton（复用 index.vue 已有样式/模式） | M | 高 | P0 |
| C2 三态统一 + 全局错误处理 | 统一 `Loading/Empty/Error` 呈现；请求失败可重试；可选全局错误边界 | M | 高 | P0/P2 |
| C3 分页/虚拟滚动/懒加载 | 素材库（`GET /assets`）与任务列表（`GET /tasks`）已分页化并接入 episode（v2.9 首轮）；剧集列表（index.vue 项目列表）接入待统计数据流裁决（顶部统计/「继续上次制作」依赖全量）；虚拟滚动/懒加载仍待排期 | L | 中 | P2 评估、P4 实施 |
| C4 暗色主题 | 依赖 A1 完成；新增 dark token 集 + `data-theme` 切换（默认跟随系统） | L | 高 | P3 |
| C5 响应式统一 | 统一断点（建议 1280/1024/768 三档，替换现有 760/860/900/1080）；补 `settings.vue`、`layouts/default.vue` 全局 header 的窄屏方案；studio 面板窄屏降级 | L | 高 | P3 |
| C6（v1.1）表单字段级校验 | 配置/新建类表单校验错误内联到 field（现状主要靠 toast，如 settings 配置弹窗、新建集），统一错误样式与 `field-hint`/`field-error` 用法 | M | 中 | P2（先盘点现状再定） |

### D. 业务深度体验（P4，持续）

| 条目 | 说明 |
| --- | --- |
| D1 异步任务可视化升级 | 视频生成分钟级任务：抽屉内按「进行中/队列/完成/失败」分区、失败可重试、批量状态汇总、完成提醒（toast + 标题闪动） |
| D2 工作台 IA 梳理 | 剧本→制作→导出跳转的上下文保持；模型切换后的配置缺口就地提示 |
| D3 首次使用 Onboarding | 「配置 AI 服务 → 建项目 → 跑通一集」引导，与现有「未配置 banner」衔接成完整引导流 |
| D4 媒体预览升级 | 素材灯箱支持视频成片；分镜「参考图 vs 生成结果」对照；生成版本历史对比 |
| D5 数据统计可视化 | 详情页进度仪表盘：集完成度、任务成功率、耗时统计 |
| D6（v1.1）媒体加载占位体验 | 大图/视频渐进式加载与失败回退统一：blur-up 占位、poster 优先、错误图标兜底（thumb/poster 链路已具备，补统一展示组件与回退策略） |

### E. 无障碍与国际化（P4）

| 条目 | 说明 |
| --- | --- |
| E1 焦点与键盘 | 弹窗/下拉焦点陷阱与锁定、`aria-expanded`、菜单项语义化 |
| E2 aria 补齐 | 装饰性 SVG 统一 `aria-hidden`；Toast 接 `aria-live`；可点击 div 补 `role/aria-label` |
| E3 对比度 | 按 WCAG AA 走查 tag/次级文字/描边 |
| E4 i18n 预留 | 文案与插值收敛（如需） |

---

## 6. 分期路线图

| 阶段 | 交付 | 包含条目 | 周期 | 依赖 |
| --- | --- | --- | --- | --- |
| **P0 快赢** | 设置页两级导航重构（方案 A）、骨架屏补齐、三态统一 | F、C1、C2 | 1 周 | 无 |
| **P1 打地基** | Token 收敛 + 规范文档 + 动效统一 | A1–A3 | 1–2 周 | P0 后 |
| **P2 组件化** | 通用组件抽取 + 巨型页面拆分 + 分页 hook | B1–B3 | 2–3 周 | P1（token 稳定后样式收敛成本低） |
| **P3 主题与多端** | 暗色模式、响应式断点统一与窄屏适配 | C4、C5 | 1–2 周 | P1 |
| **P4 体验深化** | 异步任务可视化、Onboarding、媒体对照、仪表盘、A11y、分页落地（素材/任务列表已落地 v2.9，剧集列表待数据流裁决） | D1–D5、E1–E4、C3 | 持续迭代 | P2（拆分成组件后可复用） |

> 建议执行顺序：先做 **P0 的 F（设置页重构）** 作为样板交付并评审，再并行铺 P0 其余项与 P1。

---

## 7. 风险与回归策略

| 风险 | 缓解 |
| --- | --- |
| 巨型文件拆分破坏既有交互（拖拽布局、状态联动） | 分批、纯搬移不改行为；每批 `npm run build` + 关键路径手测（生成视频/任务抽屉/布局持久化） |
| Token 收敛引起观感漂移 | 收敛只做「值不变、改引用」，人工走查截图对比；硬编码先建映射表 |
| 分页/虚拟滚动需后端配合 | P2 先盘点接口，若后端不支持则先做前端「滚动分批渲染」，接口支持后无缝切换 |
| 暗色模式改动面大 | 仅在 P1 token 化后启动，dark token 与 light token 并行存在，逐页灰度 |

---

## 8. 与其他在途方案的边界与建议时序（v1.1 新增）

| 在途事项 | 与本文重叠面 | 建议 |
| --- | --- | --- |
| **（已取消）**「多视频类型扩展完整实施方案」v2.2 冻结稿（`docs/multi-video-type-extension-plan.md`） | 原计划 R5/R6 改造创建流程（`index.vue`）与建集入口 | **2026-09-04 用户决策整体取消**（见修订记录 v3.3）：不再实施、不再排期，文档加注「已取消」保留存档；v2.8 冻结的「其余面板拆分等扩展前端改造合入后再实施」时序约束随之解除，B2 剩余面板拆分恢复独立排期 |
| **（已合入）** `settings.vue` Agent/Skills 数据源改造：PR #11（`feat/style-ai-expansion`，master 合入提交 `437026b`） | 与 P0-F 同在 `settings.vue` | F 专项只动导航区 + tab 数据结构，不碰 Agent/Skills 数据逻辑；**已按原建议在其合入后实施**：P0-F 随 PR #13 落地（master `437026b` 之上），无冲突 |
| 其余未合并工作分支（`fix/*`、`perf/*` 等） | 详情页/设置页相关功能可能重叠 | 本文档以 `master` 为基线评审；各分支合入后若与重构区重叠，遵循「先合后拆」 |

---

## 9. 度量与验收（全局）

- 构建与静态：`cd frontend && npm run build` 零错误。
- 页面规模（v1.1 修订）：`episode.vue`/`detail.vue` 按业务面板拆为独立组件文件，主壳不再包含整段面板逻辑；单个面板文件（模板+脚本）目标 ≤ 1200 行，跨页重复样式以 grep 计数归零；不追求把核心面板文件压到很小的硬性数值，避免过度拆碎。
- 重复代码：`.spinner`/`.empty-state`/`.dialog` 类不再跨页面各写一份（以 grep 计数收敛）。
- 体验：主要列表页均有骨架屏/空态/错误重试；弱网与千条素材滚动无卡顿。
- 设置页：二级目录全量常驻可见、点击联动右侧内容、Skills 三级结构不回归。

---

## 10. 待 Codex 评审决策点（v1.1 新增）

| # | 决策点 | 背景 | 默认建议 |
| --- | --- | --- | --- |
| D1 | 设置页一级分组是否最终采用「基础 / 高级（方案 A）」 | 另有方案 B（服务连接 / 创作预设 / 高级能力）备选 | 采用 A：贴近现状、改动最小、心智常规 |
| D2 | Skills 页内嵌「Agent 列表 → Skill 管理」第三层是否保留 | 改为两级导航后，Skills 内容区左侧仍有 Agent 列表，视觉上像三层导航 | 首期保留不动；后续可选将 Agent 选择改为内容区顶部下拉 |
| D3 | B2 巨型页面拆分与多视频类型扩展（v2.2 冻结稿）的实施顺序 | 扩展稿原将改动 `detail.vue`/`episode.vue` 相关流程 | **决策已关闭（v3.3）：扩展线 2026-09-04 用户决策取消，不再构成时序约束**。script 面板拆分已按 v2.8 先行合入（PR #47，merge `58c1e96`）；其余面板（assets/storyboard/video-tasks/task-drawer）拆分恢复独立排期 |
| D4 | 暗色主题（C4）排期 1–2 周是否乐观 | 代码存在内联 `style` 与半透明 rgba 硬编码，P1 token 化后仍有残留 | 按 2–3 周排期，逐页灰度上线 |
| D5 | 分页/虚拟滚动（C3）是否先做「滚动分批渲染」过渡 | 后端 `GET /dramas`/`GET /assets`/`GET /tasks` 已支持 page/page_size 分页（v2.9 盘点落地） | episode 素材库已接入 hook（v2.9）；剩余页面（index 等项目列表）接入 hook 即可，无需滚动分批渲染过渡 |
| D6 | 文案是否完整 i18n（E4） | 当前单语种（中文）为主 | 仅收敛文案常量与插值，不做完整 i18n 首期 |
| D7（v1.2） | `?tab=` URL 深链是否本期实施 | 刷新/分享保持所在二级目录，属体验增强 | **已延期**：作为独立增强项另行排期，待 P2-B2 页面拆分时评估（避免为临时 tab 状态引入路由耦合） |
