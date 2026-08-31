# HB-20260831-05：H3 新鲜度与参考素材状态同步收紧

## 1. 迭代概况

- 日期：2026-08-31
- 状态：代码实现完成；静态审查通过；**本机无 Node 运行时，类型检查 / 测试 / 构建尚未执行**（见第 6 节）
- 触发来源：对 HB-20260831-01 ~ 04 的外部复盘（codex 分析）
- 目标：修复「刚生成的 H3 提示词立刻又被标记为过期」这条 P0 调用链，并收紧参考素材持久化、任务快照契约与测试基线。

## 2. 原始问题

复盘指出一条完整的误失效链路：

1. H3 Agent 保存提示词时写入 `minimax_h3_source_hash` / `minimax_h3_generated_at`；
2. 前端生成完成后执行 `refresh()`，用新对象替换当前分镜；
3. `selectedSb` 监听器随即对旧分镜的参考素材执行一次「内容完全相同」的回写；
4. 后端 `PUT /storyboards/:id/reference-assets` 收到保存请求就**无条件**清空 H3 指纹；
5. 结果：H3 刚生成成功，刷新后就可能被判为过期。

数据库抽查佐证：分镜 01 有约 4257 字符的 H3 提示词和两张参考图，但 `minimax_h3_source_hash`、`minimax_h3_generated_at` 均为空。

同时存在三个 P1：H3 来源指纹只覆盖少数字段；参考素材「先删后插」无事务、删除无级联、`asset_id` 未透传；MySQL 返回空数组时前端回退浏览器缓存可能把已清空的素材复活。

## 3. 本次范围

### 做了

1. **P0 内容感知失效**：参考素材保存、分镜字段更新都改为「保存前后各算一次来源指纹，指纹真的变了才清空 H3 元数据」。
2. **P1 来源指纹扩展**：指纹从「4 个文本字段 + 参考素材」扩展到「文本 + 场景绑定（含设定图版本）+ 角色绑定（含设定图版本）+ 道具绑定（含设定图版本）+ 额外参考素材」。
3. **P1 参考素材保存事务化**：删除 + 重新插入放进同一个数据库事务；增加图片≤9 / 视频≤3 / 音频≤3 / 总数≤15 的分类校验；分镜删除与 Agent 整集重建时级联清理参考素材；`asset_id` 从前端透传落库。
4. **P1 缓存优先级**：MySQL 请求成功返回空数组 = 正式状态就是空，不再回退浏览器缓存；只有请求失败才回退；保存失败弹出错误提示（不再静默吞掉）。
5. **P1 reference_snapshot 契约**：后端 `POST /tasks` 接收并归一化 `reference_snapshot`，随 `sys_task.params` 落库。
6. **P2 存量修复**：新增回填脚本，为「有 H3 提示词但无指纹」的历史分镜以当前输入为基准补齐指纹。
7. **P2 测试**：新增 11 组结构回归测试；静态排查并修正 5 处过时断言（非真实缺陷）。
8. **P2 文档**：修正 README 克隆地址与视频厂商表、补充许可证商用说明、补勾 HB-20260831-03 的验收清单、闭环迭代编号。

### 不做

- 不实现 H3 提示词结构校验器（复盘列为后续项）。
- 不把任务快照拆成独立表（继续随 `sys_task.params` 存 JSON）。
- 不恢复 `mysql-schema.ts` 里的旧表 `DROP` 清理语句（破坏性操作，需要单独评估，本轮只把相关测试断言改为「不再建旧表」）。
- 不重构 6800 行的 `episode.vue`（列为后续最大技术债）。
- 不引入鉴权（属于独立的安全迭代）。

## 4. 关键设计决策

### 4.1 指纹算法收敛到唯一入口

新增 `backend/src/services/h3-source.ts`，`collectH3SourceHash()` 是指纹的唯一计算入口：H3 保存时用它记录来源，失效判断时用它比对现状。**两个调用点共用同一套算法**是修复 P0 的必要条件——此前路由和 Agent 工具各自拼字符串算哈希，任何一边调整字段顺序就会立刻误判。

