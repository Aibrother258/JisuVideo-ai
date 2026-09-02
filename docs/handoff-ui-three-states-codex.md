# UI 三态治理 · 交接单（交给 Codex 排查优化 + PR 提交）

> 编写日期：2026-09-02
> 状态：**PR #14 已合入 master（`5cd1690`）**，本文档作为 P1 阶段 R1–R6 任务来源存档
> 来源分支：`feat/ui-c1-c2-three-states`（已删除）
> 合入目标：`master`（已完成）
> 适用范围：`frontend/app`（Nuxt 3 SPA + Vue 3 + 纯 CSS Variables，无 UI 框架）
> 关联方案：`docs/ui-optimization-plan.md`（v1.2，第 5 章 C1/C2、第 10 章 D1–D7 决策点）

---

## 0. 一句话概况

本分支把「加载 / 空 / 错误」三态做成**全项目统一规范**并落地到 4 个主要页面（index / settings / detail / episode），新增了**全局三态样式原语**与**结构测试基线（70 断言全绿）**。交给 Codex 的任务 = ① 系统排查仍走 `catch→toast` 或静默的加载类失败点并补齐；② 评审回归 + 开放决策；③ 准备 PR 合入 master。

---

## 1. 本次变更范围（归档）

三态改造内容均已提交并随对应 PR 评审合入（结构测试基线全绿）。涉及主要文件：

- `frontend/app/assets/studio.css`：全局三态样式原语（骨架 / 错误面板 / 加载态）
- `frontend/app/pages/index.vue`、`frontend/app/pages/settings.vue`、`frontend/app/views/drama/detail.vue`、`frontend/app/views/drama/episode.vue`：顶层与列表 / 面板的「加载 / 空 / 错误」三态落地
- `frontend/tests/three-state-structure.test.mjs`：结构测试基线
- `data/` 为运行时数据目录，【禁止】提交

---

## 2. 统一规范（后续所有改造必须遵守）

| 场景 | 规范 |
| --- | --- |
| **加载类**（打开面板/抽屉/页面首载时拉数据） | 失败必须**内联呈现 + 提供重试**，禁止只 `toast`、更禁止静默吞错。视觉 = `.app-state`（居中大面板）或 `.app-state-inline`（面板顶部横条） |
| **空态 vs 错误态** | 严格区分。拉取失败**不得回落成空态**（如「暂无任务」「素材库还没有…」），否则会误导用户 |
| **initial 语义** | 用户显式动作（打开抽屉、点击刷新、首载）→ 调用 `xxx(initial=true)`，显示骨架/错误；**后台轮询/静默刷新 → `false`，失败保留旧数据不打扰**（函数签名统一 `async function loadXxx(initial = false)`） |
| **操作类**（保存/删除/生成/拼接等提交动作） | 失败以 `toast` 提示合理；如失败后产生「脏状态」（如拼接失败后列表不同步），需**额外内联呈现** |
| 加载中 | 有骨架复用骨架；骨架条件建议 `loading && !已有数据.length`，避免二次加载闪烁 |

样式原语（`frontend/app/assets/studio.css` 尾部，361 行起）：

```css
.app-skeleton-line（+ .round 变体）  /* 脉冲骨架块 */
.app-state / .app-state-icon / .app-state-title / .app-state-desc
.app-state-error                     /* 错误面板：icon/title 变红 */
.app-state.compact-state             /* 抽屉/侧栏等窄容器：收紧留白 */
.app-page-loading                    /* 整页加载/失败容器（顶层三态） */
.app-state-inline / -body / -actions /* 内联错误横幅：横排 图标+文案+右侧动作 */
```

图标建议 lucide：错误 `CircleAlert` / 警告 `TriangleAlert`，重试一律 `RefreshCw`（`.btn` 内 `<RefreshCw :size="12" /> 重试`）。

---

## 3. 已交付改动明细（权威清单，Codex 排查时以 grep 行号为准）

### 3.1 `studio.css` — 全局三态原语
- 新增 2.0 节所列全部类与 `@keyframes app-pulse`；错误色走 `var(--error) / var(--error-bg)`，骨架走 `var(--bg-2)`，圆角走 token，**无硬编码色值**。

### 3.2 `pages/index.vue` — 项目列表错误态
- 新 `const loadError = ref('')`；`load()` 的 `catch(e)` 由 `toast.error` 改为 `loadError.value = e.message || '加载失败'`（成功/重试前置 `''`）。
- 模板列表区：`v-if="loadError"` → `.app-state.app-state-error`（icon + 「项目加载失败」 + desc + `@click="load()"` 重试按钮）；其后再 `v-else-if="loading"` 骨架（仍为原有 `.skeleton-card` 风格，未迁移到 `.app-skeleton-line`，见开放问题 R3）。
- 注意：本页其余操作类（新建/删除等）仍是 toast，属合理。

