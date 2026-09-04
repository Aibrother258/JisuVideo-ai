# UI 工作线状态排查与术语索引（防误判记录）

> 日期：2026-09-02
> 触发原因：会话中 AI 依据"preproduction/策划包导入 UI 未开发"断言"前端 UI 尚未推进"，与用户在分支 `feat/ui-p1-token-spec` 上看到的实际 UI 治理推进矛盾。
> 结论先行：**结论本身不算错，但检索口径错位导致对"UI 开发到哪一步"的回答误导用户。** 本文件固化排查结果，作为后续涉及"UI / 进度"问题时的术语索引与单一事实源之一。

## 1. 现象

- 用户问"UI 方面的开发到哪一步了"。
- AI 检索 `frontend/**` 中 `preproduction | 策划包 | 导入策划` = 0 匹配 → 答"UI 一行未开发"。
- 用户贴出分支任务清单截图，显示 P1 token 收敛、设计规范、可访问性等任务处于推进中 → 判断冲突。
- 复核后确认：master 已合入 UI 治理 PR（#13 设置页导航、#14 三态治理）；`feat/ui-p1-token-spec` 分支有未提交的 studio.css token 收敛与 episode.vue 三态补漏改动。

## 2. 根因（按贡献度排序）

1. **工作区存在两条独立时间线，且都含"UI"二字，指代对象不同：**
   - 线 A（仓库根目录方案文档）：`f:/JisuVideo/*.md`（多视频类型扩展 v2.2、与 shuohao-skills 分步实施 v1.2 等）是"待评审、未实施"的方案稿；其中规划的 UI = **策划包导入 / 多视频类型新功能界面**。该线代码为 0，方案也注明"尚未进入生产开发"。
   - 线 B（仓库内代码工作线）：`JisuVideo-ai/docs/ui-optimization-plan.md` 驱动的 **前端 UI 治理**（设计体系 / 组件化 / 三态 / 暗色 / 响应式 / 可访问性），P0-F（设置页两级导航）、C1/C2（骨架屏 + 三态统一）已合入 master；P1（A1 Token 收敛、A2 规范文档）进行中。
2. **检索口径错位**：问题"UI 开发到哪一步"应覆盖线 B（git 分支、合入历史、handoff 文档），却只按线 A 的关键词（preproduction/策划包）检索；未查看 `git branch`、`docs/ui-optimization-plan.md`、`docs/handoff-ui-three-states-codex.md`、`docs/iteration-logs/`。
3. **单一事实源缺失**：在途工作分散在多个分支与文档（`docs/*`、`feat/ui-*`、`handoff-*`、`iteration-logs/*`），无一份"当前所有工作线状态"的总览，导致从任一入口出发都只能看到局部。
4. 方案文档与代码时间线天然不同步：根目录文档描述的是"待实施"方案，仓库内开发线持续合入 master。

## 3. 术语索引（后续回答"UI / 进度"问题必须对照）

| 表述 | 指代 | 代码状态（2026-09-02） |
| --- | --- | --- |
| 策划包导入 UI / 导入前端 | 线 A：上传→识别→问题→影响摘要→确认导入界面（见 `JisuVideo-ai与shuohao-skills分步实施方案.md` §5.4/§10.2） | **未开始**——方向保留，转「短剧上游导入」独立立项待排期（2026-09-04 扩展线取消后脱钩） |
| 多视频类型扩展前端 | 线 A：创建向导/类型目录/Schema 表单（原见 `docs/multi-video-type-extension-plan.md` §10.1） | **已取消**（2026-09-04 用户决策，见 `docs/ui-optimization-plan.md` 修订记录 v3.3）；冻结稿头部已标注「已取消」保留存档 |
| UI 治理 / 前端 UI 优化 | 线 B：`docs/ui-optimization-plan.md` | P0-F（PR #13）、C1/C2（PR #14）已合入 master；P1 在 `feat/ui-p1-token-spec` 进行中 |
| 设置页两级导航 | 线 B P0-F：基础/高级 树形导航 | 已合入 master（PR #13） |
| 三态治理 | 线 B C1/C2：加载/空/错误统一规范 | 已合入 master（PR #14，`5cd1690`） |
| P1 Token 收敛 | 线 B A1：硬编码色值/字号 → CSS 变量 | `feat/ui-p1-token-spec` 未提交改动中（studio.css 新增 12 个 token 并替换） |

## 4. 修复动作

- [x] 复核 master 合入历史与当前分支状态，定位真实进度（见 §3）。
- [x] 本文件作为排查记录固化，登记进 `README.md`。
- [ ] 继续推进 `feat/ui-p1-token-spec`：完成 .vue 残留同值硬编码的"值不变改引用"收敛（A1），并更新 `ui-optimization-plan.md` 修订记录。

## 5. 后续提问/检索建议

- 问"UI 到哪一步"时：先查本文件 §3 → 再查 `git branch`（尤其 `feat/ui-*`、`docs/ui-*`）→ `docs/ui-optimization-plan.md` 修订记录。
- 问"多视频类型扩展"时：**已取消**（2026-09-04 用户决策），以 `docs/ui-optimization-plan.md` 修订记录 v3.3 与冻结稿头部「已取消」标注为准；问"策划包导入"时：方向保留为「短剧上游导入」独立立项（未排期），参考根目录 shuohao-skills 结合族文档与 `JisuVideo-ai与shuohao-skills分步实施方案.md` v1.2。
- 项目级状态以 `docs/iteration-logs/README.md` 登记表为准；本文为跨线术语索引，两者互相补充。
