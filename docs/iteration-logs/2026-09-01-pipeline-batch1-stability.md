# 第一批优化实施记录 — 稳定性加固

> 日期：2026-09-01
> 依据：`docs/iteration-logs/2026-09-01-pipeline-optimization-audit.md` 第一批（稳定优先）
> 目标：任务重启恢复、下载加固、上传校验、统一重试、并发控制

---

## 1. 改动清单

### 新增文件

| 文件 | 作用 |
|---|---|
| `backend/src/utils/retry.ts` | 统一重试：`withRetry` + `isRetryableError`。AbortError/TypeError/429/5xx 可重试，4xx 业务错误不重试；指数退避（`baseDelayMs * 2^n`，上限 `maxDelayMs`），每次重试带日志 |
| `backend/src/utils/concurrency.ts` | 进程内信号量 `Semaphore` + 预置两个全局实例：`videoSlot`（默认 2）、`imageSlot`（默认 4），可用环境变量覆盖 |
| `backend/src/services/recovery.ts` | 启动恢复服务：清理中断的 `video_merges`、认领恢复 `sys_task` 视频任务、标记失效图片任务 |

### 修改文件

| 文件 | 改动 |
|---|---|
| `backend/src/services/generation.ts` | ① `processTask` 重构：进入时 `acquire` 信号量、`finally` 释放，任务生命周期占槽位；② 有 `taskId` 时走「续轮询」分支（启动恢复，避免重复提交扣费）；③ 创建请求与轮询请求接入 `withRetry`；④ 图片下载上限 50MB、视频下载上限 2GB/10min 超时；⑤ 新增 `resumeTaskById` / `findConfigForTask`（优先精确匹配原 provider+model 配置，回退当前启用配置） |
| `backend/src/utils/storage.ts` | `downloadFile` 改为流式写盘（`for await` 边下边写），`Content-Length` 预检 + 实时字节计数双保险，超限即中止并删除半成品；单次尝试超时可配；网络/5xx/超时自动重试（重试重新生成新文件名） |
| `backend/src/routes/upload.ts` | `/upload/image` 增加格式白名单（png/jpg/jpeg/webp/gif）与大小上限（10MB），先用 `file.size` 预检再读内存 |
| `backend/src/index.ts` | 启动清理逻辑替换为 `recoverInterruptedTasks()` |

---

## 2. 详细日志行为

统一使用现有 `task-logger` 格式 `[scope] action | k=v`，新增日志点：

| 日志 | 触发场景 | 示例 |
|---|---|---|
| `[Recovery] START interrupted-tasks` | 服务启动 | 每次启动 |
| `[Recovery] DONE interrupted-tasks \| resumed=.. failed=.. elapsedMs=..` | 恢复完成 | `resumed=2 failed=1 elapsedMs=88` |
| `[Recovery] merges-cleaned \| count=N` | 发现残留 processing 拼接任务 | — |
| `[Recovery] resume-failed \| id=.. error=..` | 单个任务恢复失败 | — |
| `[Concurrency] VideoSlot-acquire \| id=.. active=.. waiting=.. limit=..` | 任务拿到并发槽位 | — |
| `[Concurrency] VideoSlot-queue-wait \| id=.. waiting=..` | 任务排队等待槽位 | — |
| `[Concurrency] VideoSlot-release \| id=.. active=.. waiting=..` | 任务结束释放槽位 | — |
| `[VideoTask]/[ImageTask] create-request-retry \| attempt=.. maxAttempts=.. retryInMs=.. error=..` | 创建请求网络/5xx/429/超时重试 | — |
| `[VideoTask]/[ImageTask] poll-request-retry \| attempt=..` | 单次轮询请求重试 1 次 | — |
| `[Storage] download-start \| subDir=.. url=.. maxBytes=.. timeoutMs=..` | 开始下载 | — |
| `[Storage] download-done \| subDir=.. bytes=..` | 下载完成 | — |
| `[Storage] download-retry \| attempt=.. retryInMs=.. error=..` | 下载失败自动重试 | — |
| `[VideoTask] resume \| id=.. hasTaskId=.. provider=..` | 恢复单个视频任务 | — |
| `[SysTask] resume-config-matched \| id=.. configId=.. provider=.. model=..` | 恢复任务精确命中原配置 | — |

---

## 3. 配置项（环境变量）

| 变量 | 默认 | 说明 |
|---|---|---|
| `VIDEO_CONCURRENCY` | 2 | 视频生成同时运行上限（含恢复续跑） |
| `IMAGE_CONCURRENCY` | 4 | 图片生成同时运行上限 |

超限的任务不失败，而是排队等待（`[Concurrency] VideoSlot-queue-wait`），前一个任务完成/失败后自动接续。

---

## 4. 行为变化说明

1. **重启不再丢视频任务**：`sys_task.status=processing` 的视频任务启动时自动认领——有上游 `taskId` 的直接续轮询（上游可能已完成，可正常下载，不重复扣费）；无 `taskId` 的（创建阶段中断）重新提交。
2. **图片任务重启仍标记失败**（轮询窗口仅 10 分钟，恢复价值低），前端提示重试。
3. **拼接任务重启标记失败**（本地 ffmpeg 操作无上游任务可续）。
4. **下载不再整文件进内存**：视频流式写盘，2GB 上限；超限/超时/网络中断自动清理半成品并重试。
5. **批量生成有节奏感**：同时只跑 N 个任务，其余排队，避免打爆厂商 API 触发 429。

## 5. 验证结果

- `tsc --noEmit` 编译通过（0 错误）。
- 后端容器重启后恢复日志正常输出：`[Recovery] DONE interrupted-tasks | resumed=0 failed=0 elapsedMs=88`（当前无残留任务）。
- 健康检查 `/api/v1/health` 200。

## 6. 遗留 / 第二批衔接

- 恢复逻辑只覆盖视频任务；提取/视频提示词批量仍为内存态（重启丢失），未纳入本次范围。
- `serveStatic: root path '/workspace/frontend/dist' is not found` 为前端未构建的既有提示，不影响 API。
- 第二批（性能）建议继续：查询下推 SQL、`ai.ts` 配置 TTL 缓存、批量写事务、FFmpeg 一致性预检。
