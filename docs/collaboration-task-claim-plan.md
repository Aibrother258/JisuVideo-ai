# 双实施 Fork 任务认领制实施计划

> 版本：v1.0  
> 日期：2026-09-04  
> 状态：已启用（随 PR #60，merge 21b1dd3）
> 适用仓库：`Aibrother258/JisuVideo-ai`

## 1. 目标

把原来的「两个实施账号各守一条固定实施线」升级为：

> **主账号通过 Codex 拆分和发布任务；两个实施 Fork 从主仓库任务池认领；所有结果通过 PR 回到主仓库，经过统一审核后合入。**

GitHub Issue 是任务、认领、依赖和热点文件占用的唯一事实源。Codex 对话、本地笔记和口头约定不能代替 Issue。

## 2. 角色

### 主仓库：`Aibrother258/JisuVideo-ai`

- 决定产品方向和优先级。
- 通过 Codex 把路线拆成半天至两天可完成的小任务。
- 创建 Issue，写明边界、验收、依赖和热点文件。
- 维护任务状态、热点文件锁和公共契约。
- 执行 Hermes 技术评审、Bugbot 复审和 owner 最终裁决。
- 只有主仓库 owner 合并 PR；实施账号不得直接推送主仓库 `master`。

### 实施 Fork A：`csx12588/JisuVideo-ai`

- 默认优先领域：原文理解、原文整理、长文处理、智能分集、审阅/批注/重拆、相关 Agent 与接口测试。
- 可以认领其他未冲突任务；默认领域是优先级，不是永久权限边界。

### 实施 Fork B：`balltoo/JisuVideo-ai-ball`

- 默认优先领域：API 边界校验、任务恢复/重试、供应商切换、成本与失败统计、CI、真实样板回归和生成链路可靠性。
- 可以认领其他未冲突任务；默认领域是优先级，不是永久权限边界。

## 3. 任务状态

任务只使用以下状态：

```text
status:ready
  → status:claimed
  → status:in-progress
  → status:review
  → status:changes-requested（如需修改）
  → status:merge-ready
  → Issue closed（已完成）
```

阻塞时使用 `status:blocked`，并在 Issue 中写清阻塞对象和恢复条件。

## 4. 主账号发布任务

每个任务必须使用仓库的 Implementation Task 模板，并包含：

1. 用户价值和问题背景。
2. 本次交付内容。
3. 明确不做的内容。
4. 验收标准。
5. 预计修改文件或目录。
6. 是否占用热点文件。
7. 前置依赖和合并顺序。
8. 必须执行的测试。
9. 推荐实施线、优先级和预计工作量。

一个任务目标控制在半天至两天；超过两天或横跨两个独立目标时继续拆分。

## 5. 认领规则

实施账号认领前在 Issue 留言：

```text
我认领本任务。
实施账号：<账号>
实施线：content-intelligence / production-reliability
计划分支：<branch>
预计修改：<files/directories>
热点文件：无 / <files>
开始前已同步主仓库最新 master：<commit>
```

认领生效条件：

- Issue 未被其他账号分配；
- 主账号或 Codex 将 Assignee 设为认领账号；
- 标签从 `status:ready` 改为 `status:claimed`；
- 热点文件没有被其他在途任务占用。

每个实施账号同时最多认领一个主要任务。未完成当前主要任务前，不再认领第二个主要任务。

## 6. 两台电脑同步规则

两台实施电脑都使用：

```text
origin   = 自己账号的 Fork
upstream = Aibrother258/JisuVideo-ai
```

认领后、创建分支前执行：

```bash
git fetch upstream
git checkout master
git merge --ff-only upstream/master
git push origin master
git checkout -b <type>/issue-<编号>-<slug>
```

规则：

- 分支必须从最新 `upstream/master` 创建。
- 不得从另一实施账号尚未合入的分支开发。
- 任一 PR 合入后，另一账号在继续提交前重新同步 `master`。
- 自己的功能分支落后时，合入 `upstream/master` 后再推送；不改写别人的分支。
- 所有 `gh` 命令显式指定 `--repo Aibrother258/JisuVideo-ai`。

