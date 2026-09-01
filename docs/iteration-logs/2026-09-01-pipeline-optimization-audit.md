# 全链路优化点深度排查报告

> 日期：2026-09-01
> 范围：剧本/拆集/提取/生图/视频生成/合成导出 全链路（后端 `src/`、前端 `app/composables` 与状态层）
> 方法：源码逐环节走查 + 数据流/并发/错误处理/资源管理四个维度交叉分析

---

## 0. 结论速览

按对生产可用性的影响排序，问题集中在 **任务执行引擎** 与 **数据访问层** 两大块：

| 级别 | 问题 | 影响 |
|---|---|---|
| P0 | 任务队列为进程内内存态，无持久化/恢复 | 服务重启或崩溃即丢失全部进行中任务，上游已产生的生成费用浪费，需人工重新发起 |
| P0 | 批量生成无并发控制 | 批量视频/图片同时打爆厂商 API，触发 429 限流、内存与句柄膨胀 |
| P0 | 生成请求与下载无重试、无超时兜底 | 网络抖动即任务失败；视频下载无大小上限、全量进内存 |
| P1 | 大量全表扫描 + N+1 查询 | 项目/镜头数量上来后接口明显变慢（列表、详情、任务聚合） |
| P1 | FFmpeg 拼接全量重编码 + 无一致性预检 | 一集 10–20 分钟素材转码耗时大；参数不一致时产出卡顿片 |
| P1 | 上传与存储无配额/清理策略 | `data/static` 无限增长，磁盘无兜底 |
| P2 | CORS/认证/密钥存储 | 公网部署存在暴露面 |
| P2 | 可观测性弱 | 无任务成功率/耗时指标，排障靠日志翻找 |

---

## 1. 任务执行引擎（P0）

### 1.1 进程内内存队列，重启即丢失
- `services/generation.ts:183` `createTask` 用 `processTask(id, config).catch(...)` fire-and-forget，轮询循环全部挂在 Node 进程内存。
- 同类内存态任务：`services/video-prompts.ts:22`（`tasks: Map`）、`services/extraction.ts:20`（`tasks: Map`）、`ffmpeg-merge.ts:81`（`doMerge`）。
- 现有兜底：`index.ts:89` 启动时把 `status='processing'` 的任务批量标为 failed——只「止损」不「恢复」。

**优化建议**
1. 将任务执行改为「DB 状态 + 可恢复 worker」：任务表新增 `attempts/worker_token`，worker 启动时认领 `processing` 任务继续轮询/下载（视频任务尤其值得——上游任务 ID 已返回，重启后可直接续轮询）。
2. 批量提示词/提取任务状态落 DB（或表驱动），前端轮询 DB 而非内存。
3. 若短期不引入队列，至少把 `videoMerges.status='processing'` 也纳入启动清理，避免成片列表出现永久「拼接中」。

### 1.2 批量生成无并发限制
- `generation.ts` 对并发完全开放：一次「批量生成 20 个镜头视频」会同时发出 20 个创建请求 + 20 个 10s 间隔轮询循环。
- `request-guard.ts` 只保护 `analyze-source` / `analyze-episodes` 两个 Agent 端点，不保护生成任务。

**优化建议**
1. 引入进程内信号量（如 `p-limit`）按厂商/服务类型限制并发（视频建议 2–4、图片 4–8），超限任务排队而非失败。
2. 轮询改为单飞：同任务只允许一个轮询循环，避免重复提交后双轮询。
3. 前端批量按钮做并发上限提示与进度汇总。

### 1.3 无重试、无超时兜底
- `processTask` 中 `fetch` 失败直接 `failTask`；`handleVideoComplete` 的 `downloadFile` 无重试。
- `downloadFile`（`utils/storage.ts:16`）的 `fetch` 无超时、无 `Content-Length` 上限，且 `await resp.arrayBuffer()` 全量进内存——百 MB 视频直接吃满内存。

**优化建议**
1. 请求与轮询统一封装 `withRetry(fn, { retries: 2, backoff })`，仅对网络层/5xx 重试，4xx 与厂商明确失败（如内容审核拦截）不重试。
2. `downloadFile` 改流式写盘：`for await (chunk of resp.body)` 写临时文件；校验 `content-length` 上限（如 500MB）与下载超时（如 10min）。
3. 视频任务增加全局时间上限（如 30–45min）并落 `errorMsg` 说明。

