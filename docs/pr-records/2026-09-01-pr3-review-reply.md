已按反馈修复全部 6 项，提交 `7e7cf53`，`tsc --noEmit` 通过、容器重启后恢复流程验证正常（`[Recovery] DONE interrupted-tasks | claimed=0 failed=0`）。

**1. 严重 - 生成请求重试重复扣费**
- 创建请求移除 `withRetry`，恢复为单次 `fetch`（仅保留 10 分钟超时兜底）；4xx/5xx/网络错误一律直接 `failTask`，不自动重试。
- 重启恢复同样收紧：`resumeTaskById` 与 `recovery.ts` 对**无 `taskId`** 的视频任务不再自动重提，改为标记 failed 并提示「为避免重复扣费请手动重新生成」。有 `taskId` 的任务只续轮询（只读查询，无扣费风险）。
- 权衡说明：付费非幂等 POST 不自动重试，网络抖动导致的失败由前端「重试」入口手动发起。

**2. 严重 - 视频任务无全局超时**
- `POLL_PROFILES.video` 增加 `maxDurationMs: 45min`（与单次轮询 10min 超时配合，极端累积从数十小时收敛到 45 分钟上限），超时信息改为动态分钟数。
- 修复「completed 后下载/回写失败会回到轮询循环」：循环内加 `completedHandling` 标志，completed 分支的处理失败直接抛出 → `processTask` 捕获标记失败，绝不重回轮询。

**3. 较高 - 并发队列删除竞态**
- `processTask` 在 `acquire` 拿到槽位后**重新查询任务**（`fresh`）：任务已被物理删除（`DELETE /tasks/:id`）或状态非 `processing` 时直接放弃，不再向厂商提交、不回写分镜；日志 `task-not-active-after-queue | status=deleted`。
- 后续 `runTask`/`pollTask` 统一使用 `fresh` 记录。

**4. 较高 - 重启恢复无原子认领**
- 用 MySQL 命名锁 `GET_LOCK('hb-startup-recovery', 0)` 在**同一连接**内串行化恢复（锁内执行全部恢复逻辑，`finally` 释放）：多实例/滚动重启时同一时刻只有一个恢复者，避免重复认领。
- 选择命名锁而非 DB 租约列：无需 `sys_task` 表结构变更。
- `DONE` 日志语义已调整为 `claimed=`（已认领并在后台续跑），注释说明轮询异步完成。

**5. 中等 - 恢复时无持久化配置 ID**
- `createTask` 将本次实际使用的 `configId` 写入 `sys_task.params`（JSON 列，无 schema 变更）。
- `findConfigForTask` 优先 `getConfigById(savedConfigId)` 精确恢复；旧任务（无 config_id）回退 provider+model 匹配 → 当前启用配置，日志分别记录 `resume-config-by-id` / `resume-config-by-id-missing`。

**6. 次要 - 视频/音频上传先读内存后查大小**
- `saveMediaUpload` 在 `arrayBuffer()` 之前先按 `file.size` 预检，超限直接 400；保留落盘前 `byteLength` 双保险（防 `file.size` 伪造）。

补充说明：第 1 项与第 4 项的取舍（创建请求不重试、命名锁）如评审有不同意见可再讨论；其余按评审建议执行。请复核。