## 7. 热点文件锁

以下默认属于热点区域：

- `backend/src/db/schema.ts`、`backend/src/db/mysql-schema.ts` 与迁移逻辑；
- 公共 API 请求/响应契约；
- `backend/src/utils/` 下被多路复用的共享工具；
- `frontend/app/composables/useApi.ts` 等共享客户端；
- `docs/product-positioning-roadmap.md`、`docs/ui-optimization-plan.md`；
- `docs/iteration-logs/` 的 HB 编号和修订记录号位；
- 巨型页面、全局样式和公共组件。

占用方法：

1. Issue 加 `hotspot` 标签并列出文件。
2. 主账号确认没有其他在途任务占用。
3. 任一时刻同一热点文件只允许一个任务修改。
4. PR 合并或任务取消后释放占用。

如果两个任务依赖同一公共契约，先创建最小契约 Issue/PR，合入主仓库后两边同步，再并行实现。禁止一个 Fork 依赖另一个未合入的 PR。

## 8. PR 要求

PR 必须：

- 使用 `Closes #<Issue>` 关联任务；
- 写明实施线、主仓库基线提交和热点文件；
- 改动范围不超出 Issue；
- 写明测试命令、实际结果以及 skipped/环境依赖；
- 勾选 `Allow edits by maintainers`；
- 没有 Issue 的实施 PR 原则上不进入最终审核。

审核门禁：

```text
Hermes 技术评审 → Bugbot 复审 → 主仓库 owner 最终裁决 → 合并 master
```

## 9. 首批试运行

任务认领制先用两个在途方向试运行：

1. Fork A：形成「原文整理与智能分集 v0.4」需求/契约 PR，不直接大规模修改运行时。
2. Fork B：完成 PR #59 的路由参数保护、无跳过的路由测试和 backend CI。

试运行完成后，主账号复盘任务粒度、热点锁和审核耗时，再决定是否增加自动分派或 GitHub Projects。

## 10. 验收标准

- GitHub Issues 已开启。
- Implementation Task 模板可用。
- 标签体系已创建。
- 两个实施账号各有一条明确任务，并完成认领留言。
- 两台电脑均从相同主仓库提交号建立分支。
- PR 描述包含 Issue、实施线、热点文件、测试与基线。
- 不再依赖 Codex 私聊或本地文件同步任务状态。

### 10.1 事实源单一化（Issue #67）

本节不改变 §1–§9 的认领、热点锁和评审门禁。任务状态以主仓库 Issue 为准；范围以已合入 master 的定位与专项契约为准；代码与测试结果以对应提交、PR 和 CI 记录为准。Projects 是任务投影，不是第二套任务台账。

每次开始协调，先查询主仓库开放 Issue、关联 PR 的最新提交/评审/检查及看板，再回答“下一步”。聊天与私有笔记只能提供检索线索，不能据此宣布完成或分派已被占用的任务。看板与 Issue 不一致时，以 Issue 状态为准，由主账号修正看板并记录原因。

有实际工作进展的当天，在当前任务 Issue 追加一行：日期（含时区）｜状态｜本轮交付｜提交/PR/检查链接｜阻塞｜下一步。不安排无人运行的每日打卡或后台机器人；未开展工作时不伪造更新。定位、范围或门禁变更仍通过文档 PR 审核。

实施账号提交证据至少包含：主仓库基线 SHA、PR head SHA、实际测试命令与结果、跳过项及环境依赖、必要的脱敏日志。主账号回读对应 head 的 CI；“本地测试通过”与“GitHub 检查通过”分别记录。无法访问另一台电脑时明确标注未独立验证，不以留言替代测试证据。不得上传 Token、密钥或原始敏感素材。

### 10.2 看板结构与同步规则

目标是在 Aibrother258 账号下建立并关联本仓库的 GitHub Project。先查询已有项目，避免重复创建。项目 URL、编号、字段与验收证据写入 Issue #67；在权限与配置验收完成前，看板状态为待完成。

Stage 与 Status 分开：

