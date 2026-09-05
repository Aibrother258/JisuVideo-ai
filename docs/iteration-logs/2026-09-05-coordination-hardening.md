# HB-20260905-01：协调事实源与看板治理

关联 Issue：[#67](https://github.com/Aibrother258/JisuVideo-ai/issues/67)。
实施账号：Aibrother258；基线：03d0b598c0911b39073130d13ca396ca4ba6f30e。

## 问题与变更

协调需要从实时 Issue/PR/提交取得依据。原任务同时把阶段和状态称为看板列，并把已关闭的 #61/#62 写成实施中，需在执行时纠正。

协作计划 §10 新增事实源优先级、可核实证据、状态映射、看板验收与权限失败处理；附录登记四项协调边界。保留 §1–§9 和原门禁，不涉及应用、数据库、Agent、CI。

## 验证与尚未完成

- PR #63 已合并，基线为 `03d0b59`；#61/#62 已关闭。
- 主账号已是 #67 Assignee；认领留言与热点锁已发布。
- Projects #1（JisuVideo-ai Production Roadmap，PVT_kwHODc-qWM4BgT-r）基础配置完成：
  - 4 个字段：Status（Backlog/Ready/In Progress/Review/Done）、Stage（S0-S4）、Blocked（No/Yes）、Disposition（Active/Completed/Cancelled/Duplicate）。
  - 2 个视图：Task status（BOARD_LAYOUT，已按 Status 分列）、Stage S0-S4（TABLE_LAYOUT）。
  - 3 个 Issue：#61（S0/Done）、#62（S0/Done）、#67（S0/In Progress/Blocked=Yes）。
- 6 个 enabled 内置 workflow 已核验（编辑模式查看）：
  | Workflow | When | Do | 方向 |
  |---|---|---|---|
  | Auto-add sub-issues to project | 项有 sub-issues | 添加 sub-issues 到项目 | 外→内 |
  | Auto-close issue | Issue 被关闭 | Status: Done | 外→内 |
  | Item added to project | 项被添加到项目 | Status: Backlog | 外→内 |
  | Item closed | Issue/PR 关闭 | Status: Done | 外→内 |
  | Pull request linked to issue | PR 关联到 issue | Status: In Progress | 外→内 |
  | Pull request merged | PR 合并 | Status: Done | 外→内 |
  全部为"外部事件 → 更新看板字段"的安全方向，无反向绕过 Issue 验收的 workflow。5 个 disabled workflow 配置已读取，不影响当前。
- 任意 status 标签自动同步未走自动化：owner 于 2026-09-05T20:37+08:00 裁决本期接受"主账号每次变更时同步并回读"的人工方式（#67 留言 issuecomment-5551869432）；后续若真实协调缺陷出现再拆最小自动化任务。
- Fork 访问验证已通过：csx12588（2026-09-05T12:42Z）、balltoo（2026-09-05T12:43Z）分别留言"能看到 project#1"；无需变更 Project 协作者。
- #67 状态已同步：看板 Blocked=Yes→No、status 标签 blocked→in-progress。
- 文档 diff 与链接由本次提交检查；应用测试不因文档变更重跑，PR CI 结果另行核验。

## 接下来的执行与回滚

- 本期接受"人工同步"方案（owner 裁决 issuecomment-5551869432）；若真实协调缺陷出现，另立最小自动化任务，明确权限、事件、幂等与回写方向。
- PR #70 已撤 Draft，HEAD `b691485`；进入 Hermes → Bugbot → owner 评审链。
- 使用 Refs #67，不自动关闭 Issue；owner 合入后再手动关闭 #67。
- HB 台账 plan-log / run-flow 未追加 HB-20260905-01：按"仅记 completed"原则，待 PR #70 合入后一并补登。

如文档需要回退，通过普通 PR 撤销本次新增段落；已创建的外部看板不得静默删除。无运行时或数据迁移需要回滚。
