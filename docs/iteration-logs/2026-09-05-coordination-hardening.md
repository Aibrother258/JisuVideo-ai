# HB-20260905-01：协调事实源与看板治理

关联 Issue：[#67](https://github.com/Aibrother258/JisuVideo-ai/issues/67)。
实施账号：Aibrother258；基线：03d0b598c0911b39073130d13ca396ca4ba6f30e。

## 问题与变更

协调需要从实时 Issue/PR/提交取得依据。原任务同时把阶段和状态称为看板列，并把已关闭的 #61/#62 写成实施中，需在执行时纠正。

协作计划 §10 新增事实源优先级、可核实证据、状态映射、看板验收与权限失败处理；附录登记四项协调边界。保留 §1–§9 和原门禁，不涉及应用、数据库、Agent、CI。

## 验证与尚未完成

- PR #63 已合并，基线为 03d0b59；#61/#62 已关闭。
- 主账号已是 #67 Assignee；认领留言与热点锁已发布。
- gh project list --owner Aibrother258 --format json 返回缺少 read:project scope，无法查询或创建看板。需 Project 写权限授权后重试。
- 任意 status 标签自动同步尚未验证；人工同步不冒充自动同步验收通过。
- 文档 diff 与链接由本次提交检查；应用测试不因文档变更重跑，PR CI 结果另行核验。

## 接下来的执行与回滚

授权后先查询已有 Projects，再建/关联看板，增加 Stage/Status/Blocked 等字段，将 #61/#62 标为 S0/Done、#67 标为实际状态，验证映射后补入 Project URL 与证据。未完成前 PR 保持 Draft，使用 Refs #67，不自动关闭 Issue。

如文档需要回退，通过普通 PR 撤销本次新增段落；已创建的外部看板不得静默删除。无运行时或数据迁移需要回滚。