### 3.3 `pages/settings.vue` — 四个 tab 列表三态
- 状态：`cfgsLoading/cfgsError`（服务配置）、`styleLoading/styleError`（风格预设）、`agentsLoading/agentsError`（Agent 列表）、`skillsLoading/skillsError`（Skills）。
- 加载函数均已带 `initial = false` 参数：`loadCfgs` / `loadStylePresets` / `loadAgents` / `loadAllSkills`；页面挂载时以 `initial=true` 首载。
- 模板：每个 tab 内容区 = 骨架(加载中) / `.app-state.app-state-error`(失败 + `@click` 重试对应 load 函数，`true`) / 内容列表。
- Skills 页内部保留「Agent 列表 → Skill 管理」第三层结构（方案 D2，不归本分支处理）。

### 3.4 `views/drama/detail.vue`
- **顶层三态**（原整页白屏问题）：模板顶部 `v-if="pageLoading"`（`.app-page-loading` 骨架）→ `v-else-if="pageLoadError"`（`.app-page-loading` 内 `.app-state.app-state-error`，重试 `load(true)`）→ 内容。
  - `load(initial = false)`：`if (initial) { pageLoading.value = true; pageLoadError.value = '' }`；catch 仅 initial 置错；finally 仅 initial 关 loading。`refresh()` 走静默路径。
- **冲突框重载错误**（原未捕获 rejection）：新 `reloadPlanLoading` / `episodePlanReloadError`；`reloadServerEpisodePlan()` 包 try/catch/finally（行 ~1307）；模板按钮 `:disabled="reloadPlanLoading"` + 「正在加载…」，错误显示 `.episode-plan-reload-error`（tag-error + 文案，行 ~224）。按钮本身即重试入口。

### 3.5 `views/drama/episode.vue`（改动最多，189 行）
- **顶层三态**：与 detail.vue 同模式（`pageLoading`/`pageLoadError`，行 3–20 模板；`load(initial)`/`refresh(initial)`）。
- **导出/拼接面板**：
  - `mergeError` / `lastMergeIds`（行 2169–2170）：`doMerge` 两条失败路径（发起失败、后台轮询 `failed`）写入横幅；成功清空。横幅 `v-if="mergeError"` `.app-state-inline.app-state-error`（行 1221，含「重试拼接 `doMerge(lastMergeIds)`」「关闭」）。
  - 轮询检测 failed 时会**刷新成片列表**（修复了旧代码失败分支不刷新、卡片无法显示 failed 态）。
  - `loadExportMerges(initial)`：骨架卡 / `.app-state` 错误+重试 / 列表 / 空四分支；段头「刷新」与 `refresh()` 首载均 `true`。
- **任务抽屉**（补漏 1）：`taskListLoading`/`taskListError`；`loadGenTasks(initial)`；`openTaskDrawer()` 与抽屉头「刷新」→ `loadGenTasks(true)`；`refresh()` 内 `Promise.all([loadGenTasks(initial), loadExportMerges(initial)])`。模板：`v-if taskListError`（错误+重试）→ `v-else-if taskListLoading && !genTaskRows.length`（骨架行）→ 原空态 → 表格。**消除「失败被误读为暂无任务」**。
- **参考素材选择器**（补漏 2）：`refAssetLibraryError`；`loadRefAssetLibrary()` catch 由 toast 改内联（不再回落「素材库还没有…」空态）。模板分支：loading → 错误+重试 → 候选 grid → 空态。
- **顶栏模型配置**（补漏 3）：`configsLoading`/`configsError`；`loadConfigs()` 原 console 静默 → 失败内联提示。模板 `.model-config-hint`（加载中…）/`.model-config-hint.is-error`（tag-error「模型配置加载失败」+ 重试按钮），避免三个模型下拉「无声消失」。
- **分镜历史视频**（补漏 4）：`sbVideoHistoryError`；`loadSbVideoHistory()` catch 由「静默置空」改为置错（成功清空）。模板历史区块 `v-else-if="sbVideoHistoryError"`（`.video-history-error-row`：tag-error + 原因 + 重试）。

---

## 4. 验证基线（PR 前 Codex 必须复跑）

```powershell
# 工作目录：仓库根下的 frontend/
cd frontend
# 1) 结构测试（19 个测试文件，当前 70/70 全绿）
node --test tests/*.test.mjs
# 2) 构建
npm run build
# 3) lint：IDE diagnostics（无独立 script），当前 0 错误
```

测试文件 `frontend/tests/three-state-structure.test.mjs` 覆盖：四个页面顶层三态、settings 四列表、导出内联横幅与重试、任务抽屉/素材选择器/模型配置/历史视频补漏、detail 冲突框。**测试为「结构存在性」断言（grep 源码），非渲染测试**——重构/改名需同步。

---

## 5. 交给 Codex 的开放排查 / 优化任务

> 建议按编号顺序执行；每项均为**独立小任务**，可并行。明确写码前先回读当前文件（本交接单行号为 2026-09-02 快照）。