---

## 2. 数据访问层（P1）

### 2.1 全表扫描 + 内存过滤（核心性能隐患）
以下均是无 where 全表 select 后在 JS 内存过滤，镜头/项目数量上来后明显劣化：

| 位置 | 问题 |
|---|---|
| `routes/dramas.ts:259` `GET /dramas` | 全表 + 每行 3 次子查询（N+1）+ 内存分页 |
| `routes/tasks.ts:156` `GET /tasks` | `db.select().from(sysTask)` 全表，内存过滤 |
| `routes/episodes.ts:102/114/126` | `db.select().from(characters/scenes/props)` **全表**（无 where），再内存过滤 |
| `routes/episodes.ts:177` 分镜列表 | `db.select().from(storyboardCharacters/Props)` 全表所有集的链接表 |
| `routes/episodes.ts:221` generation-tasks | 全表 `sysTask` + 内存过滤 |
| `routes/dramas.ts:630` stats | 全表 |
| `routes/dramas.ts:641` 详情 | 4 张表全量返回（含 `content` 大字段） |

**优化建议**
1. 所有过滤下推 SQL：`where(and(eq(...), inArray(...)))`，分页用 `limit/offset`。
2. 列表页计数用 `COUNT` 聚合；剧集/角色/场景计数用 `LEFT JOIN + COUNT GROUP BY` 一次查询代替 N+1。
3. 详情接口返回轻量字段（列表项不含 `content/script_content`），或拆「概要」与「详情」两个接口。

### 2.2 配置查询无缓存
- `services/ai.ts` `getActiveConfig` / `getConfigById` 每次 DB 查询。Agent 每步（`buildModel`）都会重查，长剧本改写动辄十几次 DB 往返。
- 已有「同配置只打一次日志」的 Map 记忆，但 DB 查询本身未缓存。

**优化建议**：按 `serviceType` 与 `configId` 加 TTL 缓存（如 10s）+ 配置变更时失效；或复用 `lastLoggedActiveConfigKey` 的返回结果做 `{ config, checkedAt }` 缓存。

### 2.3 批量写循环 + 无事务
- `routes/dramas.ts:698/715` `PUT /characters`、`PUT /episodes` 逐条 insert/update 循环。
- `routes/storyboards.ts:107/129` `syncStoryboardCharacters/Props` 逐条 insert 循环（reference-assets 已用事务，这两处没有）。

**优化建议**：批量写包进 `db.transaction`，逐条改为 `values([...])` 批量 insert / `Promise.all` 并行 update（连接池足够）。

### 2.4 并发建集竞态
- `routes/episodes.ts:25-28` 读现有集号取 `max+1`，无锁。两个请求并发建集会得到相同 `episode_number`。
- `PUT /dramas/:id/episodes` 也无保护。

**优化建议**：集号在事务内 `SELECT ... FOR UPDATE` 计算，或建 `(drama_id, episode_number)` 唯一索引 + 冲突重试。

---

## 3. 媒体与上传（P1）

### 3.1 参考视频/音频 dataURL 内联
- `generation.ts:549` `resolveReferenceMediaUrl` 无 `PUBLIC_BASE_URL` 时把本地视频/音频整个转 base64 塞进请求体（50MB → ~67MB 字符串），体量大且上游可能拒绝。
- 上传大小上限（视频 50MB/音频 20MB）仅作用于上传，未覆盖此内联路径。

**优化建议**
1. 容器/部署侧强制配置 `PUBLIC_BASE_URL`（已建议）并文档化，避免走内联分支。
2. 内联前按类型设硬上限（如视频 ≤15MB），超出直接报错提示改用公网地址。
3. 对 dataURL 请求体做 gzip/压缩传输（若厂商支持）。

### 3.2 图片上传无格式/大小校验
- `routes/upload.ts:10` `/upload/image`：无 MIME 白名单、无大小上限（视频/音频都有，唯独图片没有）；`file.arrayBuffer()` 全量进内存。

**优化建议**：图片加类型白名单（png/jpg/jpeg/webp/gif）+ 大小上限（如 10MB）；流式写盘或先校验头部魔数。

