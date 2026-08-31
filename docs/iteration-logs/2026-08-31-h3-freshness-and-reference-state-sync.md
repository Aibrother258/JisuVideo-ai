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