### R1【系统排查·主任务】加载类 `catch→toast`/静默 残留清零
- 对 `index.vue / settings.vue / detail.vue / episode.vue / components/*` 全量 grep `catch` 内 `toast`、以及 `console.error` 静默的读取路径。
- 按 2.0 规范分类：**加载类必须内联 + 重试**；操作类保留 toast。
- 预期存量点（自查参考，可能不全）：
  - `episode.vue` 资产/素材库相关 load、图片生成后的列表、技能/配置弹窗内读取；
  - `detail.vue` 分镜/角色/场景等**若仍有独立于顶层 `load()` 的局部拉取**（顶层已承载的列表可豁免，先确认数据是否都由顶层一次拉取）；
  - `settings.vue` 弹窗内（配置编辑弹窗打开时的回填读取）。
- 输出：残留清单 + 处置结果，逐一注明「已三态化」或「判定为操作类豁免」。

### R2【评审】空态统一评估（.step-empty / .empty-* vs .app-state）
- 各面板空态目前多用 `.step-empty` / `.empty-visual / .empty-title / .empty-desc` 手写组。
- 评估是否与 `.app-state` 合并（视觉差异：step-empty 通常带 icon 圆形容器，app-state-icon 为圆角方），给出**结论性建议**（迁移 or 共存并冻结双规范），**不要求立即执行大改**。

### R3【评审】index.vue / settings.vue 骨架一致性
- `index.vue` 骨架仍用旧 `.skeleton-card`（未迁移）；settings 四列表的加载分支骨架实现需核查是否复用 `.app-skeleton-line`。
- 若不一致，评估是否统一为 `.app-skeleton-line`（可在分支内小改，也可记为后续 A1 Token 收敛的一部分）。

### R4【验收】视觉回归清单（人工 / 断网脚本）
无法在本仓库做截图断言时，至少输出一份**可执行回归步骤**，覆盖：
1. 断后端（或路由拦截 4xx）下：首页、settings 四 tab、detail 首载、episode 首载 → 均显错误 + 重试，重试成功恢复；
2. 任务抽屉、参考素材选择器、顶栏模型、历史视频、导出「重试拼接」各自错误→重试路径；
3. 空态不再被错误污染（错误场景不再出现「暂无/还没有」文案）；
4. 成功路径横幅/错误自动消失、`refresh` 静默刷新不闪骨架。

### R5【评审】导出拼接失败 UI 细节
- 确认轮询 failed → 横幅 + 列表同步刷新后，卡片的 failed 态可读；「重试拼接」期间按钮态与横幅清空时机无竞态；成功后横幅消失。

### R6【可选】三态可访问性
- `.app-state` 错误面板建议 `role="alert"` 或 `aria-live`；重试按钮 focus 可达（当前未加）。

### R7【归档】与方案 v1.2 的衔接
- 本分支完成方案 P0 的 C1/C2（骨架补齐 + 三态统一）主链路；提交 PR 时建议在方案文档修订记录追加 v1.3 一条（P0-F、C1/C2 已随本 PR 落地）。
- 下一里程碑 = 方案 P1（A1 Token 收敛 / A2 规范文档）：本次新增 `app-*` 原语与 `--error/--error-bg` 用法应写入 A2 文档。

### R8【决策】方案第 10 章遗留决策点（本分支后生效）
- D2：Skills 三层结构保留；D3：P2-B2 巨型页拆分排期在多视频类型扩展之后；D5：分页先盘点后端；D7：`?tab=` URL 深链延期到 P2-B2 评估。——Codex 如接手后续排期需沿用此决策，**本 PR 不涉及**。

---

## 6. 提交 PR 检查单

```text
[ ] 复跑验证基线（4.0）：70/70 测试 + npm run build 成功 + lint 0
[ ] git add 范围 = 6 个文件：
      frontend/app/assets/studio.css
      frontend/app/pages/index.vue
      frontend/app/pages/settings.vue
      frontend/app/views/drama/detail.vue
      frontend/app/views/drama/episode.vue
      frontend/tests/three-state-structure.test.mjs
[ ] 严禁提交 data/（运行时数据）与 .nuxt/.output
[ ] 提交信息建议：
      feat(ui): 三态统一落地 C1/C2 —— 全局样式原语 + index/settings/detail/episode 加载失败内联与重试 + 导出/任务抽屉/素材选择器/模型配置/历史视频补漏（含结构测试）
[ ] PR 标题建议：UI 三态治理 C1/C2（骨架屏补齐 + 加载失败内联重试）
[ ] PR 描述引用本交接单 + docs/ui-optimization-plan.md 修订 v1.3（P0 阶段收口）
[ ] 目标分支 master；方案文档（v1.2）已在 master，不重复提交
```

---

## 7. 参考资料

- 方案文档：`docs/ui-optimization-plan.md`（v1.2）
- 样式入口：`frontend/app/assets/studio.css`（3 处入口：token / 组件 / 本次三态原语在文件尾）
- 结构测试基线：`frontend/tests/`（19 文件，含 `three-state-structure.test.mjs`）
- 图标体系：lucide（页面 import），常用 `CircleAlert / TriangleAlert / RefreshCw / Loader2`
