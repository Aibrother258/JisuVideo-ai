# UI C3/P4（首轮落地）：素材库 / 任务列表分页化（后端 SQL 下推 + episode 参考素材面板接入 `usePagedList`）

> 迭代：# 批 C3/P4 · 各页面接入分页（首轮：素材库/任务列表）
> PR：#48（merge commit 待回填）
> 日期：2026-09-04
> 版本：随本批迭代方案推进计划 v2.9（本批合入后由收尾文档提交统一归档）

## 1. 迭代背景与触发

- B3 分页能力封装（PR #43，`usePagedList` + `dramaAPI.list` 分页参数）合入后，接口侧仅 `GET /dramas` 支持分页；plan 正文（第 2 章「数据量」、C3）将「素材库、剧集列表、任务列表」列为页面接入候补，且明确 **涉及后端、需先盘点**。
- 盘点结论：`GET /assets` 为全表读取后内存过滤（素材库可能累积上千条，打开参考素材选择器即全量拉取）；`GET /tasks` 已 SQL 下推过滤但无 limit/offset；二者返回裸数组，无法被 `usePagedList`（消费 `{ items, pagination }`）直接接入。`GET /episodes/:id/generation-tasks` 返回 `{ tasks, merges }` 聚合结构，供任务抽屉分组渲染，不属简单列表（见 §5）。
- 用户决策：选「素材/任务分页化（前后端都动，解决真正的长列表场景）」，作为 C3/P4 首轮。

## 2. 决策与边界

| # | 决策 | 依据 |
|---|---|---|
| 1 | `GET /assets` 分页化：过滤/排序/分页全部 SQL 下推，返回 `{ items: snake_case, pagination }`；`page_size` clamp 1–100（默认 20，对齐 `GET /dramas`） | 原全表读取→内存 filter/sort 的语义逐条转译为 drizzle 条件（未删除 + 公共素材/归属短剧 + 跨集复用排除 + type），count + limit/offset 下推；`items` 元素沿用 `toSnakeCase` 输出，与原全量数组元素逐字段一致 |
| 2 | `GET /tasks` 分页化：在既有 type/storyboard_id/drama_id 条件下推基础上加 `page/page_size` + count，返回 `{ items, pagination }` | `items` 保持 camelCase（drizzle 原生行，与 `GET /tasks/:id` 一致），前端消费点一次取足（page_size=100）保持小列表全量语义 |
| 3 | 破坏性契约变更接受并一次性同步全部消费点（全仓仅 episode.vue 两处调用） | 返回值从裸数组变 `{ items, pagination }`；前置盘点确认消费点仅 `assetLibraryAPI.list`（参考素材选择器）与 `taskAPI.list`（分镜视频历史） |
| 4 | episode 参考素材选择器素材库区接入 `usePagedList`（pageSize 60 + 网格尾部「加载更多素材」按钮） | hook 首个真实页面接入；打开弹窗 `reset()+reload()` 作废上次分页累积与在途请求，避免跨集/跨次串数据；上传成功后 `reload()`（新素材 createdAt 最新落在第 1 页顶部）；loading/loadError 由 hook 统一管理，仍以同名状态驱动既有「加载中 / 失败内联 + 重试」UI |
| 5 | `GET /episodes/:id/generation-tasks`（任务抽屉）**本轮不分页**，保持 `{ tasks, merges }` 全量语义 | 抽屉按任务状态分区渲染 + 4s 轮询，分组视图依赖完整任务集；分页化随 D1 异步任务可视化专项评估，避免破坏分组/轮询数据流 |
| 6 | index.vue 项目列表（`dramaAPI.list`）**本轮不接入** | 顶部统计徽章 /「继续上次制作」/「制作概况」侧栏依赖全量项目数据，接入需先裁决数据流（倾向后端轻量统计接口），单列后续迭代 |
| 7 | 视频历史消费点一次取足（`page_size: 100`）而非逐页追加 | 单分镜 completed 视频量级小（个位数到几十），滚动追加在生成面板侧栏体验差；取足即可，接口已具备分页能力为将来预留 |

## 3. 改动文件

