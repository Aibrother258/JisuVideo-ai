# 第三批实施记录：运维加固（存储清理 / CORS 配置化 / 任务统计 / dataURL 加固）

> 日期：2026-09-01
> 分支：`perf/pipeline-performance-batch3`
> 依据：第二批日志遗留清单（第三批，按需）
> 覆盖：`utils/cleanup.ts`（新增）、`index.ts`、`routes/tasks.ts`、`utils/storage.ts`、`services/generation.ts`、`docker-compose.yml`、`docker-compose.dev.yml`

## 1. 存储清理 / GC（防磁盘无限增长）

新增 `utils/cleanup.ts`，`index.ts` 启动时调用 `startStorageCleanup()`：

- **temp/ TTL**：删除超过 `STORAGE_CLEANUP_TEMP_TTL_HOURS`（默认 24h）的临时文件（ffmpeg concat 列表等）
- **孤儿文件 GC**：每 `STORAGE_CLEANUP_INTERVAL_HOURS`（默认 24h）扫描 `images/ videos/ uploads/ merged/`，
  删除「未被 DB 引用」且修改时间超过 `STORAGE_CLEANUP_ORPHAN_TTL_DAYS`（默认 30 天）的文件
- **引用集**：聚合 10 张表的 URL/路径字段（assets/sys_task/video_merges/episodes/dramas/characters/scenes/props/storyboards/storyboard_reference_assets），
  用正则提取 `static/...` 相对路径，杜绝误删在用数据
- **派生文件**：`*_thumb.webp` / `*_poster.jpg` 由主文件派生——主文件仍在则保留；主文件没了才轮到回收
- 环境变量：`STORAGE_CLEANUP_DRY_RUN=true` 仅报告不删除（开发/演练用）

验证（容器内实测）：
- 40 天前孤儿文件 → `orphan_removed: 1` ✅
- 40 天前但 DB 有 assets 引用的文件 → 保留 ✅
- 启动日志 `[Cleanup] DONE run | mode=delete ... scanned=N`

## 2. CORS 环境变量化

`index.ts` 的 origin 白名单由硬编码数组改为读 `CORS_ORIGIN`（逗号分隔，默认 `http://localhost:3013,http://localhost:5679`）。
生产 `docker-compose.yml` 与 dev compose 增加注释示例。

验证：非白名单 Origin → 无 `access-control-allow-origin`；白名单 Origin → 正确回显 ✅

## 3. `/tasks/stats` 成功率统计

`routes/tasks.ts` 新增只读端点（注册在 `/:id` 之前避免被吞）：

- 一次 `GROUP BY type, provider, status` 聚合
- 返回 `overall / by_type / by_provider / by_type_provider`，各含 `total / completed / failed / processing / success_rate`
- 为后续成功率可视化提供数据源

验证：空库返回 `{overall:{total:0,...}, by_type:[], ...}` 200 ✅

## 4. 参考媒体 dataURL 兜底加固

- `utils/storage.ts` 新增 `assertSafeStaticPath`：只允许 `static/<子目录>/<文件>`，拒绝 `..`/`.`/绝对路径/盘符/越界；
  `readImageAsDataUrl` / `readMediaAsDataUrl` / `readImageAsCompressedDataUrl` 三入口统一校验
- `services/generation.ts` `resolveReferenceMediaUrl`：未配置 `PUBLIC_BASE_URL` 走 dataURL 内联时增加**大小上限**
  （视频 15MB / 音频 8MB，超过抛错提示配置公网地址），避免大文件膨胀 ~1.37 倍塞爆请求体

## 验证状态

| 项 | 状态 |
|---|---|
| 后端 `tsc --noEmit` | ✅ 0 错误 |
| 启动日志 Cleanup 首次执行 | ✅ `[Cleanup] DONE run` |
| GC 孤儿删除 / 引用保留 | ✅ 实测通过 |
| `/tasks/stats` | ✅ 200 空库结构正确 |
| CORS 白名单 | ✅ 白名单外拒绝 / 内放行 |
| dataURL 大小上限 | ⚠️ 需有 >15MB 参考视频的库实测（逻辑简单，路径校验已覆盖所有读取入口） |

## 未做（第四批候选，附理由）

- **内存态任务 DB 化**（extraction / video-prompts）：需扩展 `sys_task.type` 枚举或新增表（`sys_task` 无 `episode_id` 列）+ 前端轮询对接，
  属 schema 变更且影响面广，建议独立批次评审。当前重启丢失仅在「任务运行中重启」窗口发生，影响可控。
- **API Key 加密**：改动面广（所有 provider 请求解密 + 存量明文迁移 + 前端回显策略），风险中高，需单独设计密钥管理与迁移方案。
