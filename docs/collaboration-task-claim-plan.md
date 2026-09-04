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
