# PR 详细记录（pr-records）

PR 生命周期档案：每次合并的 PR 在此留下一份详细记录，作为迭代日志（`docs/iteration-logs/`）的支撑材料，防止关键决策与评审处理随 PR 关闭而丢失。

## 归档规范

1. 文件名：`YYYY-MM-DD-<主题短横线>.md`，按日期与迭代日志互查。
2. 每篇至少包含：
   - 引用块：分支 / 基准 / 日期 / 变更 / 关联方案 / PR 号与 merge commit；
   - 触发条件、改了什么（分层表）、关键设计决策（决策 → 背后逻辑）、回归测试、对后续迭代的影响、注意事项。
3. PR body 保留在 GitHub 可回溯，本文件侧重**决策与评审处理过程**，避免与 body 重复冗余。
4. 合并后同步在 `docs/iteration-logs/README.md` 增补索引行（HB-YYYYMMDD-NN），两目录互相链接（注意相对路径：README 在 `docs/iteration-logs/`，指向本目录用 `../pr-records/...`）。

## 协作避坑：Windows PowerShell + gh CLI 中文乱码（根因与规避）

**根因**：Windows PowerShell 5.1 把命令行参数按系统 ANSI 代码页（中文环境为 GBK/cp936）编码传给子进程；gh（Go 语言）按 UTF-8 解析 argv，中文参数即被误读为乱码并写入 GitHub（典型事故：PR #15 标题损坏）。

**规避——一律不把中文放进 gh 命令行参数**：
- PR / 评审 body、评论：用 `--body-file <UTF-8 文件>`（文件须 UTF-8 无 BOM）。
- PR title：先以 ASCII 标题创建，再用 `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> --input <utf8-json>` 写入中文（JSON 仅含 `{"title": "..."}`，文件 UTF-8）。
- commit message：用 `git commit -F <UTF-8 文件>`（git 层字节直通，不受 PowerShell 影响）。
- 交付前验证：`gh pr view <n> --json title,body` 应显示正常中文。

**乱码特征**：`鏀舵暃` / `璧勪骇` / `鎬佽ˉ` 等中文偏旁堆叠——即 GBK 字节被按 UTF-8 解码的结果。