| Stage | 阶段含义 |
| --- | --- |
| S0 | 定位与协作收口 |
| S1 | 真实样本与当前流程基线 |
| S2 | 原文整理 MVP |
| S3 | 智能分集 MVP |
| S4 | 纵向生产闭环 |

日常视图按 Status 分组，阶段视图按 Stage 分组；S0–S4 不充当任务进度。阶段只有关联 Issue 全部验收完成后才关闭，不能因建了看板就认定 S0 完成。

| Issue 事实 | Status 投影 | 补充说明 |
| --- | --- | --- |
| 未发布/待拆分的规划 | Backlog | 不视为可认领任务 |
| status:ready | Ready | 等待认领 |
| status:claimed / status:in-progress | In Progress | 仍保留原标签区别 |
| status:review / status:changes-requested / status:merge-ready | Review | 是否需修改仍看 Issue 标签和 PR review |
| status:blocked | In Progress，Blocked=Yes | Issue 必须列明依赖和恢复条件 |
| closed 且验收完成 | Done | 不以“PR 已开”代替完成 |
| closed 但取消/重复 | Backlog，Disposition=Cancelled/Duplicate | 保留关闭原因，不计入交付完成 |

任务解除阻塞时清除 Blocked；只有一个有效 status 标签。Issue Assignee 保持唯一主负责人，每账号最多一个主要在途任务；阶段不意味着永久分线授权。

Issue #67 原验收中“#61/#62 正在实施”已过期：二者现已关闭，应以 S0/Done 入板，#67 则保持未完成；不得重开旧任务来迁就原文字。

同步实施分两部分：创建/关闭等事件仅在实际验证 GitHub Projects 内置工作流后启用；任意 status:* 标签映射不能假定平台已自动支持。当前无已验证的标签自动同步方案。未验证前由主账号每次状态变更时同步并回读看板，显示为人工同步；此方式不等于原 Issue 的“自动同步”验收已通过。如需降低该验收要求，必须在 #67 获得 owner 明确裁决；如需额外自动化权限或工作流，先另行审批，不修改 CI、不引入机器人。

### 10.3 本次完成条件

- 文档 PR 经既有门禁合入；§1–§9 未改动。
- 实际 Project 可查询并关联仓库；Stage、Status 和阻塞字段正确。
- #61/#62 与 #67 入板，状态与实时 Issue 一致。
- 记录标签同步的实际能力、验证结果或 owner 批准的替代方案。
- 完成一次认领→进展→评审状态回读验证；主账号确认从新一轮按 Issue/PR 协调。

缺少权限或任一验收项未完成时，保持 #67 打开。仅提交文档不自动关闭整个治理任务。

## 附录 A：协调边界与证据缺口

以下登记能力边界，不改变职责分工，也不将历史评语当作本轮核实的事实。

| 边界 | 当前处理 | 依据与验证限制 |
| --- | --- | --- |
| 主会话入口在 DuanJu，代码在 huobao-drama | 每次明确仓库目录、remote 和基线，在目标仓库执行检查 | 本会话 cwd 与目标代码目录不同；不据此认定代码有缺陷 |
| Hermes 与 Codex 私有上下文不互通 | 影响项目的结论必须附 PR/Issue 或已提交文档链接 | 私有记忆内容未核实，不依赖其存在来宣布完成 |
| 两台 fork 的本地状态不可直接观测 | 要求可复核提交和脱敏测试证据，CI 按 head 验证 | [#64](https://github.com/Aibrother258/JisuVideo-ai/issues/64) 记录过 CI 声明与可见检查不一致的整改；不推断当前仍有该问题 |
| 单次人工/Agent 审查有盲区 | 保留 Hermes → Bugbot → owner 门禁；审查服务失败标为未完成 | [PR #63](https://github.com/Aibrother258/JisuVideo-ai/pull/63) 有多轮契约修改与审查记录；不把部分定向复审说成全功能验证 |

Issue #67 引用的消息数、压缩次数和个别历史技术归因未在本任务重新统计，不作为验收指标。DuanJu 创作产物检查属于另一工作区，不在本任务内重做。任何对历史结论的采用应链接原始证据，而非复制无法复现的数字。
