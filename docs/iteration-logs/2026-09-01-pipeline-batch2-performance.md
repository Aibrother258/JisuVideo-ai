# 第二批优化实施记录：性能（查询下推 / 配置缓存 / 批量写 / FFmpeg）

> 日期：2026-09-01
> 分支：`perf/pipeline-performance-batch2`
> 依据：`docs/iteration-logs/2026-09-01-pipeline-optimization-audit.md` 第 5–8 项
> 覆盖：`dramas.ts`、`episodes.ts`、`tasks.ts`、`storyboards.ts`、`aiConfigs.ts`、`ai.ts`、`ffmpeg-merge.ts`、前端 `index.vue`

## 1. 查询下推 SQL（审计 2.1）

| 接口 | 改动前 | 改动后 |
|---|---|---|
| `GET /dramas` | 全表 + 每行 3 次子查询（N+1）+ 内存分页 | 过滤/分页/`COUNT` 下推；聚合计数 `GROUP BY` 一次完成；剧集只取轻量字段（id/集号） |
| `GET /dramas/stats` | 全表内存 reduce | `COUNT ... GROUP BY status` |
| `GET /tasks` | `sys_task` 全表 + 内存过滤 | `type/storyboard_id/drama_id` 条件 `and` 下推 + `created_at desc` |
| `GET /episodes/:id/characters|scenes|props` | 关联表后全表扫描再过滤 | `inArray(id, ...)` + `isNull(deleted_at)` 下推 |
| `GET /episodes/:id/storyboards` | `storyboard_characters/props` 全表 + `characters/props` 全表 | 按分镜 id 集合 `inArray` 下推 |
| `GET /episodes/:id/generation-tasks` | `sys_task` 按 drama 全表 + 内存四条件过滤 | `or(...)` 关联键条件下推 + `created_at desc`；merges 排序/`limit(20)` 下推 |

前端 `index.vue` 列表卡片由 `d.characters/scenes/episodes?.length` 改用聚合字段 `character_count / scene_count / total_episodes`；`d.episodes` 保留轻量数组（id + 集号）供「第几集」计算。

## 2. ai.ts 配置 TTL 缓存（审计 2.2）

- 新增 `configCache`（10s TTL）：`getActiveConfig` / `getActiveConfigId` / `getConfigById` 全部走缓存；
- 未命中且结果为 null（无活动配置）不缓存，配置变化后立即可见；
- 配置写入口（`aiConfigs.ts` 新增/编辑/删除）调用 `invalidateAIConfigCache()` 清空；
- 收益：长剧本改写/批量生成的 Agent 多步循环从「每次 DB 往返」降到「10s 内 1 次」。

## 3. 批量写事务化 + 集号竞态（审计 2.3 / 2.4）

- `PUT /dramas/:id/characters`、`PUT /dramas/:id/episodes`：包 `db.transaction`，新增项改为 `values([...])` 批量 insert；
- `storyboards.ts` `syncStoryboardCharacters/Props`：delete+insert 包事务、批量 insert（与 reference-assets 保持一致）；
- `POST /episodes`（建集）：`(drama_id, episode_number)` 唯一索引已在，并发冲突 `ER_DUP_ENTRY` 时重查集号重试（最多 3 次），消除「并发建集号相同」竞态。

## 4. FFmpeg 拼接优化（审计 4.1 / 4.2）

- 拼接前 `ffprobe` 逐镜头探测编码/分辨率/帧率/音频；
- 全部镜头 `h264` + 分辨率/帧率一致 + 音频 `aac`（或无音频）→ **`-c copy` 流复制**（一集从 10–20 分钟降到秒级）；
- 任一不一致 → 全量重编码兜底（`-preset veryfast`，原 medium）；
- 单次拼接 **30 分钟超时**（`setTimeout` + timeout 事件，超时 kill 进程）；
- **失败清理**：`finally` 删除 concat 列表与半成品输出，`temp/`、`merged/` 不再堆积；
- 探测/模式选择全程日志：`[MergeTask] probe | consistent mode=copy|reencode codec resolution`。

## 验证状态

| 项 | 状态 |
|---|---|
| 后端 `npx tsc --noEmit` | ✅ 0 错误 |
| 容器重启 + Recovery | ✅ `[Recovery] DONE interrupted-tasks | claimed=0 failed=0` |
| `GET /dramas`（空库） | ✅ `{items:[], pagination:{total:0}}`，含新字段 |
| `GET /dramas/stats` | ✅ `{total:0, by_status:[]}` |
| `GET /tasks?type=video` | ✅ 200 |
| `/api/v1/health` | ✅ 200 |
| FFmpeg `-c copy` 真实拼接 | ❌ 需有生成视频数据的库验证（编码一致时应走 copy 秒级完成） |
| 前端构建 | ❌ 仅改单行模板插值，未跑完整 build |

## 遗留（第三批，按需）

- 存储清理脚本与配额（`temp/` TTL、孤儿文件 GC）
- CORS 环境变量化 + 鉴权 + API Key 加密
- 指标埋点与任务成功率可视化
- 视频提示词批量/资产提取内存态任务 DB 化
- 参考视频/音频 dataURL 内联路径加固
