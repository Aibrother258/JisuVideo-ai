# HB-20260831-04：参考素材持久化、视频区职责分层与 H3 新鲜度

## 1. 迭代概况

- 日期：2026-08-31
- 状态：已完成代码实现与开发栈验证
- 目标：修复前两次迭代的状态一致性不足，明确“分镜正式绑定素材”和“视频额外投产素材”的职责边界。

## 2. 本次完成

1. 新增 `storyboard_reference_assets` 表，持久化分镜参考素材选择、类型、角色、顺序和 URL。
2. 新增接口：
   - `GET /api/v1/storyboards/:id/reference-assets`
   - `PUT /api/v1/storyboards/:id/reference-assets`
3. 视频区改为两个明确区域：
   - “已继承的分镜素材”：角色、场景、道具只读展示，并提供“管理分镜绑定”入口。
   - “额外投产参考”：本地上传或资产库选择的图片、视频、音频，仅用于视频任务。
4. 视频任务请求保存 `reference_snapshot`，包含提交时实际使用的图片、视频、音频数组和时间。
5. H3 提示词增加来源元数据：`minimax_h3_source_hash`、`minimax_h3_generated_at`。
6. 修改分镜描述、氛围、时长、中文版视频提示词或参考素材后，清空 H3 来源元数据，使前端提示“可能已过期”。
7. 修复分镜 Agent 参数归一化带来的 TypeScript 错误，后端 `npm run typecheck` 已恢复通过。
8. 新增结构回归测试，覆盖数据库关系、接口、H3 元数据和视频区职责分层。

## 3. 设计结论

正式的角色、场景、道具绑定在分镜拆分阶段维护；视频生成区不再重复编辑这些正式关系，只显示继承结果。视频区保留额外参考素材入口，以支持临时构图参考、参考视频和参考音频等投产场景。

## 4. 验证证据

- 新增回归测试：8 passed, 0 failed。
- 后端容器内 `npm run typecheck`：通过。
- 前端容器内 `npm run build`：通过，Nuxt client/server build complete。
- `GET /api/v1/storyboards/1/reference-assets`：HTTP 200。
- `PUT /api/v1/storyboards/1/reference-assets`：HTTP 200，实际写入 2 条图片参考记录。
- 开发容器状态：backend healthy，frontend running，MySQL healthy。

## 5. 未完成/后续

- H3 结构校验器尚未实现，目前完成的是来源指纹与过期标记基础。
- 任务快照已随 `sys_task.params` 保存提交参数，但尚未拆成独立的任务快照表。
- 完整历史测试集仍有旧页面路径和过期断言，需要单独清理。
- 生产镜像 rebuild 和生产 Compose 切换未在本次开发栈验证后再次执行；开发栈验证通过。

## 6. 回滚

保留新增数据表和字段不会影响旧流程。回滚界面可移除视频区分层文案和数据库参考素材读写，旧的浏览器 localStorage 选择仍可作为回退。