| 文件 | 改动 |
|---|---|
| `backend/src/routes/assets.ts` | GET / 由全表内存 filter/sort 改为 SQL 下推分页：分页参数解析（clamp 1–100/默认 20）、过滤条件转译（`deletedAt IS NULL` + 公共素材或归属当前短剧 + 跨集复用排除 + type）、count + `desc(createdAt)` + limit/offset；返回 `{ items: toSnakeCase, pagination }` |
| `backend/src/routes/tasks.ts` | GET / 在既有条件下推基础上加 `page/page_size` + count + limit/offset；返回 `{ items: camelCase rows, pagination }` |
| `frontend/app/composables/useApi.ts` | `assetLibraryAPI.list` / `taskAPI.list` 支持 `page/page_size` 透传，返回类型声明 `{ items, pagination }`（注释标注 items 字段 case 约定） |
| `frontend/app/views/drama/episode.vue` | 素材库状态区改由 `usePagedList` 解构（items/loading/loadError/hasMore/loadingMore/loadMore/reload/reset）；`loadRefAssetLibrary` 删除，打开选择器 `reset()+reload()`、上传成功后 `reload()`、错误重试按钮指向 `reloadRefAssetLibrary`；网格尾部新增「加载更多素材」按钮（hasMore 时才渲染、busy 禁用）；分镜视频历史消费点适配 `res?.items`（page_size=100 取足） |
| `frontend/tests/three-state-structure.test.mjs` | 「素材库失败内联错误 + 重试」断言随实现迁移同步：状态改由 hook 管理，重试按钮指向 `reloadRefAssetLibrary` |
| `frontend/tests/episode-media-pagination-structure.test.mjs` | 新增：API 层两 list 分页参数/返回结构断言；episode 素材库 hook 接入 + 打开重置 + 上传后整载 + 加载更多按钮 + 视频历史 `{items}` 断言（4 组） |
| `backend/tests/assets-tasks-pagination-structure.test.mjs` | 新增：GET /assets 与 GET /tasks 分页结构守卫（参数 clamp、SQL 下推条件、count/limit/offset、返回 envelope），及 generation-tasks 保持 `{tasks, merges}` 的边界守卫（3 组） |

## 4. 行为等价与回归验证

- frontend 结构/行为测试 128/128 通过（124 基线 + 新测试 4 组；含迁移守卫：素材库失败态与重试语义仍由同名状态驱动）。
- backend 结构测试子集 42/42 通过（含新测试 3 组；behavior 全量需本地 DB，未纳入 CI 形态）。
- `npm run typecheck`（backend）通过；`npm run build`（frontend）通过。
- 交互路径核对：
  - 打开参考素材选择器 → 加载第 1 页（60 条）；loading/失败内联错误 + 重试与拆分前一致。
  - 素材库 > 60 条 → 网格尾部出现「加载更多素材」→ 追加第 2 页，直到 hasMore=false 隐藏按钮；追加中按钮禁用并显示 spinner。
  - 切换选择器（重开）→ `reset()+reload()` 回到第 1 页，不残留上次翻页累积。
  - 本地上传新素材 → 后台 `reload()`，重开选择器时新素材位于第 1 页顶部。
  - 分镜视频历史：一次取足 100 条后按完成时间倒序渲染，数量不截断（原语义保持）。

## 5. 已知记录项

1. 参考素材候选 = 本剧资产（角色/场景/道具/分镜视频，来自 drama 数据，量级有限）+ 素材库（分页加载）。「加载更多素材」只追加素材库部分；本剧资产始终随 drama 数据全量呈现，两者混合栅格顺序保持「本剧资产在前、素材库按 createdAt 倒序」。
2. 任务抽屉（`GET /episodes/:id/generation-tasks`）仍为 `{ tasks, merges }` 全量语义，本轮不动（见 §2 决策 5）；taskAPI.listByEpisode 类型与调用点均未变。
3. backend behavior 测试需本地 DB 环境，CI 无法全量跑；本轮以结构守卫 + typecheck + frontend 全量覆盖。

## 6. 对后续迭代的影响

- **B3 → C3/P4 打通**：`usePagedList` 完成首个真实页面接入（reload/reset/loadMore/hasMore 全路径），素材库类长列表接入有样板可循。
- 后端分页样板（参数解析 clamp + count/limit/offset + `{items,pagination}`）就绪，后续接口分页化照抄 `GET /dramas` / `GET /assets` / `GET /tasks` 三例。
- index.vue 项目列表接入 `dramaAPI.list` 分页仍受「顶部统计 / 继续上次制作 / 制作概况」全量依赖阻塞，单列排期待数据流裁决（倾向后端轻量统计接口）。
- 剩余：storyboard/video-tasks/task-drawer 拆分（等待窗口随多视频类型扩展）、C6 表单字段级校验、D 系列等维持 plan v2.9 排期不变。