### 3.3 无存储配额与清理
- `data/static/{images,videos,merged,temp,uploads}` 无限增长：删除剧集/镜头不删文件（软删），`temp/*.txt` 异常中断残留，无任何 GC。

**优化建议**
1. 定期清理 `temp/`（TTL 1 天）。
2. 提供「孤儿文件清理」脚本：扫描 `data/static` 与 DB `local_path` 对比，删除未被引用的文件（按时间兜底）。
3. 可配置总配额（如 50GB），超出提示清理。

---

## 4. FFmpeg 合成（P1）

### 4.1 全量重编码，无一致性预检
- `services/ffmpeg-merge.ts:109-128`：每个镜头都 `-c:v libx264 -preset medium -crf 23` 重编码，一集 10–20 分钟素材转码很慢。
- 未用 `ffprobe` 预检各镜头 分辨率/帧率/编码/像素格式 是否一致——不一致时 concat 产物会出现音画不同步或卡帧（已有 `-fflags +genpts` 缓解）。

**优化建议**
1. 拼接前 `ffprobe` 汇总各镜头参数：若编码一致（如全是 h264+aac）且分辨率/帧率一致 → 用 `-c copy` 快速拼接（秒级）；不一致才 fallback 重编码。
2. 重编码时 `-preset veryfast` 起步，必要时按需转码（只转不一致的镜头）。
3. 加合并超时（如 30min）与并发上限（1–2 路）。

### 4.2 失败清理
- `doMerge` 异常时 list 文件与半成品输出不清理（`merge.ts` catch 只更新状态）。

**优化建议**：`finally` 中清理 `temp/*.txt` 与未完成的输出文件。

---

## 5. Agent 与同步接口（P1）

- `services/video-prompts.ts:69` 批量视频提示词**串行**执行（每分镜一次 LLM 调用，20 个分镜 = 20 次串行，耗时长）；失败不重试；状态内存态。
- `extraction.ts` 同构。
- `routes/dramas.ts:389/459` `analyze-source` / `analyze-episodes` 同步等待 LLM 完成，HTTP 连接长期挂起（已有 guard 防并发，但无超时）。

**优化建议**
1. 批量提示词适度并行（如 `p-limit(3)`）并按分镜失败重试 1 次。
2. Agent 调用包统一 `AbortSignal.timeout`（如 5min）与失败重试。
3. 长剧本改写（script_rewriter）增加「分批处理」能力或输出长度分段校验，避免单次截断。

---

## 6. 安全与部署（P2）

| 项 | 现状 | 建议 |
|---|---|---|
| CORS | `index.ts:36` 硬编码 `localhost:3013/5679` | 读环境变量白名单 |
| 认证 | 全 API 无鉴权 | 至少提供简单 token 中间件；公网部署必须反向代理 + 基础认证 |
| API Key | `ai_service_configs.api_key` 明文入库 | 可选 AES 加密 / 脱敏展示 |
| 上传鉴权 | `/upload/*` 无鉴权 | 跟随整体鉴权方案 |

---

## 7. 可观测性（P2）

- `utils/task-logger.js` 日志输出详尽，但无结构化采集与指标。
- 建议：统计任务类型成功率 / 平均耗时 / 失败原因 TopN；为批量生成增加「当前批次进度」DB 落点；关键路径打点（LLM 调用耗时、视频生成耗时、下载耗时）。

---

## 8. 建议实施路线图

**第一批（稳定优先，1–2 天）**
1. 生成任务启动恢复（认领 `processing` 视频任务继续轮询）+ merge 状态启动清理
2. 下载改流式 + 大小/超时上限；图片上传格式/大小校验
3. 请求/轮询/下载统一重试封装
4. 视频/图片批量并发信号量

**第二批（性能，2–3 天）**
5. 列表/任务聚合/分镜列表查询下推 SQL，消灭全表内存过滤
6. `ai.ts` 配置 TTL 缓存
7. 批量写事务化；集号唯一索引
8. FFmpeg 拼接：一致性预检 + `-c copy` 快路径 + 超时

**第三批（健壮性/上线，按需）**
9. 存储清理脚本与配额
10. CORS/鉴权/密钥加密
11. 指标埋点与任务成功率的可视化