指纹内容：`video_prompt`、`description`、`atmosphere`、`duration`、场景（`scene_id` + `image_url`/`local_path`）、角色（ID 列表 + 各自图版本）、道具（同上）、额外参考素材（类型/角色/URL/**顺序**）。顺序纳入是因为参考素材顺序决定 H3 里的 `<Picture N>` / `<Video N>` 编号。各段用独立分隔符拼接，避免跨字段拼接产生歧义。

### 4.2 失效判断基于「内容变化」而非「请求出现」

`PUT /storyboards/:id/reference-assets` 与 `PUT /storyboards/:id` 都改为：

```
before = 指纹(当前 DB 状态)
  → 事务写入
after = 指纹(写入后 DB 状态)
if (after !== before) 清空 H3 元数据
```

前端回写相同内容、或只 PUT `minimax_h3_prompt`，指纹不变 → 不清空。副作用：指纹计算需要额外 3~5 个带索引的小查询，发生在保存/更新分镜这种低频操作上，可接受。

### 4.3 前端「恢复状态不回写」双层防线

- **签名去重**：`shotRefSignature()`（类型+URL+顺序）记录每个分镜最近一次成功写入的内容，相同直接跳过——这条防线与 watcher 触发时机无关，是时序安全的兜底。
- **`await nextTick()`**：`restoreShotRefSelection` 先记签名、赋值后等 deep watcher 在本帧内跑完再放开 `restoringShotRefSelection` 标志。此前的标志在 watcher 实际执行前就被同步复位，形同虚设。

### 4.4 空数组的语义

`GET /storyboards/:id/reference-assets` 返回 `[]` 表示「正式状态就是没有参考素材」。只有请求**抛错**才回退 localStorage。代价：后端故障期间用户看到的可能是数据库旧状态而非本地新选择——但反向语义会把用户清空的素材复活并写回数据库，危害更大。

### 4.5 事务边界与失效判断分离

指纹计算走模块级 `db`（读已提交状态），只有「删 + 插」放进 `db.transaction`。这样避免了把查询执行器在 `db` / `tx` 之间传来传去的类型摩擦，也保证 `before` 一定读到事务前的提交状态。事务失败直接 400 返回，不触碰 H3 元数据。

## 5. 分层改动

### 后端

- **新增** `src/services/h3-source.ts`：指纹唯一入口（`collectH3SourceHash` / `collectH3SourceParts` / `fingerprintReferenceAssets` / `computeH3SourceHash`）。
- **新增** `scripts/backfill-h3-source.ts` + `npm run backfill-h3-source`（支持 `--dry-run`）。
- **改** `src/routes/storyboards.ts`：
  - `GET /:id/reference-assets` 按 `sort_order` 排序返回；
  - `PUT /:id/reference-assets` 事务化 + 分类上限 + `asset_id` 归一化 + 内容感知失效；
  - `PUT /:id` 内容感知失效（替代旧的按请求字段判断）；
  - `DELETE /:id` 事务级联删除参考素材。
- **改** `src/agents/tools/storyboard-tools.ts`：`save_minimax_h3_prompt` 改用共享指纹；`save_storyboards` 的 `replace_existing` 级联清理参考素材。
- **改** `src/routes/tasks.ts`：接收并归一化 `reference_snapshot`（仅保留字符串数组 + 时间戳）。
- **改** `src/services/generation.ts`：`GenerateVideoParams` 增加 `referenceSnapshot`，随 params 落库，入队日志记录快照存在性。

### 前端

- **改** `app/views/drama/episode.vue`：
  - 新增 `lastSavedShotRefSelections`（签名去重）、`refAssetOrigins`（URL → asset_id）；
  - `saveShotRefSelection` 改 async，失败 toast 提示，成功后记录签名；
  - `restoreShotRefSelection` 空数组即空、仅失败回退缓存、`await nextTick()` 收口标志、恢复 `asset_id` 映射；
  - 资产库选择 / 本地上传时记录 `asset_id` 并随保存请求提交。

### 数据库

无 schema 变更（复用既有 `storyboard_reference_assets` 与 storyboards 上的 H3 元数据列）。

## 6. 验证证据与未通过项

**已做**：

- 逐文件静态审查全部改动（读完整改动后文件确认语法、导入、调用链闭合）。
- 新增 `backend/tests/iteration5-h3-freshness-and-reference-state.test.mjs`（11 组断言，覆盖 P0 调用链、事务、级联、快照契约、前端缓存语义、回填脚本）。
- 静态排查确认 5 处旧断言过时（非真实缺陷）并修正：
  - `official-provider-adapters.test.mjs`：视频厂商白名单扩为 volcengine/minimax/autodl 后旧断言仍要求只有 volcengine；
  - `seedance2-video-modes.test.mjs`：`resolvePublicMediaUrl` 已更名 `resolveReferenceMediaUrl`；分辨率已放开为白名单透传；旧表 DROP 清理已不存在；
  - `remove-audio-tts-structure.test.mjs`：`DROP TABLE ai_voices` 已不存在；
  - `remove-minimax-media-structure.test.mjs` 整文件过时（要求 MiniMax 全部移除），改名重构为 `minimax-provider-surface.test.mjs`，改为断言当前契约（视频保留、图片/TTS 保持移除）。

**未做（如实说明）**：

- **本机没有安装 Node.js**（`Get-Command node/npm` 均失败，常见安装目录也不存在），因此以下验证**均未执行**：
  - 后端 `npm run typecheck`
  - 前后端测试套件（含本轮新增测试——断言均按实际代码文本编写并逐条人工比对，但仍需运行确认）
  - 前端 `npm run build`
- 按项目记录规范，本轮全部改动视为「代码实现 + 静态审查完成」，**不视为已运行验证**。需要在有 Node 的环境（如 Docker 开发栈）补跑上述命令，并做一次真实闭环：选择素材 → 生成 H3 → 刷新页面 → 确认 H3 不再显示「可能已过期」。

## 7. 已知限制、风险与回滚

- **事务 API 依赖** `db.transaction`（drizzle-orm 0.45.1 mysql2）——版本支持该 API，但本机未能编译验证，需要在 typecheck 中确认。
- 回填脚本以「当前输入」为历史提示词的来源基准，属于**无法还原真值时的近似**：回填后如果用户先改内容再回填，会把已过期的提示词误标为新鲜。建议先 `--dry-run` 核对数量再执行。
- `restoreShotRefSelection` 在请求失败时以 localStorage 为准，可能与数据库短暂不一致（保存失败的 toast 已提示用户）。
- 回滚：还原 `storyboards.ts`、`storyboard-tools.ts`、`tasks.ts`、`generation.ts`、`episode.vue` 的本轮改动即可；`h3-source.ts`、回填脚本、新测试可整文件删除。无数据库结构变更，无需数据回滚。

## 8. 后续迭代建议

1. 在有 Node 的环境补跑 typecheck / 测试 / 构建，然后完成真实分镜闭环验证（选素材 → H3 → AutoDL 提交 → 检查 `sys_task.params.reference_snapshot` → 检查视频）。
2. 拆分 6813 行的 `episode.vue`（当前最大技术债）：按分镜区 / 资产区 / 任务区 / 导出区拆组件，参考素材逻辑抽成 `useShotReferences()` composable。
3. `routes/tasks.ts` 的 `GET /tasks` 仍是全表扫描后内存过滤，应下推到 SQL `where`。
4. 整个 API 无鉴权、`ai_service_configs.api_key` 明文存储——公网部署前必须加认证层。
5. 视频生成轮询在进程内存中 fire-and-forget，重启即丢；规模化后应换持久化队列（如 BullMQ）。
6. 评估是否恢复 `mysql-schema.ts` 的旧表 `DROP` 清理（本轮刻意未动）。
7. 剩余旧测试失败项需在有 Node 的环境逐条分类（真实缺陷 / 旧路径 / 旧断言）后继续收敛。

---

# 修订 R1：响应 PR 审查（2026-09-01）

PR #1（`Aibrother258/JisuVideo-ai`）审查结论：方向正确、不推倒重来，但有 **3 个合并阻断项** + 2 项建议。本修订在同一分支、同一 PR 上补齐，不另开新 PR。

## R1-阻断项 1：已过期的 H3 提示词仍会被拿去生成视频

原 `genVid` 只判断「有没有 H3 提示词」（`!!h3Prompt`），完全不检查来源哈希；参考素材/分镜内容变化、H3 已被标记过期后，用户仍可提交旧提示词生成视频。

修复（前端 + 后端双保险）：

- **前端** `episode.vue` `genVid`：新增 `h3SourceHash` 检查，`h3Provider && h3Prompt && !h3SourceHash` 时 toast 提示并 `return`，禁止提交。
- **后端** `tasks.ts` `POST /tasks`：新增服务端兜底 `verifyH3PromptFreshness(storyboardId, prompt)`——提交的 prompt 若与库中该分镜的 `minimax_h3_prompt` 逐字一致，就重算当前指纹与存储值比对；缺失指纹或指纹不匹配一律 400 拒绝。判定不依赖前端传任何标志，直接调 API 也无法绕过。

## R1-阻断项 2：角色/场景/道具图片更新后不会自动判定 H3 过期

上轮指纹已纳入角色/场景/道具图片地址，但失效判断只挂在「更新分镜」「保存参考素材」两个接口上；角色图/场景图/道具图在其他接口更新，重绘设定图后 H3 仍显示有效。

修复（三层覆盖）：

1. **失效钩子**：`characters.ts` / `scenes.ts` / `props.ts` 的 `PUT /:id` 在图片字段（`imageUrl` / `localPath`）变化时调用 `invalidateH3ForCharacter/Scene/Prop`，清空所有绑定了该资产的分镜 H3 元数据（界面立即显示过期）。
2. **生成回写失效**：`generation.ts` `writeBackImageAssets` 在角色/场景/道具图生成完成回写时同样失效；首帧/尾帧生成后也失效对应分镜 H3（帧图影响 H3 的 T2VA/I2VA/Ref2VA 模式判定）。
3. **指纹纳入 `updatedAt` 与帧图**：`h3-fingerprint.ts` 的资产版本 = `image_url|local_path|updatedAt`，文件内容改变但路径未变也能识别；指纹新增 `frameVersion`（首帧/尾帧）。即使某个更新路径漏挂钩子，服务端提交校验也会在最后一刻拒绝过期 H3。

纯算法抽到新模块 `backend/src/services/h3-fingerprint.ts`（无任何 DB 依赖），`h3-source.ts` 再导出并持有全部 DB 读写，两层职责分离。

## R1-阻断项 3：快速连续选择素材可能保存乱序

原实现监听数组变化后直接并发调用异步保存：请求一存 A、请求二存 A+B，若请求一最后完成，数据库最终只剩 A。后端事务只保证单次请求完整，无法解决多个请求完成顺序颠倒。

修复：`episode.vue` 新增**每分镜一条串行保存队列**（`shotRefSaveQueues` + `shotRefPendingSignatures`）：

- 内容与签名在入队时**同步捕获**（排队执行时状态可能已切换分镜或继续更新）；
- 同一分镜的请求永远按入队顺序依次执行，后面的保存排在前面的结果之后；
- 已成功写入或已有相同内容在排队时不重复入队（沿用签名去重）；
- localStorage 在入队时立即更新，HTTP 请求串行执行。

## R1-建议 1：参考素材总数超限改为显式报错

`storyboards.ts` 移除 `if (normalized.length >= REFERENCE_TOTAL_LIMIT) break` 的静默截断，改为循环后 `if (normalized.length > REFERENCE_TOTAL_LIMIT) return badRequest(400)`。单类上限 9+3+3 之和本已等于总量，此检查是防御性约束，防止未来任一上限调松后超量保存被悄悄截断。

## R1-建议 2：回填脚本不要直接运行

`backfill-h3-source.ts` 改为**默认只预演**：无参数时打印风险说明并退出；实际写入必须显式加 `--confirm`。风险说明明确「回填以当前输入为基准，无法证明生成时用的就是当前素材；无法确认内容一致的历史记录应直接重新生成 H3」。

## R1-测试

- **新增真实行为测试** `backend/tests/h3-source-behavior.test.mjs`（13 项断言）：直接导入 `h3-fingerprint.ts` 执行算法，无需 MySQL。覆盖：指纹幂等、文本/场景图/角色图/updatedAt/顺序/内容变化均改变哈希、`assetVersion` 语义、`h3FreshnessError` 拒绝与放行。通过 tsx 的 ESM 加载器（`register('tsx/esm')`）解析 TS 源码，`npm run test:h3` 可单独运行，`node --test tests/` 也能一起跑。
- **更新结构测试** `iteration5-*.test.mjs`（+56 行断言）：服务端 H3 过期兜底、三个资产路由的失效钩子、生成回写失效、前端过期拦截、串行队列、总数超限 400、回填 `--confirm`。
- 说明：审查建议的「H3 生成后刷新仍有效」「角色图更新后 H3 失效」「快速连选三张图最终存三张」等端到端行为，依赖 HTTP + MySQL + 前端渲染环境；本项目尚无该测试基建，本轮以纯函数行为测试 + 结构约束覆盖，端到端闭环仍在合并前 Checklist 中人工执行。

## R1-改动文件

- 新增：`backend/src/services/h3-fingerprint.ts`、`backend/tests/h3-source-behavior.test.mjs`
- 改：`h3-source.ts`（失效钩子 + 校验 + 帧图/updatedAt）、`tasks.ts`（服务端兜底）、`characters.ts` / `scenes.ts` / `props.ts`（图片更新失效钩子）、`generation.ts`（回写失效）、`storyboards.ts`（总量 400）、`episode.vue`（genVid 拦截 + 串行队列）、`backfill-h3-source.ts`（--confirm）、`package.json`（test / test:h3 脚本）、`iteration5-*.test.mjs`

## R1-验证状态（重要）

与上一轮相同：**本机无 Node 运行时**，本修订全部改动仅完成静态审查与结构测试断言逐条比对，typecheck / 测试 / 构建 / 真实闭环仍未执行，需在合并前于有 Node 的环境补跑（见下方 Checklist）。

---

# 修订 R2：响应第二轮 PR 审查（2026-09-01）

PR #1 第二轮审查确认 R1 修复方向正确，但仍有 1 个真实竞态 + 2 个本 PR 造成的测试故障 + 1 个边界问题。本轮全部补齐，并**首次在本机真实运行了 typecheck / 测试 / 前端构建**。

## R2-阻断项：串行保存没有在生成 H3、提交视频前等待完成

串行队列保证请求有序，但最新素材仍可能**排队未写入**：

1. `genMinimaxH3Prompt()` / `genVid()` 不等待队列 → 后端读旧素材 → H3 校验通过，但视频携带前端最新素材；
2. 保存失败在 `performShotRefSave()` 内被捕获后没有继续抛出 → 素材没落库也能继续生成。

修复（`episode.vue`）：

- **`flushShotRefSaves(storyboardId)`**：`while (shotRefSaveQueues[key]) await ...` 等队列完全清空；任一保存失败（记录在 `shotRefLastErrors`）则抛出，调用方必须中止。
- **`genMinimaxH3Prompt`** 与 **`genVid`** 在发起请求前 `await flushShotRefSaves(sb.id)`，失败 toast 后 `return`，不再提交。
- **`saveShotRefSelection`** 签名已排队时返回那条队列任务（`shotRefSaveQueues[key] || Promise.resolve()`），而不是立即放行。
- **`performShotRefSave`** 失败重新抛出（toast 保留）；队列 `catch` 记录到 `shotRefLastErrors`，既不产生 unhandled rejection，也让 flush 能感知失败。

## R2-阻断项：后端校验没有把本次请求的参考素材纳入比对

`verifyH3PromptFreshness` 只比对「数据库当前指纹」，而 H3 新鲜只证明「数据库状态 == H3 生成时」；调用者仍可带另一套素材提交。修复（后端两层）：

- **`h3-fingerprint.ts`** 新增纯函数 `normalizeSubmittedReferences` + `fingerprintSubmittedReferences`：前端提交的额外素材（images/videos/audios）归一化后与 `fingerprintReferenceAssets` 同构，可直接字符串比较。
- **`h3-source.ts`** `verifyH3PromptFreshness` 接收第三参 `submittedReferences`：hash 新鲜的前提下，再用 `collectStoryboardReferenceAssets` 取数据库当前额外素材逐项比对，不一致返回 400「参考素材与 H3 生成时不一致」。
- **`tasks.ts`** 提交校验时传入 `{ images: snapshot?.extra_images ?? reference_image_urls, videos, audios }`。
- **`episode.vue`** `reference_snapshot` 增加 `extra_images`：`reference_image_urls` 混入了场景/角色/道具图，无法与数据库的额外素材直接比对，必须单独携带；`generation.ts` 的 `VideoReferenceSnapshot` 类型同步补充。

## R2-边界：资产软删除不失效 H3

`characters.ts` / `scenes.ts` / `props.ts` 的 `DELETE /:id` 现在调用 `invalidateH3ForCharacter/Scene/Prop(..., '-deleted')`；`assetVersion` 新增第 4 段 `deletedAt`（`imageUrl|localPath|updatedAt|deletedAt`），删除绑定素材后即使漏掉失效钩子，提交校验也会因 hash 不匹配拒绝。

## R2-测试修复（审查方实跑发现的 3 个问题）

1. **`h3-source-behavior.test.mjs` 重复注册 `tsx/esm`**：删除文件内 `register('tsx/esm')`，加载器统一由 npm 脚本 `node --import tsx/esm` 加载，消除 `ERR_UNSUPPORTED_RESOLVE_REQUEST`。
2. **`iteration5-*.test.mjs` 在旧文件找 `imageUrl/localPath`**：断言改指 `h3-fingerprint.ts`（资产版本纯函数层）；同时修正 h3-source re-export 断言以兼容多行导出。
3. **`npm test` 无法展开测试**：`node --test tests/` 在 Node 22 把目录当模块路径（`MODULE_NOT_FOUND`），改为 `node --import tsx/esm --test`（默认扫描全部 `*.test.mjs`）。
4. 行为测试实际 12 项（回复误称 13）→ 本轮新增「资产软删除改变哈希」「assetVersion deletedAt」「提交素材指纹同构」3 项，现为 **15 项**。

## R2-首次真实运行结果（本机 Node v22.22.2）

| 验证项 | 结果 |
|---|---|
| `cd backend && npm run typecheck` | 通过 |
| `cd backend && npm test` | 91 项中 82 通过、9 失败（全部为既有测试债务，与审查方判断一致） |
| `cd backend && npm run test:h3` | 15 项全部通过 |
| `cd frontend && npm run build` | 通过（Nuxt 生产构建） |
| `cd frontend && node --test` | 32 项中 14 通过、18 失败（与合并前基线完全一致，无新增失败） |

9 个既有后端失败抽查确认与本轮无关（`episodes.ts` 错误消息断言、上传路由 `AUDIO_EXT` 断言等过时结构断言）。

## R2-改动文件

- 改：`episode.vue`（flush + 失败中止 + extra_images）、`h3-fingerprint.ts`（deletedAt + 提交素材指纹）、`h3-source.ts`（校验第三参 + collectStoryboardReferenceAssets）、`tasks.ts`（extra_images + 传参）、`generation.ts`（快照类型）、`characters.ts` / `scenes.ts` / `props.ts`（删除失效）、`package.json`（npm test）、`h3-source-behavior.test.mjs`、`iteration5-*.test.mjs`

## R2-剩余

合并前仍需人工执行一次真实闭环（需要 MySQL + 生成服务）：快速连选素材 → 立即生成 H3 → 提交视频，确认素材全部落库、H3 基于最新素材生成、提交不被拒。代码层与自动化验证已全部就位。

---

# 修订 R3：响应第三轮 PR 审查（2026-09-01）

第三轮审查（P1）：**素材快照仍可伪造绕过 H3 校验**——服务端用 `reference_snapshot.extra_images/videos/audios` 做一致性校验，但真正生成视频时使用 `body.reference_*_urls`。直接调 API 时可在快照里填数据库正确值、实际生成数组放另一套素材，校验仍会通过。**结论：不能信任客户端快照。**

## 修复：服务端重建参考列表，与实际的 reference_*_urls 逐项比较

- **`h3-fingerprint.ts`** 新增纯函数：
  - `normalizeReferenceImageUrl`：与前端 `episode.vue` 的 `normalizeMediaUrl` 等价（空值→空串、http(s)/data:/根路径原样、其余补 `/` 前缀）；
  - `sameReferenceList`：长度与每一项逐项比较（顺序敏感）；
  - `referenceMismatchError(db, submitted)`：db 为服务端重建的当前状态（images/videos/audios），submitted 为请求中的实际数组；图片/视频/音频任一不一致返回对应拒绝消息。**只比较实际数组，与快照完全无关。**
- **`h3-source.ts`**：
  - 新增 `reconstructFullReferenceImageList(storyboardId)`：服务端重建完整图片列表——场景图 → 角色图（按 `storyboard_characters` 绑定顺序）→ 道具图（按绑定顺序）→ 数据库额外参考图片（按 `sort_order`），与前端 `getShotReferenceImages` 同一套归一化、去重、≤9 上限；
  - `verifyH3PromptFreshness` 第三参语义改为「请求中的实际 `reference_*_urls`」：hash 新鲜的前提下，用 `reconstructFullReferenceImageList` + `collectStoryboardReferenceAssets` 重建当前状态，交 `referenceMismatchError` 判定。
- **`tasks.ts`**：校验传 `{ images: body.reference_image_urls, videos: body.reference_video_urls, audios: body.reference_audio_urls }`，移除 `snapshot?.extra_images` fallback；注释明确快照仅用于落库追溯。
- **`episode.vue`**：`extra_images` 保留（随快照落库供追溯），注释更新为「H3 一致性校验不读取本字段」。

## 测试

- 行为测试 15 → **19 项**：新增 `normalizeReferenceImageUrl` 等价性、`sameReferenceList` 顺序敏感、`referenceMismatchError` 放行、**伪造快照拒绝**（快照正确但实际图片/视频被偷换或多传一张，均必须返回 400）。
- 结构测试 `iteration5` 更新：断言校验只比较 `body.reference_*_urls`、`doesNotMatch(snapshot?.extra_images)`、服务端重建列表与拒绝消息在纯函数层。

## R3-真实运行结果（Node v22.22.2）

| 验证项 | 结果 |
|---|---|
| `cd backend && npm run typecheck` | 通过 |
| `cd backend && npm test` | 95 项中 86 通过、9 失败（全部既有测试债务） |
| `cd backend && npm run test:h3` | 19 项全部通过 |
| `cd frontend && npm run build` | 通过 |
| `cd frontend && node --test` | 14/32，与合并前基线一致，无新增失败 |

## R3-改动文件

- 改：`h3-fingerprint.ts`（normalizeReferenceImageUrl / sameReferenceList / referenceMismatchError）、`h3-source.ts`（reconstructFullReferenceImageList + 校验改实际数组）、`tasks.ts`（传 body.reference_*_urls，移除快照依赖）、`episode.vue`（注释更新）、`h3-source-behavior.test.mjs`（+4 项，含伪造快照）、`iteration5-*.test.mjs`（断言更新）

## R3-剩余

与 R2 相同：合并前人工真实闭环一次（需要 MySQL + 生成服务）。自动化验证全部就位。
