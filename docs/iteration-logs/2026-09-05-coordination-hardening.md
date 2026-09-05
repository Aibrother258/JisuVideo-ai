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
- 任意 status 标签自动同步尚未验证；人工同步不冒充自动同步验收通过。
- 文档 diff 与链接由本次提交检查；应用测试不因文档变更重跑，PR CI 结果另行核验。

## 接下来的执行与回滚

- 标签自动同步：原 #67 要求任意 `status:*` 自动映射，又禁止新增机器人/修改 CI。GitHub 原生能力未验证；建议本期接受"主账号每次变更时同步并回读"的人工方式，owner 裁决后另立最小自动化任务。
- Fork 访问验证：仓库 Write 不自动证明 private Project 访问权，需确认 csx12588 与 balltoo 能访问看板；若需变更访问权限由 owner 确认。
- PR #70 保持 Draft 到上述项完成；使用 Refs #67，不自动关闭 Issue。

如文档需要回退，通过普通 PR 撤销本次新增段落；已创建的外部看板不得静默删除。无运行时或数据迁移需要回滚。
