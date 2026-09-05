# HB-20260905-01：协调事实源与看板治理

关联 Issue：[#67](https://github.com/Aibrother258/JisuVideo-ai/issues/67)。
实施账号：Aibrother258；基线：03d0b598c0911b39073130d13ca396ca4ba6f30e。

## 问题与变更

协调需要从实时 Issue/PR/提交取得依据。原任务同时把阶段和状态称为看板列，并把已关闭的 #61/#62 写成实施中，需在执行时纠正。

协作计划 §10 新增事实源优先级、可核实证据、状态映射、看板验收与权限失败处理；附录登记四项协调边界。保留 §1–§9 和原门禁，不涉及应用、数据库、Agent、CI。

## 验证与修正记录

- PR #63 已合并，基线为 `03d0b59`；#61/#62 已关闭。
- 主账号已是 #67 Assignee；认领留言与热点锁已发布。
- Projects #1（JisuVideo-ai Production Roadmap，PVT_kwHODc-qWM4BgT-r）基础配置完成：
  - 4 个字段：Status（Backlog/Ready/In Progress/Review/Done）、Stage（S0-S4）、Blocked（No/Yes）、Disposition（Active/Completed/Cancelled/Duplicate）。
  - 2 个视图：Task status（BOARD_LAYOUT，已按 Status 分列）、Stage S0-S4（TABLE_LAYOUT）。
  - 3 个 Issue：#61（S0/Done）、#62（S0/Done）、#67（最终 S0/Done/Blocked=No）。
- 工作流用途记录如下；本轮重点回读 Auto-close issue 的触发条件并停用，其他项保持原配置：
  | Workflow | When | Do | 方向 |
  |---|---|---|---|
  | Auto-add sub-issues to project | 项有 sub-issues | 添加 sub-issues 到项目 | 外→内 |
  | Auto-close issue | 看板 Status=Done | 关闭 Issue | 内→外；本轮已停用 |
  | Item added to project | 项被添加到项目 | Status: Backlog | 外→内 |
  | Item closed | Issue/PR 关闭 | Status: Done | 外→内 |
  | Pull request linked to issue | PR 关联到 issue | Status: In Progress | 外→内 |
  | Pull request merged | PR 合并 | Status: Done | 外→内 |
  撤回原“全部外→内安全”结论：Auto-close issue 实际具有反向关闭能力。本轮在设置页停用，GraphQL 回读 enabled=false。剩余 5 个已有工作流保持启用；不以名称或最终状态代替触发过程证据。
- 任意 status 标签自动同步未走自动化：owner 于 2026-09-05T20:37+08:00 裁决本期接受"主账号每次变更时同步并回读"的人工方式（#67 留言 issuecomment-5551869432）；后续若真实协调缺陷出现再拆最小自动化任务。
- Fork 访问验证已通过：csx12588（2026-09-05T12:42Z）、balltoo（2026-09-05T12:43Z）分别留言"能看到 project#1"；无需变更 Project 协作者。
- #67 最终状态：Issue closed，看板 Done / Blocked=No；保留历史过程与最终状态的区别。
- 文档 diff 与链接由本次提交检查；应用测试不因文档变更重跑，PR CI 结果另行核验。

## 接下来的执行与回滚

- 本期接受"人工同步"方案（owner 裁决 issuecomment-5551869432）；若真实协调缺陷出现，另立最小自动化任务，明确权限、事件、幂等与回写方向。
- PR #70 已合入（merge `59bf68a`）；#67 于 2026-09-05T14:49:52Z 关闭，看板最终 Status=Done，未据此归因于某条工作流。
- HB 台账 plan-log / run-flow 在 PR #70 合入后由 HB-20260905-01 补登提交（本 PR）完成"仅记 completed"闭环：plan-log 44 条 / run-flow 39 条。

如文档需要回退，通过普通 PR 撤销本次新增段落；已创建的外部看板不得静默删除。无运行时或数据迁移需要回滚。

复核纠正时间：2026-09-05 15:34:31 UTC。Auto-close issue 已停用；可在 Project 设置重新启用，但重新启用前需 owner 明确确认其反向关闭影响。
