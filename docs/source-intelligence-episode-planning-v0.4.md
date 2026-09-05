# 原文整理与智能分集 v0.4 需求与契约

> 版本：v0.4-rev8（契约稿，待 Bugbot 复审 → owner 最终裁决）
> 日期：2026-09-04（初稿）/ 2026-09-05（rev1，响应 PR #63 Hermes 技术评审）/ 2026-09-05（rev2，响应 Hermes 复审 P0-5/P0-6）/ 2026-09-05（rev3，响应 Codex 接管复审 P0-①~P0-⑤ / P1-①~P1-②）/ 2026-09-05（rev4，响应 Codex rev3 复审 P0 版本谱系 + P1×2 + P2）/ 2026-09-05（rev5，响应 Bugbot rev4 复审 4×P1 + 2×P2，字段语义单一来源收口）/ 2026-09-05（rev6，响应 Bugbot rev5 复审 2×P2，收口清零）/ 2026-09-05（rev7，响应 Bugbot rev6 最终复核 1×P2，switch expected 归属收口）/ 2026-09-05（rev8，响应 Bugbot rev7 最终复核 1×P1，switch CAS 统一含 null）
> 修订记录：rev1 修复 P0-1/P0-2（§6.1 表结构选型与存储约束重写）、P0-3（§5.3 新增 `PUT /dramas/:id/source/current` + T10）、P0-4（§5.3 confirm 三态返回与原子性 UPDATE + T11）；同步吸收与本次表/端点修改同源的 P1-1（`source_hash` → `content_hash`/`base_hash`）、P1-4（整理任务进度复用 `GET /tasks/:id`）、P1-5（`user-edited` 测试缺口随 T10 补齐）；其余 P1-2/P1-3/P1-6 与 P2 各项登记为 v0.4.1 修正式 / owner 裁决意见（见 §10）。
> 修订记录（rev2）：修复 P0-5（§6.1 版本序号并入自增主键 `id`，废除 `MAX(version_seq)+1` 并发撞号）、P0-6（§5.3 新增 `POST /dramas/:id/source/switch` 版本切换端点 + T12）；P1-新1（`PUT current` 与 skip 状态机死锁）随 P0-6 方案 A 自动闭环；P1-新2（`sys_task` 生命周期复用）与既有 P1 打包登记 v0.4.1（见 §10）。
> 修订记录（rev3）：修复 Codex 复审 5 条 P0——①confirm 等指针写统一「锁 `dramas` 行 + 锁内判定」原子原语（§5.3）、②switch 请求体拆 `target_version_id` + `expected_current_version_id`（§5.3）、③`from-plan` 读取与哈希校验对象改为当前有效正文并列为 v0.4 唯一必改点（§5.2/§5.4）、④冻结规范化输入基准并登记 trim 实施改动（§3.3/§5.2）、⑤skip 语义收紧为「从未整理才允许」（§5.3）；顺手吸收 P1 两条文案（§0.1/§3.3 能力表述降级、§2.1 `chapter_marker` 不入删除区间）；§7.2 T2/T7/T8/T11/T12 断言同步（见 §10）。
> 修订记录（rev4）：修复 Codex rev3 复审 P0（版本谱系倒退）——confirm 废除原地迁移，**版本行完全不可变**：confirm = 以 target `cleaned` 为 parent 新建 `confirmed` 派生行并切指针，原 `cleaned` 行保留；请求体拆 `target_version_id` + `expected_current_version_id`，锁内同时校验当前指针、target=cleaned、target.parent=当前有效正文、target=其 parent 下最新 cleaned（任一不符 409/400）；clean 候选记录启动基线（`parent_version_id`），完成时不因指针漂移改写。同步吸收 P1×2（skip 回正为「current=source 即可设置标记，cleaned 保留为未采用候选」；source 区分 raw/`dramas.description` 与 canonical/`source_versions.content`，逐字节断言指向 canonical）与 P2（`GET /versions` `current.kind` 枚举移除 cleaned）；T7/T11 增补并发用例（见 §10）。
> 修订记录（rev5）：响应 Bugbot rev4 复审 head `59463d5`（4×P1 + 2×P2，全部为字段/公式级跨章一致性问题）——①clean 段 `content_hash` 回正为本行内容哈希、基线记录统一走 `parent_version_id` + `base_hash`（§5.3，I1/I2）；②confirm/switch 的 `target_version_id` 校验补 `drama_id` = 路由项目、跨项目 `400`（§5.3，I6）；③质量门与 `diff` 语义统一相对「任务输入基线 = parent content」（首轮 = canonical source，二次整理 = 当前 confirmed/user-edited，§2.1，I3）；④`confirmed` 派生行 `diff`/`stats` = identity、不复制 target 的 diff（展示经 parent cleaned 行读取，§5.3/§6.1，I3）；⑤`GET /versions` 每行补 `parent_version_id`（§5.3，P2-①）；⑥区分「编辑/确认 = 新建版本、回退/回到原文 = 仅移动指针」（§6.1，P2-②，I8）。根治：新增 §6.1「字段语义单一来源」I1–I9 跨章不变量清单（见 §10）。
> 修订记录（rev6）：响应 Bugbot rev5 复审 head `56da3df`（2×P2 收口清零）——①§6.1 选型段措辞二分：新增类（懒生成 `source` / clean 产出 `cleaned` / confirm 派生 `confirmed` / PUT current 派生 `user-edited`）= 新建版本行 + 切指针；回退类（`switch`）= 仅移动指针、不新建版本行（不变量 I8）；②`PUT current` 的 `expected_current_version_id` 校验改归属优先：先按 `id` + `drama_id` 判定（不存在或属于其他项目 → `400`），属于当前项目但非当前指针才 `409`，kind 不合法 `400`；原子性与 T10 断言同步（不变量 I6）。**同一归属优先原则平行落实到 confirm 校验 1 与 switch 返回表**（409 行限定「属于当前项目」，400 行覆盖跨项目的 target/expected），杜绝 I6 缺口在其余含版本 id 参数的端点重现。登记见 §10。
> 修订记录（rev7）：响应 Bugbot rev6 最终复核 head `cc9c26e`（1×P2，switch 原子流程漏写 expected 归属）——§5.3 switch 原子性补全为 5 步：锁 `dramas` 行 → 按 `id` + `drama_id` 校验 `target_version_id`（不存在 / 跨项目 / kind 非法 → `400`）→ `expected_current_version_id` 非 `null` 时按 `id` + `drama_id` 校验归属（不存在 / 跨项目 → `400`，I6）→ 属于本项目但不等于锁内当前指针 → `409` → `UPDATE` 指针提交；T12 补「跨项目 expected → 400」断言。返回表与 I6 已含该语义，rev7 使原子流程文字与之一致。登记见 §10。
> 修订记录（rev8）：响应 Bugbot rev7 最终复核 head `1053830`（1×P1，switch 第 4 步把 CAS 限定为「expected 属于本项目」，expected=null 时并发绕过）——§5.3 switch 原子性第 4 步改**统一 CAS**：无论 expected 是数字还是 `null`，只要 ≠ 锁内当前指针（`null` vs 非 `null` 视为不等）→ `409`；第 3 步归属检查维持仅限非 `null` expected。confirm 锁内校验 1 与返回表 409 行同构澄清（null 参与统一 CAS，null vs 非 null 视为不等）。T12 补「expected=null 且锁内 current 已有版本 → 409」。登记见 §10。
> 关联：`docs/product-positioning-roadmap.md` §4「命名收敛」与 §4.1「v0.4 修正方向」、§5 定位裁决 #4；GitHub Issue #61
> 基线：主仓库 `master` = `d778550`（rev4 同步主仓 master 至 PR #59/#69 等合入后）
> 本文性质：**公共契约与需求稿**。只定义状态、数据、接口、失败降级与验收标准；不包含任何运行时代码、数据库迁移或对既有文件的业务修改。
> 本文约定：凡标「**已冻结**」的行为/字段/边界为 v0.4 契约，后续实施任务必须遵守；凡标「**实施拆分时细化**」的为方向性设计，允许在对应实施 PR 中调整，但调整不得违背已冻结项。

---

## 0. 目标与边界

### 0.1 用户价值（已冻结）

让系统更准确地理解长篇内容，并给出更可靠的分集边界。用户面对的能力名称为：

- **检查原文**：导入后识别章节号、广告、水印、重复段等噪声，只提示、不自动改。
- **AI 整理原文**（可选、可跳过）：去噪声但**不改写正文**，结果可预览、可复现、可回退。
- **查看整理结果**：原文 / AI 整理稿 / 用户确认稿 / 差异记录四者关系可见。
- **智能分集**：基于「用户确认稿」做 AI 推荐集数与摘要 + 后端确定性切片，顺序不变、不漏字、不重复。

不使用「净化」作为产品主定位或强制步骤（见 roadmap §4）。

### 0.2 本期明确不做（已冻结）

- 不修改数据库 schema 或执行任何迁移。
- 不新增 Agent、API 路由或前端步骤（本 PR 为纯契约文档）。
- 不调用付费模型，不跑真实生成任务。
- 不把 shuohao 策划包导入升级为正式立项（维持 roadmap §8 候选池口径）。
- 不在本任务顺带处理 `/tasks/:id`、`DELETE /tasks/:id`、`POST /tasks` 等其他数值校验（归 Fork B 实施线）。
- 未获授权前，不把「历史版本垃圾回收 / 自动清理旧版本」写成已拍板事项（roadmap §4.1「D 系列决策未获授权前不写已拍板」）。

### 0.3 对照基线说明

本契约全文引用的文件、路由、字段、函数与测试均为当前 master（`21b1dd3`）真实存在项：

- 路由：`backend/src/routes/dramas.ts`、`backend/src/routes/episodes.ts`
- 数据模型：`backend/src/db/schema.ts`、`backend/src/db/mysql-schema.ts`
- 服务：`backend/src/services/episode-planning.ts`、`backend/src/services/episode-plan-draft.ts`、`backend/src/services/source-import.ts`、`backend/src/services/request-guard.ts`、`backend/src/utils/source-sample.ts`
- Agent：`backend/src/agents/index.ts`（`episode_planner`）、`backend/src/mastra/index.ts`（Agent 注册表挂载点）
- 前端：`frontend/app/composables/useApi.ts`、`frontend/app/views/drama/detail.vue`

范围澄清：§0.2 的「不改代码 / 不跑真实生成」约束对象是**本文所在 PR**（纯契约 PR）；§7.1 的「命令照抄」约束对象是**后续实施 PR**。两者作用对象不同，不构成矛盾。

---

## 1. 版本关系与核心角色（已冻结）

原文整理与分集涉及的「四稿」关系定义如下：

| 角色 | 代号 | 含义 | 允许改写正文 | 是否作为分集输入 |
| --- | --- | --- | --- | --- |
| 原文（源稿） | `source` | 导入到 `dramas.description` 的**原始落点**（raw：粘贴 / TXT/MD / 小说链接导入后的原样正文） | — | 否（仅作回指与差异参照） |
| AI 整理稿 | `cleaned` | AI 只执行「删除噪声区间」后的结果，必须由「原文 + 删除区间」确定性复现 | 禁止 | 否 |
| 用户确认稿 | `confirmed` | 用户审阅整理结果后确认的正文；此后分集、项目方案一律读取该稿 | 允许（经用户编辑后进入 `user-edited` 状态） | **是** |
| 差异记录 | `diff` | 输入基线（首轮为原文；二次整理为当前有效正文，I3）→ 整理稿之间每次操作的记录（区间 + 类型 + 分类 + 片段） | — | — |

**raw 与 canonical 的区分（rev4，响应 Codex rev3 复审 P1）**：`dramas.description` = 导入原样（**raw source**，含首尾空白）；`source_versions` 中 `base_kind=source` 行的 `content` = **canonical source** = `String(description).trim()`（懒生成/首次落库时写入，§6.3），版本行 `content` 一律存 canonical（rev3 §3.3 规范化输入）。全文「原文 / 逐字节 / 与现状一致」类断言统一以 **canonical source** 为基准：未懒生成的旧项目读取对象为 `dramas.description`，但哈希与切分按同一 trim 口径（`sha256(String(content || '').trim())`）计算，二者只差首尾空白，不与现状产生行为差异。

**版本边界规则（已冻结）**：

1. `cleaned` 与 `confirmed` 的分界：用户执行一次「确认整理结果」动作后，由该 `cleaned` **派生**出新 `confirmed` 版本并切换当前指针；原 `cleaned` 行保留为未采用候选历史，不迁移 kind（rev4，§5.3）。确认前整理稿随时可放弃或重跑，不影响任何下游。
2. `confirmed` 与 `user-edited` 的分界：确认稿被用户直接编辑正文后，状态变为 `user-edited`，保留所有历史版本，但**不再执行严格相减证明**（用户编辑不是可证明的确定性操作）。
3. 分集与项目方案输入：存在 `confirmed`/`user-edited` 时读该稿；用户选择跳过整理或从未整理时，等效输入为 `source`（与现状完全一致）。
4. 原文顺序保证只对确定性切片成立（见 §3.3）；`user-edited` 稿不承诺与 `source` 的相减关系。

### 1.1 正文级状态机（已冻结）

```text
[导入成功] → source
              │
              ├─(用户选择跳过整理)→ 跳过标记           （dramas.source_skip_at 落盘，当前有效正文仍 = source，见 §5.3 skip）
              │
              ▼
        [健康检查]（只读）
              ├─ 干净 → 可直接分集（等效跳过，行为=现状）
              └─ 检出噪声 → 建议整理
                            ▼
                   [AI 整理任务]（异步）
                            │
                            ▼
                        cleaned（可预览、可放弃、可重跑）
                            │
                        [用户确认]
                            ▼
                       confirmed ──(用户直接编辑正文)──▶ user-edited
                            │                              │
                            └──────────▶ 项目方案 / 智能分集 ◀─────────┘
```

状态约束（已冻结）：

- 任一时刻每个项目只存在一个「当前有效正文版本」；其余版本均为只读历史。
- 从 `confirmed` 反向回到 `cleaned` 必须显式触发「重新整理」，产生新版本而非覆盖历史。
- 把「当前有效正文」切到历史任一已生效版本（含回到 `source` 原文）由显式版本切换端点 `POST /dramas/:id/source/switch` 承载（rev2，§5.3）：只移动指针、不产生新版本行、不改历史；`cleaned` 行不可被切为当前（未确认不生效）。
- 正文状态与现有 `dramas.status`、`episodes.status` 互不干扰：整理发生在项目方案/分集之前，不改变剧集生命周期语义。

---

## 2. 质量门（A 系列，已冻结）

### 2.1 AI 自动整理阶段的质量门

AI 自动整理只被允许输出「删除区间建议」，不允许输出改写后的整篇正文。后端对结果执行确定性校验，任一不通过则整体拒绝并返回可读错误：

1. **可定位**：每条 `removed.snippet` 必须能在**该整理动作的输入基线正文**中按字符精确找到（输入基线 = 任务启动时的当前有效正文快照 = 结果行的 parent 行 content，§5.3/§6.1 不变量 I3；见 §3 定位契约）。
2. **不重叠**：全部删除区间两两不重叠，并按在输入基线中的顺序排列。
3. **可复现**：`cleaned = 规范化任务输入基线 − Σ(删除区间)`；同一任务输入基线 + 同一删除区间集合必须逐字节复现同一 `cleaned`（rev5 术语统一，响应 Bugbot P1-③：输入基线首轮整理 = canonical source，二次整理 = 当时的当前 `confirmed`/`user-edited` 正文，不变量 I3）。
4. **不改写**：除删除区间外，输入基线正文任何字符不得被改动、替换、插写或重排。
5. **章节标题不丢弃**：识别为章节标题的区间先提取为结构锚点（入锚点表），不作为普通噪声删除；用户可在确认页决定是否同时保留在正文。

> 删除区间的分类采用有限集合，v0.4 冻结如下：`ad`（广告）、`watermark`（水印/作者话）、`duplicate`（重复段）、`garbage`（乱码/无意义字符）。分类仅用于展示与统计，不改变删除语义。分类集合属于「实施拆分时可扩充」项。
> **`chapter_marker` 不入删除区间（rev3，响应 Codex P1-②）**：章节号/卷标题行由 §2.1-5 提取为结构锚点并保留在正文，AI 整理**不得输出** `chapter_marker` 删除区间（与「章节标题不丢弃」一致）；`chapter_marker` 仅用于健康检查检出提示与锚点建立。用户确需删除章节标题时，经 `PUT /dramas/:id/source/current` 的 `user-edited` 人工编辑版本完成（§2.2），健康检查 issues 类型不含 `chapter_marker`（§5.3）。

### 2.2 用户人工编辑后的规则切换

用户直接编辑 `confirmed` 正文后进入 `user-edited`：

- 不再执行严格相减证明（第 2.1 条 1–4 项不适用于用户编辑）。
- 系统在编辑前自动落一次版本快照（原文 → confirmed 全链路保留），保证任何时刻可回退到最近一次机器可证明版本。
- 分集继续使用用户编辑后的版本，并照常保证「顺序不变、不漏字、不重复」的**切片层**性质（仅相对输入文本，见 §3.3）。

---

## 3. 段落定位与智能分集锚点契约（已冻结）

### 3.1 锚点四件套

后端为正文维护如下组合定位信息（在「整理/确认」或需要时对目标正文计算一次）：

| 锚点 | 定义 | 用途 |
| --- | --- | --- |
| 稳定段落 ID | `PARA-<sha256 前缀 8>[:<出现序号>]`，由「段落首行规范化后内容」计算，同段复现时 ID 稳定 | 跨版本、跨集回指段落的唯一键 |
| 字符区间 | 相对所在正文的 `[start, end)`，UTF-16 code unit（与现有 `String.prototype.slice` 语义一致） | 删除区间、切片边界、差异记录的坐标系统 |
| 段落内容哈希 | `sha256(段落原文)` | 精确校验段落在两个版本间是否逐字未变 |
| 段首短锚 | 段落去空白后前 12 个字符（可配置长度） | 快速候选匹配与用户可读展示 |

段落切分规则：优先按现有自然边界（`backend/src/services/episode-planning.ts` 的 `naturalBoundaries()` 句式边界 + 空行分段）划分段落；无法归并的连续短行合并为一段。

### 3.2 定位与冲突处理

- 后端按「段首短锚候选 → 内容哈希精确校验 → 区间在整体中单调重排」的顺序组合定位；候选数大于 1 时返回候选列表并提示冲突，不做静默猜测。
- 定位失败的段（短锚漂移且哈希不命中）标记为 `unresolved`，由用户在该段上下文手动选择或降级为相邻段落（见 3.4）。

### 3.3 AI 推荐集数与摘要 + 后端确定性切片

延续现有职责划分（`backend/src/routes/dramas.ts` `POST /dramas/:id/analyze-episodes` + `splitSourceIntoEpisodes`），v0.4 冻结为：

- **AI 只做内容理解（rev3 措辞降级，响应 Codex P1-①）**：`episode_planner` Agent 只输出 `recommended_count / reason / episodes[{title, summary}]`，**不输出任何字符级边界建议**；正文永远来自输入文本，由后端切片（现状已如此）。语义分集 = AI 推荐集数与摘要 + 后端确定性切片；若未来要 Agent 输出可校验边界建议，另立决策，不属于 v0.4 能力承诺。
- **规范化输入（rev3 定稿，响应 Codex P0-④）**：v0.4 冻结输入基准 = `normalized = String(content).trim()`（与 `content_hash` 的 trim 口径一致，§5.4/§6.1）。版本行 `content`、分集输入、`content_hash`、切片与一致性断言一律以规范化输入为准；进入分集链路前不引入任何其他改写。
- **分集输入**：读取当前有效正文版本（`confirmed` / `user-edited` / 跳过整理时的 `source`），将规范化文本作为 `content` 传入现有分集链路。
- **后端确定性切片**：沿用 `splitSourceIntoEpisodes` 的边界候选 + 顺序切分算法；对确认稿新增「段落锚边界」候选源（候选边界必须落在段落边界集合内），使分集边界与段落锚对齐。
- **一致性断言（每轮切片必过，可测）**：各集正文按 `episode_number` 顺序拼接后逐字符等于**规范化输入**；`character_count` 之和等于规范化输入长度；段落在各集内不重复出现。断言与现状 trim 行为（`splitSourceIntoEpisodes` 输入整体 trim / `normalizeReviewablePlan` 单集二次 trim）的衔接，见 §5.2「v0.4 行为必改点」。

### 3.4 越界 / 定位失败的降级

- 后端切片边界始终限制在候选边界集合内；无合适候选时取最接近的合法边界（现状 `naturalBoundaries` 兜底逻辑）。
- 锚点定位失败（`unresolved` 段）不影响切片本身：切片对输入文本仍满足 §3.3 一致性断言；锚点仅用于「回指原文 / 展示段落归属」，失败段落降级为「仅区间定位」并在界面提示。
- 用户可审阅并调整集边界：调整发生在草稿层（`episode_plan_drafts.plan_json` 逐集 `content`），调整后重新执行一致性断言，不满足则禁止保存并提示冲突段。

---

## 4. 长文、进度、重试与成本（已冻结边界 + 实施方向）

### 4.1 现状硬边界（回归引用，已冻结）

| 边界 | 位置 | 值 |
| --- | --- | --- |
| 链接/文件导入正文上限 | `backend/src/services/source-import.ts` | 20 万字；超过即拒绝且不保存截断内容 |
| 网页内容下载上限 | 同文件 | 6 MB |
| 分集分析正文输入 | `POST /dramas/:id/analyze-episodes` | ≥20 字；>20 万字拒绝 |
| 集数范围 | 同端点 | 1–30（不传由 AI 推荐） |
| 分集草稿 | `normalizeReviewablePlan` | 1–50 集；单集标题 ≤200 字；摘要 ≤4000；批注 ≤2000；各集正文总长 ≤25 万字 |
| 单集正文写入 | `PUT /episodes/:id` | `content` ≤25 万字；`description` ≤4000 |

### 4.2 AI 整理的长文分段（实施拆分时细化，方向已冻结）

- 长文整理任务按序分块处理（每块字符数由实施任务根据模型上下文定，但块边界必须落在 §3.1 段落边界），逐块产出删除区间，最后合并为一个删除区间集合后整体校验（§2.1）。
- 任务幂等：同一 `source` 的整理任务可重试，不产生半成品 `cleaned`；只有全量校验通过才原子落版本。
- 中断恢复：整理任务状态可断点续跑（复用 `backend/src/utils/task-lifecycle.ts` 与 `sys_task` 恢复租约的模式；具体落点由实施任务确认）。

### 4.3 进度与成本提示（已冻结）

- 健康检查 / 整理过程向前端暴露阶段进度（`checking → cleaning → verifying → ready`）与当前阶段状态。
- 整理任务统一落 `sys_task`（沿用 `backend/src/services/generation.ts` 的任务生命周期），`task_key` = `sys_task.id`；前端通过**现有** `GET /tasks/:id`（`backend/src/routes/tasks.ts`）查询进度与结果，不新增独立进度端点。
- 发起整理前返回**字符数 + 预估 token 量 + 预估成本上限**的提示信息（纯估算，不发起真实调用即可展示）；确认稿预览页展示本稿删除统计（按 §2.1 分类计数、删除总字数）。

### 4.4 并发与限流（已冻结）

- 所有 AI 调用沿用 `backend/src/services/request-guard.ts` 的 `acquireAiRequest` 门控（429 + `Retry-After`），整理任务与分集任务使用不同 key 前缀避免互相挤占。

---

## 5. API 契约

### 5.1 统一约定（已冻结）

- 响应格式沿用 `backend/src/utils/response.ts`：成功 `200/201 { code, data, message }`；错误 `400 / 404 / 409 / 500` 统一 `{ code, message }`。
- `409` 语义沿用 `VERSION_CONFLICT`；正文源变化类冲突返回 `409` 并带可读 message（现状 `analyze-episodes` 保存草稿、`from-plan` 均已实现，见 `dramas.ts`）。
- 所有新增端点只读写项目级正文版本，不改动 `episodes` 表语义。

### 5.2 现有端点与行为（兼容旧项目与跳过整理；v0.4 存在唯二必改点，rev3）

以下端点在 v0.4 中**不改变行为**；未整理/跳过整理项目走它们 = 现状。`from-plan` 的正文读取对象与分集正文 trim 口径是**唯二的行为必改点**（rev3，响应 Codex P0-③/P0-④，见下方小节），其余端点维持零变化：

- `POST /dramas`（创建项目，含原文导入到 `dramas.description`）
- `POST /dramas/:id/analyze-episodes`（AI 集数/标题/摘要建议 + 确定性切片 + 草稿保存；`content` 由调用方传当前有效正文）
- `GET|PUT /dramas/:id/episode-plan`（草稿读取/保存，乐观锁 `expected_version`）
- `PUT /episodes/:id`、`GET /episodes/:id/pipeline-status` 等既有剧集端点

兼容规则（已冻结）：

- 旧项目（`source_versions` 无任何记录）：健康检查与整理全部可跳过；读取对象 = `dramas.description`（raw），切分/哈希按 canonical 口径（`String(x).trim()`，§1.1/§3.3）计算，与现状「切分前 trim」行为一致、零回归。
- 前端在「导入原文 → 分集」之间新增的可选步骤不改变任何现有保存动作的请求/响应结构。

**v0.4 行为必改点（rev3 定稿；除以下两点外，§5.2 其余端点零变化）**：

1. **`from-plan` 正文读取与哈希校验对象 = 当前有效正文**（响应 Codex P0-③）：现状实现写死 `sourceHash(drama.description)`（`backend/src/services/episode-plan-draft.ts`），一旦确认稿/编辑稿切换当前指针，整理后的项目将永远 `409`、无法从整理稿出剧集。v0.4 冻结改法：
   - `POST /dramas/:id/episodes/from-plan` 的正文读取与「全文未变化」校验对象 = 当前有效正文（`current_source_version_id` 指向行的 `content`；NULL 时 = `dramas.description`，旧项目/跳过整理回退分支按 canonical 口径（trim）处理，与现状 `sourceHash` 行为一致、零回归）；
   - 校验哈希 = 当前有效正文的 `content_hash`（§5.4），与 `analyze-episodes` 保存草稿写入的 `source_hash` 对齐，「全文已变化 → 409」语义不变；
   - 该改动把「从确认稿/编辑稿生成剧集」补成闭环；未整理项目行为不变。
2. **分集正文 trim 口径 = 规范化输入 + 保留段间换行**（响应 Codex P0-④）：现状 `splitSourceIntoEpisodes()` 先对输入整体 `content.trim()`、`normalizeReviewablePlan()` 再对每集正文整篇 `trim()`，会造成输入两端空白与集间换行在保存链路丢失，与 §3.3「按集拼接 = 输入」断言冲突。v0.4 冻结改法：
   - 版本存储、哈希与一致性断言以 §3.3「规范化输入」`String(content).trim()` 为基准；
   - 切片与草稿保存以段落为最小保留单元、**保留段间换行**；`normalizeReviewablePlan` 不再对单集正文做整篇二次 trim（消除边界空白丢失根因）；
   - 实施 PR 触碰 `episode-planning.ts` / `episode-plan-draft.ts` 时按此冻结实现并 diff 说明。

### 5.3 新增端点草案（契约冻结，实施任务拆分时落地）

> 以下为 v0.4 冻结的请求/响应形状；实际路由文件、幂等迁移与前端接线由后续实施 PR 承担。未获授权的清理/回收类（D 系列）端点不在此列。

**写端点的统一原子原语（rev3 定稿，rev4 补行不可变语义）**：凡修改 `dramas.current_source_version_id` 的端点——clean 懒生成 `source` 行、confirm、PUT current、switch——在同一事务内先执行 `SELECT id, current_source_version_id FROM dramas WHERE id=? FOR UPDATE` 锁定项目行（同一项目的此类写按锁序串行执行），再做判定与写入，提交前指针变更对外不可见。`200 / 409 / 400` 一律来自**锁内判定**（与请求到达时序无关，测试可稳定复现）：调用方携带的 `expected_*` 与锁内读到的当前指针不符、或目标非最新候选/基线不匹配 → `409`；目标不存在/参数非法 → `400`。**rev4 起版本行完全不可变（含 `base_kind`，§6.1）**：不存在任何「行内 kind 迁移」与「行内容更新」，rev3 及更早条文中「confirm 原地迁移 `cleaned → confirmed`」「条件 UPDATE 迁移 kind」的描述全部作废。rev2 及更早「条件 UPDATE 后补 SELECT 区分 400/409」「单条 UPDATE 即天然防并发覆盖」已在此前废除。

#### `POST /dramas/:id/source/health-check`

只读健康检查（不调用付费模型，用规则 + 可选轻量模型）。

- 请求体：`{ source_content?: string }`（省略时用服务器当前有效正文）。
- 响应 `200`：
```json
{ "code": 200, "data": {
  "status": "clean" | "issues",
  "issues": [ { "type": "ad|watermark|duplicate|garbage",
                "count": 0, "sample_ranges": [[0, 10]] } ],
  "char_count": 0
}, "message": "success" }
```
- `status: clean` 时前端直接进入分集，不提示整理（等效跳过）。

#### `POST /dramas/:id/source/clean`

发起（或重跑）AI 整理，异步，立即返回任务句柄。

- 请求体：`{ model?: string, config_id?: number }`（沿用现有 AI 配置选择模式，缺省取当前启用配置）。
- 响应 `200`：`{ status: "running" | "already_running", task_key: string }`；`task_key` 即 `sys_task.id`；并发规则同 §4.4。
- 任务进度与结果经 **现有** `GET /tasks/:id`（`backend/src/routes/tasks.ts`）查询，不新增独立进度端点（见 §4.3）。
- 任务成功：新增一行 `base_kind=cleaned` 版本（`content` = 删除区间应用结果，见 §6.1）；**不改变当前有效正文指针**——清理稿未确认前不生效，用户可预览、可放弃、可重跑，旧版本不被覆盖也不被删除。
- 输入基线与哈希（rev5 定稿，响应 Bugbot P1-①）：清理结果必须挂在**任务启动时的输入基线**下——新 `cleaned` 行的 `parent_version_id` = 任务启动时锁内读到的当前有效正文版本行 id（首轮整理 = `source` 行；二次整理 = 当时当前的 `confirmed`/`user-edited` 行）。哈希按 §6.1 不变量 I1/I2 统一：`content_hash` = `sha256(String(cleaned.content || '').trim())`，是**本行 content** 的哈希；`base_hash` = `parent_version_id` 指向行（输入基线）的 `content_hash`。rev4 旧述「content_hash 同步为基线正文的 content_hash」与 I1（content_hash = 本行内容哈希）冲突，已废除——发生实际删除后 cleaned 的正文与其哈希不一致会让 `from-plan` 固定 409。
- 指针漂移防护（rev4 保留，§5.3 confirm 校验 3）：任务完成时若当前指针已被 switch/confirm/PUT current 切走，候选行仍作为历史保存（parent/基线已固化），但 confirm 因「`target.parent` ≠ 当前正文」拒绝它，不覆盖新当前正文。

#### `GET /dramas/:id/source/versions`

- 响应 `200`：当前项目版本历史（按版本行 `id` 升序——`id` 为自增主键兼版本序号，rev2 见 §6.1）+ 当前有效正文指针（`current` 为 `dramas.current_source_version_id` 指向的行；`null` 表示未整理，正文 = `dramas.description`）：
```json
{ "code": 200, "data": {
  "current": { "kind": "source|confirmed|user-edited", "id": 1, "updated_at": "..." },
  "versions": [
    { "id": 1, "kind": "source", "parent_version_id": null,
      "content": "<source>", "content_hash": "…",
      "base_hash": "…", "diff": null, "stats": null, "created_at": "…" },
    { "id": 2, "kind": "cleaned", "parent_version_id": 1,
      "content": "<cleaned>", "content_hash": "…",
      "base_hash": "…",
      "diff": { "removals": [ { "start": 0, "end": 8, "snippet": "…", "category": "ad" } ],
                "removed_chars": 8 }, "stats": { "by_category": { "ad": 1 } }, "created_at": "…" }
  ]
}, "message": "success" }
```
- `content` 对超长版本允许按需截断展示（前端用 `char_count`/区间做预览），完整内容字段与截断策略由实施任务定。契约要求：**整理链（`cleaned` 及由其派生的 `confirmed`）必须可用 `diff` + `parent_version_id` 链还原**，不必依赖整篇 `content` 往返；`source` 首行与 `user-edited` 行的 `diff` 恒为 `null`（不变量 I3 / §2.2），正文还原以 `content` 为准（截断时按实施任务策略重取完整内容）。
- 响应字段与存储列的对应：`kind` ↔ `base_kind`；`parent_version_id` ↔ 存储列（**每行必返**，rev5 响应 Bugbot P2-①）；`content_hash` = `sha256(String(content || '').trim())`；`base_hash` 定义见 §6.1。
- **`diff` 的坐标基准 = 该行 `parent_version_id` 指向行的 `content`**（该行产生时的任务输入基线，不变量 I3）；`source` 首行 `parent_version_id` = `null`、`diff` = `null`。契约断言（T7）：任意非首版本行，`base_hash` = 其 `parent_version_id` 行的 `content_hash`；`confirmed` 行的 `diff` = identity（I3）。

#### `POST /dramas/:id/source/confirm`

把一份 `cleaned` 候选稿确认为分集输入基线。rev4 起 confirm **不做任何行内迁移**：确认 = 以该 `cleaned` 行为 parent 新建 `confirmed` 派生行（`content`/`content_hash` 快照复制自 target；`diff`/`stats` = identity，rev5 见下）并把当前指针切到派生行；原 `cleaned` 行保留为「未采用候选历史」。

- 请求体（rev4 定稿，响应 Codex rev3 复审 P0）：`{ target_version_id: number, expected_current_version_id: number | null }`。
  - `target_version_id` = 待确认的 `cleaned` 版本行 `id`；
  - `expected_current_version_id` = 调用方当前持有的指针值（取自已响应 `GET /versions` 的 `current.id`；`null` 表示调用方认为未整理）。rev3 单一 `expected_version` 只表达目标、不表达调用方看到的当前指针，无法同时校验「目标是最新候选」与「当前指针未被并发切走」，已废除。
- 锁内校验（rev4 定稿；rev5 校验 2 补 `drama_id`，响应 Bugbot P1-②；rev6 校验 1 补归属，响应 Bugbot P2-B；rev8 校验 1 澄清 null 统一 CAS，与 switch 原子流程同构；任一不符按表返回）：
  1. `expected_current_version_id` 非 `null` 时先按 `id` + `drama_id` 判定归属（不存在 / 属于其他项目 → `400`，I6）；随后统一 CAS：无论数字或 `null`，只要 ≠ 锁内读到的当前指针（`null` 对非 `null` current 视为不等）→ `409`；
  2. `target_version_id` 行存在、**`drama_id` = 路由项目 id**（跨项目 target 一律按 400，不变量 I6）且 `base_kind=cleaned`；
  3. `target.parent_version_id` = 锁内当前有效正文版本行 id（该候选的整理输入基线 = 当前正文，证明候选不是基于已被切走的旧基线）；
  4. `target_version_id` 是该 parent 下 `id` 最大的 `cleaned`（最新候选）。
- 返回表（rev4 定稿，已冻结）：

| 判定（锁内） | 返回 |
| --- | --- |
| 上述 1–4 全部通过 | `200`：以 target 为 parent 新建 `confirmed` 行（`content`/`content_hash` = target 的；`diff`/`stats` = **identity** `{ removals: [], removed_chars: 0 }`/空——confirmed 与直接 parent（target cleaned）内容相同、无独立差异，rev5 响应 Bugbot P1-④，不复制 target 的 `diff`/`stats`，§6.1 不变量 I3），指针切至新行 |
| 归属判定先行（target 与非 null 的 `expected_current_version_id` 均存在**于本项目**，跨项目/不存在已按上列 `400` 返回）；但 target 不是其 parent 下的最新 `cleaned`（如先确认 #11 再确认旧 #10）；或 `target.parent_version_id` ≠ 当前有效正文（候选基于旧基线）；或 `expected_current_version_id` ≠ 锁内当前指针（`null` vs 非 `null` 视为不等，rev8；并发被切走） | `409 VERSION_CONFLICT` |
| `target_version_id` / `expected_current_version_id` 不存在**于本项目**（不存在 / 属于其他项目，`drama_id` ≠ 路由项目，I6），或 `base_kind ≠ cleaned`（对 source/confirmed/user-edited 行执行 confirm） | `400` |

- 原子性（rev4 定稿）：按 §5.3 统一原子原语，单事务内锁 `dramas` 行 → 按上述 1–4 顺序校验（1/3/4 与指针相关者均读锁内值，无并发干扰）→ `INSERT` 新 `confirmed` 行（`parent_version_id` = target；`diff`/`stats` 为 identity，§6.1 I3）→ `UPDATE dramas SET current_source_version_id=?new_id WHERE id=?` → 提交；成功时清除 skip 标记（§5.3 skip）。校验 2–4 失败即 `409/400`，不 INSERT。确认「#11 后再确认旧 #10」、确认「clean 基于 A 启动、期间 switch 到 B 后完成的 A 结果」等谱系用例由校验 3/4 统一拒绝（T7/T11）。
- 展示语义（rev5，响应 Bugbot P1-④）：confirmed 行本身无独立 diff（与 parent=cleaned 内容相同）；前端要展示「本次确认采用的整理差异/统计」时读 `confirmed.parent`（该 cleaned 行）的 `diff`/`stats`（不变量 I3/I4）。
- 语义说明（响应 Codex rev3 复审 P0）：rev3 用「全表 `MAX(id) WHERE base_kind='cleaned'`」判最新，确认后该行又原地变 `confirmed` 退出查询，旧 cleaned 行随即成为新的 `MAX` → 可把当前正文倒退到旧稿；且异步 clean 基于旧正文 A 完成的结果只要 id 最大也可能覆盖新正文 B。rev4 的派生行 + 基线绑定后：同一整理输入下只有**最新的那份候选**可被确认，确认动作固化当前基线；候选必须挂在「当前有效正文」下，杜绝覆盖新正文。
- 响应 `200`：新 `confirmed` 版本对象（`{ id, kind: "confirmed", parent_version_id, content_hash, ... }`）。

#### `PUT /dramas/:id/source/current`

用户直接编辑「已确认正文」的入口，触发 `confirmed → user-edited`（§2.2）并自动落版本快照。

- 请求体（rev4 字段名与 confirm/switch 统一，语义不变）：`{ expected_current_version_id: number, content: string, note?: string }`。
  - `expected_current_version_id` = 当前有效正文所在版本行 id，且 `kind ∈ { confirmed, user-edited }`；
  - `content`：编辑后的正文，≤20 万字（与分集分析输入上限对齐）；`note` ≤200 字。
- 校验（已冻结；rev6 按 Bugbot P2 改为归属优先，不变量 I6）：先按 `id` + `drama_id` 判定归属，再区分冲突码——
  - `expected_current_version_id` 不存在**于本项目**（不存在，或**属于其他项目**——跨项目版本 ID 一律 `400`，rev6）→ `400`；
  - 属于当前项目但**已不是当前有效正文**（并发下被其他请求切走）→ `409 VERSION_CONFLICT`；
  - 属于当前项目且为当前，但 `kind` 不是 `confirmed`/`user-edited` → `400`（不允许直接编辑 `cleaned`/`source`）。
- 行为（已冻结）：新建一行 `base_kind=user-edited` 版本，`content` = 请求正文，`parent_version_id` = 旧当前行 id，当前指针切换为新行；旧当前行完整保留（即「编辑前自动版本快照」）。
- 原子性（rev3；rev4 字段名统一；rev6 归属顺序）：按 §5.3 统一原子原语，事务内先 `SELECT ... FROM dramas WHERE id=? FOR UPDATE` 锁行，锁内按 `id` + `drama_id` 先判归属（`SELECT ... FROM source_versions WHERE id=? AND drama_id=?`；不属于本项目 → `400`；属于但 ≠ 当前指针 → `409`；kind 不合法 → `400`，均不 INSERT）；再 `INSERT` 新 `user-edited` 行并
  `UPDATE dramas SET current_source_version_id=?new_id WHERE id=? AND current_source_version_id=?expected_current_version_id`，**影响行数 = 1 才提交**（双保险）；影响行数 = 0 → `409` 并回滚。锁序保证并发编辑下败者 `409` 且不产生孤儿版本行（T11）。
- 响应 `200`：新版本对象。

#### `POST /dramas/:id/source/skip`

- 前置条件（rev4 定稿，响应 Codex rev3 复审 P1）：**当前有效正文 = `source`**（指针为 NULL 或指向 `kind=source` 行）时允许设置跳过标记。
  - 语义说明：skip 表达的是「在当前 `source` 正文上用户决定不整理、直接走分集」。rev3 的最严语义（「历史上出现过任何整理稿就永远不能 skip」）与全文「整理可选、`cleaned` 可放弃、可重跑」相冲突，且「重跑 clean 覆盖」与版本行不可覆盖/保留历史（§6.1）矛盾——试用过一次整理后用户将永久失去跳过入口。rev4 回正为**不用历史是否存在决定能否跳过**：已确认/已编辑（指针 = `confirmed`/`user-edited`）→ `400`，提示先经 `POST /dramas/:id/source/switch` 切回 `source`（§5.3）；存在未确认 `cleaned` 候选（指针仍 = `source`）**允许** skip，候选行保留为未采用历史，不删除、不阻塞后续确认。
  - 指针 = `confirmed`/`user-edited` → `400` 并提示：如需回到原文，请使用版本切换端点 `POST /dramas/:id/source/switch`（§5.3）。
- 请求体：`{ note?: string }`（≤200 字）。
- 行为：在项目记录中写入跳过整理标记（方向：`dramas` 新增列 `source_skip_at`，见 §6.1）；当前有效正文保持 = `source`。
- 取消标记：标记只在「当前有效正文 = `source`」时才有意义；任一动作把正文切离 `source`（发起 `clean`、`confirm` 成功、`PUT current` 成功、`switch` 切到非 `source` 行）时清除（rev4 定稿）。
- 响应 `200`：`{ skipped: true, current: "source" }`。

#### `POST /dramas/:id/source/switch`

显式版本切换：把「当前有效正文」指针切到历史某个已生效版本（回到 `source` 原文、或切回更早的 `confirmed`/`user-edited` 基线）。rev2 新增（响应 Hermes 复审 P0-6），承接「回退 / 回到原文 = 仅移动指针、不新建版本」的指针侧显式入口（§6.1 不变量 I8），并闭环「`confirmed` 后想回到原文」的状态机路径（P1-新1）。

- 请求体（rev3 定稿，响应 Codex P0-②）：`{ target_version_id: number, expected_current_version_id: number | null }`。
  - `target_version_id` = 目标版本行 `id`（要切到的行，主键兼版本序号，rev2 §6.1）；
  - `expected_current_version_id` = 调用方当前持有的指针值（取自已响应 `GET /versions` 的 `current.id`；`null` 表示调用方认为未整理）。rev2 单一 `expected_version` 无法区分「目标」与「当前」，两个 switch 并发会都 `200`、后写覆盖前写，已废除。
- 目标限定（已冻结；rev5 补 `drama_id`，响应 Bugbot P1-②）：`target_version_id` 行**属于路由项目**（`drama_id` = 当前项目 id，不变量 I6）且 `base_kind ∈ { source, confirmed, user-edited }`——只有已生效基线可被切为当前；**`cleaned` 行不可切换**（未确认不生效，与 §6.1「cleaned 永不成为 current」一致）；其他项目的合法版本行不可被切成本项目正文（跨项目 → `400`）。
- 三态返回表（rev3 定稿，已冻结）：

| 判定（锁内） | 返回 |
| --- | --- |
| 行存在、属于当前项目、`base_kind ∈ { source, confirmed, user-edited }`、`expected_current_version_id` = 当前指针、且 `target_version_id` ≠ 当前指针 | `200`：指针切至目标行；行内容不变、**不新建版本、不迁移 kind** |
| `target_version_id` = 当前指针（已指向目标，且 expected 匹配） | `200` 幂等，无变化 |
| 行存在、属于当前项目但 `base_kind = cleaned` | `400`：cleaned 未确认不得成为当前有效正文 |
| `target_version_id` / `expected_current_version_id` 不存在**于本项目**（不存在 / 属于其他项目，I6） | `400` |
| 行存在、属于当前项目且 kind 合法，但 `expected_current_version_id` ≠ 锁内读到的当前指针 | `409 VERSION_CONFLICT`：并发下指针已被其他请求切走（两个 switch 并发时后到者 `409`，T12） |

- 原子性（rev3 定稿；rev5 目标校验补 `drama_id`；rev7 expected 归属补全，响应 Bugbot 最终复核 P2，与返回表 400/409 行及 I6 对齐；rev8 第 4 步统一 CAS，响应 Bugbot rev7 最终复核 P1）——单事务内顺序执行：
  1. 锁 `dramas` 当前项目行（`SELECT ... FOR UPDATE`）；
  2. 按 `id` + `drama_id` 校验 `target_version_id`：不存在 / 属于其他项目 / `base_kind ∉ { source, confirmed, user-edited }` → `400`（`SELECT id, base_kind FROM source_versions WHERE id=? AND drama_id=?`）；
  3. `expected_current_version_id` 非 `null` 时，按 `id` + `drama_id` 校验归属：不存在 / 属于其他项目 → `400`（rev7，I6）；
  4. 统一 CAS 比较：无论 `expected_current_version_id` 是数字还是 `null`，只要 ≠ 锁内当前指针（`null` 对非 `null` current、或数字对 `null` current 均视为不等）→ `409`（rev8；`null` = 调用方认为当前无版本，锁内 current 已有版本即过期）；
  5. `UPDATE dramas SET current_source_version_id=?target WHERE id=?` → 提交。
  行锁 + 归属校验（target 与 expected 各一次）+ 旧指针校验三重保证，杜绝并发覆盖与跨项目切换；与 confirm / PUT current 的并发按锁序判定，T12 的 `409` 断言稳定可复现。
- 行为语义：switch 只移动指针，**不产生新版本行**，历史完整保留；被切走的旧当前行自动降为只读历史。切换后用户可继续 `clean`（基于新当前正文重新整理）；`skip` 仅当新当前 = `source` 时可用（rev4，P1）。
- 响应 `200`：`{ current: { kind: "source|confirmed|user-edited", id: 1 } }`。

### 5.4 与分集端点的衔接（已冻结）

- 「智能分集」按钮在确认稿/编辑稿/跳过整理状态下行为一致：前端把**当前有效正文**（`current_source_version_id` 指向行的 `content`；NULL 时为 `dramas.description`）传给现有 `analyze-episodes` 的 `content`；分集草稿保存逻辑（`source_hash` 与 `content_fingerprint`，见 `episode-plan-draft.ts`）本身不变。
- 哈希语义（rev1，响应 P1-1）：`episode_plan_drafts.source_hash` 的列名沿用现状，本文统一解释为「**分集输入正文哈希**」= 当前有效正文的 `content_hash`（算法不变：`sha256(String(content || '').trim())`，与现有 `sourceHash()`（`backend/src/services/episode-plan-draft.ts`）算法一致）。检测对象由「固定 `dramas.description`」改为「当前有效正文」：
  - 未整理旧项目：当前有效正文 = `description`（raw），哈希按 canonical 口径（trim）计算，与现状 `sourceHash` 结果一致、零回归（§5.2/T9）；
  - 整理/编辑/回退后：`confirm`、`PUT current`、`POST switch`（rev2）切换当前指针即改变哈希 → 既有「全文已变化，请重新生成分集建议」的 409 语义自然延续到确认稿/编辑稿/切回稿，不产生误报与漏报。
- `from-plan` 的正文读取与哈希校验同步以当前有效正文为对象（rev3，§5.2 必改点 1），把「从确认稿/编辑稿生成剧集」补成闭环；未整理项目仍 = `dramas.description`（canonical trim 口径），零回归。
- 存储列不另设 `source_hash`；版本行哈希字段为 `content_hash`/`base_hash`（定义见 §6.1）。

---

## 6. 数据字段类型与迁移方向（实施拆分时细化，方向已冻结）

### 6.1 新增存储（不实施）

#### `source_versions` 正文版本表（rev4 定稿）

选型（响应 Hermes P0-1 / P0-2，rev1 冻结；rev2 修订序号分配机制；rev4 行完全不可变）：**版本行完全不可变（`content` 与 `base_kind` 均不更新，无任何原地状态迁移）+ 版本序号 = 自增主键 `id`**；正文状态转换两分（不变量 I8，rev6 措辞对齐 P2-A）：**新增类 = 新建版本行 + 切换 `dramas.current_source_version_id` 指针**（懒生成 `source` 行 / clean 产出 `cleaned` / confirm 派生 `confirmed` / PUT current 派生 `user-edited`）；**回退类 = `switch` 仅移动指针，不新建版本行**（rev2 §5.3）。不做同表唯一键技巧。rev3 及更早的「`cleaned → confirmed` 原地迁移」已作废（P0 版本谱系，见 §10）。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `INT` NOT NULL AUTO_INCREMENT | 版本行主键，同时兼作**版本序号**（rev2，P0-5：由数据库自增分配，天然无并发撞号；同一项目内严格递增、可排序、不复用；`MAX(version_seq)+1` 事务内取值方案已废止，见否决备选） |
| `drama_id` | `INT` NOT NULL | 关联 `dramas.id` |
| `base_kind` | `VARCHAR(16)` NOT NULL | `source / cleaned / confirmed / user-edited`；**行创建后永不变更**（rev4：含 `cleaned`，无任何 kind 原地迁移） |
| `content` | **`LONGTEXT`** NOT NULL | 版本全文 = 规范化输入（`String(content).trim()`，rev3 §3.3，与 `content_hash` 同基准；`clean_text` 一律用 `LONGTEXT`，不落 `TEXT`，对齐 roadmap §4.1 工程修正） |
| `content_hash` | `VARCHAR(64)` NOT NULL | `sha256(String(content || '').trim())`（算法与现有 `sourceHash` 一致），恒为本行 `content` 的哈希（不变量 I1）；「全文变化检测」与定位的哈希依据 |
| `base_hash` | `VARCHAR(64)` NOT NULL | `base_kind=source` 行 = 自身 `content_hash`；其余行 = `parent_version_id` 指向行的 `content_hash`；用于跨版本完整性与 §2.1 可复现校验（`confirmed` 派生行 = target `cleaned` 的 `content_hash`，内容相同故 `base_hash = content_hash`） |
| `parent_version_id` | `INT` NULL | 前驱版本行 id（`source` 首行为 NULL；`cleaned` 行 = 任务启动时的输入基线版本（rev4 §5.3 clean）；`confirmed` 派生行 = 其确认来源 `cleaned` 行 id（rev4 §5.3 confirm）；`user-edited` 行 = 编辑前当前行 id） |
| `diff` | `LONGTEXT` NULL | 整理类版本（`cleaned`）的删除区间/差异 JSON（形状见 §5.3 versions 示例：`{ removals: [{ start, end, snippet, category }], removed_chars }`），坐标相对**其直接 parent 行 content（= 任务输入基线，不变量 I3）**；`confirmed` 派生行与直接 parent（target `cleaned`）内容相同 → `diff` = **identity** `{ removals: [], removed_chars: 0 }`，**不复制** target 的 `diff`/`stats`（target 的 diff 相对更早的输入基线，复制会破坏「diff 恒相对直接 parent」的统一语义，rev5 响应 Bugbot P1-④）；`source` 首行与 **`user-edited` 行**（人工编辑不承诺删除区间格式差异，§2.2）= `null`，正文以 `content` 为准 |
| `stats` | `TEXT` NULL | 删除统计 JSON（按 §2.1 分类）；与 `diff` 同一基准（`confirmed` 为 identity 空统计；展示整理成果经 parent 行读取，I3） |
| `created_at` / `updated_at` | `VARCHAR(64)` NOT NULL | 与现有表时间格式一致（ISO 字符串；时间列类型取舍见 §10 P2 登记） |

约束与索引（rev2 定稿）：

- 版本序号与唯一性（rev2，P0-5）：主键 `id` 全局 AUTO_INCREMENT 即版本序号，天然唯一且按插入顺序递增，**无需任何 drama 级序号唯一键**；rev1 的 `uk_source_versions_seq (drama_id, version_seq)` 随 `version_seq` 列撤销。**不设 `(drama_id, base_kind, …)` 类唯一**——同一 kind 存在多行历史是常态（重跑清理、重复编辑），rev0 的 `(drama_id, kind)` 方案与「保留版本历史」直接矛盾（P0-1）。
- 普通索引：`idx_source_versions_drama (drama_id)`、`idx_source_versions_parent (parent_version_id)`。
- **无 `deleted_at`，行完全不可变**（rev1 确立、rev4 收紧）：版本行一经创建不可删除、`content` 与 `base_kind` 均不可更新（rev3 及更早「仅 `base_kind` 状态迁移」作废）。正文状态转换两分（rev5 响应 Bugbot P2-②，不变量 I8）：**编辑 / 确认 = 新建派生版本行 + 切换指针**（`PUT current` / `confirm`）；**回退 / 回到原文 = 仅移动当前指针**（`POST /dramas/:id/source/switch`，**不新建版本、不删除、不覆盖**，rev2 §5.3）；「放弃未确认候选」= 不确认或重跑 `clean` 产出新候选，不删除历史行。以上一律不清历史，与 §0.2/§8 D 系列禁区一致；历史清理机制留待授权后另立决策（见 §10）。rev0 的「`deleted_at` + 唯一键软删重建」在 MySQL 上软删后重建会撞唯一键，且变相暗示清理流程（P0-2），已废止。
- 当前有效正文指针：`dramas` 新增列 `current_source_version_id INT NULL`（方向）。`NULL` = 未整理/旧项目 → 有效正文 = `dramas.description`（raw；读取时按 canonical 口径 trim，§1.1，零回填兼容位，§6.3）。`cleaned` 行永不成为 current（未确认不生效，`GET /versions` 的 `current.kind` 枚举不含 `cleaned`）；指针变化时机（rev4）：「懒生成 `source` 行 / confirm 新建 `confirmed` 派生行（rev4）/ PUT current 新建 `user-edited` / **switch 显式切换（rev2）**」。
- 跳过整理标记：`dramas` 新增列 `source_skip_at VARCHAR(64) NULL`（方向，§5.3 skip）。

**字段语义单一来源与跨章不变量（rev5 新增，响应 Bugbot rev4 复审根因）**：本文 §1–§7 中凡涉及字段/公式（`content_hash`、`base_hash`、`diff`、`parent_version_id`、当前指针、删除区间坐标、新建 vs 移动、规范化输入）的表述，一律以本表为**唯一权威定义**；任一处文字与本表冲突即为文档缺陷，修订后必须逐条重放核对。目的是让「同类不一致」不再只能靠外部复审逐轮暴露：

| 编号 | 不变量（冻结） | 权威落点 | 违反后果 |
| --- | --- | --- | --- |
| I1 | `content_hash` 恒 = `sha256(String(content \|\| '').trim())`，是**本行 content** 的哈希；任何行（含 cleaned / confirmed 派生行）不例外 | §5.3 clean；§6.1 字段表 | `from-plan` 全文变化检测误报（正文与哈希不一致 → 固定 409） |
| I2 | `base_hash` = `parent_version_id` 指向行的 `content_hash`；`source` 首行（parent 为 NULL）`base_hash = content_hash` | §5.3 clean；§6.1 字段表 | 跨版本完整性校验失真 |
| I3 | `diff`/`stats` 的坐标与统计恒相对**本行直接 parent 行 content**（= 该行产生时的任务输入基线）；confirmed 与直接 parent 内容相同 → `diff` = identity（`{ removals: [], removed_chars: 0 }`），不复制 target 的 diff | §2.1 质量门；§5.3 clean/confirm/versions；§6.1 字段表 | 删除区间坐标错位、误拒绝合法整理、parent/diff 链语义分裂 |
| I4 | `parent_version_id` 恒指向**同一 drama_id** 内的版本行；`source` 首行为 NULL | §5.3 confirm/switch/versions；§6.1 | 版本链跨项目错挂 |
| I5 | 当前指针（`dramas.current_source_version_id`）只能指向 `kind ∈ { source, confirmed, user-edited }`；`cleaned` 永不成为 current | §5.3 versions/confirm/switch；§6.1 | 未确认候选被当作有效正文 |
| I6 | 任何按版本行 id 检索的请求参数（`target_version_id`、`expected_current_version_id` 的比较对象）必须带 `drama_id` = 路由项目 id 判定；跨项目 → `400` | §5.3 confirm/switch/PUT current；§7.2 T7/T12 | 他项目合法版本被切/被确认到本项目 |
| I7 | 版本行完全不可变：`content`/`base_kind`/`content_hash`/`base_hash`/`diff`/`stats` 一经 INSERT 不再 UPDATE（无原地迁移、无软删） | §6.1 选型与约束 | 版本谱系倒退（rev4 已修问题的复发） |
| I8 | 正文状态转换两分：**编辑/确认 = 新建派生行 + 切指针**（`PUT current`/`confirm`）；**回退/回到原文 = 仅移动指针**（`switch`），后者不新建、不删除、不覆盖 | §5.3 confirm/PUT current/switch；§6.1 | 历史被改写 / 契约措辞自相矛盾 |
| I9 | 规范化输入口径：版本行 `content` 恒存 canonical（`String(x).trim()` 后）；raw `dramas.description` 仅在未懒生成时作为读取对象，且哈希/切分按同一 trim 口径 | §1.1；§3.3；§5.4 | 「原文/逐字节」断言基准漂移 |

否决备选（rev1 记录，避免实施 PR 回头纠结）：`is_current` 单行置 1 + 历史置 NULL 的唯一键技巧依赖 MySQL「唯一索引允许多 NULL」语义，理解与实现成本高于「指针列放 `dramas`」，否决。
否决备选（rev2 记录，P0-5）：保留独立 `version_seq` 列并让事务内 `SELECT MAX(version_seq)+1` 取值——REPEATABLE READ 下两个并发事务可读到同一 MAX，后写者撞键（P0-5）；而 MySQL 每表仅允许一个 AUTO_INCREMENT 列且须为索引最左列，`id` 与 `version_seq` 无法同时自增。故采用「主键 `id` 自增兼版本序号」，废除独立序号列；Hermes 给的方案 B（`SELECT MAX(...) FOR UPDATE` 行锁串行化）正确但慢，未采纳。

### 6.2 与既有表的关系（已冻结）

- `dramas.description`（LONGTEXT）继续作为「项目创建/导入时的原文落点」与旧项目兼容位；整理后**不回写** `description`，避免破坏 `episodes.content` 与现有分集/剧本链路。
- `episodes.content`（LONGTEXT）语义不变：仍为剧集正文；整理/版本表与剧集表通过「项目级」关联，不逐集复制版本状态。
- 章节/段落锚点索引建议入独立表（`source_anchors`：`drama_id, version_id, para_id, anchor_text, hash, start, end, sort_order`），锚点表在实施拆分时落库；该表不承载正文，正文权威为「当前有效正文」（`current_source_version_id` 指向行；NULL 时为 `dramas.description`，见 §6.1）。

### 6.3 迁移与回填（已冻结）

- 旧项目零回填：无 `source_versions` 记录的项目全部按 `source` 处理，链路与现状一致（§5.2）。
- `source` 行懒生成（rev1；rev3 补并发防重）：不为存量项目批量建行；当项目首次发起健康检查 / 整理 / 或 `analyze-episodes` 首次携带正文时，由后端把当前有效正文（此时 = `dramas.description`）落为 `base_kind=source` 首行并回填 `current_source_version_id`。并发防重（rev3）：懒生成遵循 §5.3 统一原子原语——事务内锁 `dramas` 行后判定「该项目是否已有任意版本行」，无则 INSERT + 回填，有则跳过，避免并发首次访问产生重复 `source` 行。`POST /dramas` 行为不变（正文仍写 `description`），避免改变现状创建链路。
- 迁移文件遵循仓库现状：不引入独立迁移工具，DDL 在 `mysql-schema.ts` 的幂等 `initMySqlSchema` 流程追加（`db/index.ts` 启动调用），保证对已存在旧库可重复执行；`source_versions`/新增列用 `CREATE TABLE IF NOT EXISTS` / `information_schema.COLUMNS` 判存的幂等 ALTER（沿用 `sys_task` 恢复租约列的既有模式）。

---

## 7. 测试矩阵与代表样本验收

### 7.1 回归基线（由后续实施 PR 执行并保持绿色，与本文所在 PR 无关；命令照抄）

- `cd backend && npm run typecheck`
- `cd backend && npm test`（当前含 MySQL service 与无 MySQL 两态；与分集/导入最相关的用例：`source-import-and-episode-planning.test.mjs`、`episode-plan-draft-behavior.test.mjs`、`project-analyzer-structure.test.mjs`、`h3-source-behavior.test.mjs`、`assets-tasks-pagination-structure.test.mjs`）
- 前端结构测试基线维持 roadmap §4.1 记录的 148/148（实施任务触碰前端时复核更新）。

### 7.2 新增测试矩阵（契约 → 实施任务承接，每条标注可自动执行）

| # | 层 | 用例 | 断言 |
| --- | --- | --- | --- |
| T1 | 纯函数（定位） | 锚点四件套计算 | 稳定段落 ID 对同段重复计算一致；不同段冲突概率受哈希前缀控制 |
| T2 | 纯函数（切片一致性） | 确认稿进入 `splitSourceIntoEpisodes` | 按集拼接 = 规范化输入（`String(content).trim()` 基准，rev3）；`character_count` 和=规范化输入长度；段落不重复；输入含首尾空白/段间空行时不丢内容 |
| T3 | 纯函数（可复现性） | 同一任务输入基线+同一删除区间集合跑两次整理校验 | 两次 `cleaned` 逐字节相等（输入基线 = clean 启动时当前有效正文快照 = 结果行 parent content，§6.1 I3，rev5） |
| T4 | 纯函数（质量门） | 删除区间含重叠/越界/找不到 snippet 的非法集 | 校验拒绝并给出具体错误 |
| T5 | 路由（健康检查） | clean/issues 两态响应 | 无模型调用；issues 分类计数正确 |
| T6 | 路由（clean） | 发起/重跑/并发 | running/already_running；旧版本不被覆盖；任务完成后新 cleaned 行 `parent_version_id` = 启动时当前正文行、`content_hash` = `sha256(cleaned.content)`、`base_hash` = 该 parent 行的 `content_hash`（rev5 P1-①，§6.1 I1/I2/I3） |
| T7 | 路由（confirm） | 锁内校验 + 派生 confirmed | 确认最新候选 cleaned → 200：新建 `confirmed` 派生行（parent=target、`diff`/`stats`=identity）、指针切换、cleaned 原行保留（rev4/rev5）；确认后 `GET /versions`：confirmed 行 `parent_version_id` = 其 target cleaned 行 id、`base_hash` = 该 parent 的 `content_hash`、`diff` = identity（rev5 P2-①）；确认 #11 后再确认旧 #10 → 409（非其 parent 下最新，rev4）；`expected_current_version_id` 过期 → 409；target 不存在 / 非 cleaned / **属于其他项目** → 400（rev5 P1-②）；confirm 成功清除 skip 标记 |
| T8 | 路由（skip） | 跳过整理 | 当前=source（含存在未确认 cleaned 候选）→ 200 记录标记，候选保留为未采用历史（rev4）；当前=confirmed/user-edited → 400 提示先 switch 回 source；clean/confirm/PUT current/switch 把正文切离 source 时清除标记 |
| T9 | 集成（旧项目） | 无版本记录项目完整走分集 | 行为与现状基线一致（逐接口 diff 为空） |
| T10 | 路由（user-edited） | `PUT /source/current` 编辑切换 | confirmed 编辑后新建 `user-edited` 行、指针切换、旧行保留为快照；重复编辑产生第二条 user-edited；`expected_current_version_id` 不存在或**属于其他项目** → 400（rev6，I6）；属于本项目但已非当前指针（并发切走）→ 409；对 `cleaned`/`source` 行编辑 → 400 |
| T11 | 路由（并发） | confirm / PUT current 并发 | 同一 cleaned 并发 confirm 两次，第二个按锁序 409（rev4 锁内判定）；clean 基于 A 启动、期间 switch 到 B、再 confirm A 的结果 → 409（parent 基线不符，rev4）；PUT current 并发切换，败者 409 且不产生孤儿版本行 |
| T12 | 路由（switch） | `POST /source/switch` 版本切换 | 从 confirmed 切回 `source` 行 → 200 且 current=source、不新建版本行；切 `cleaned` 行 → 400；`target_version_id` 不存在或**属于其他项目** → 400（rev5 P1-②）；`expected_current_version_id` 不存在 / **属于其他项目**（跨项目真实版本 ID）→ 400（rev7，I6）；target = 当前指针（expected 匹配）→ 幂等 200；`expected_current_version_id` 与锁内当前指针不等 → 409——含：数字过期（两个 switch 并发 / 与 PUT current 并发，后到者 409，rev3）、**`null` vs 锁内 current 已有版本**（调用方未整理视角过期，rev8）；switch 后旧当前行降为只读历史、再 `clean`+`confirm` 状态机可重新走通（P0-6 / P1-新1 闭环） |

### 7.3 三个代表样本（roadmap §6「真实基线」先行对象）

| 样本 | 特征 | 验收判据 |
| --- | --- | --- |
| S1 干净短文 | 无噪声、段落规整（≤1 万字） | 健康检查 `clean`；分集直接走现状链路；无整理提示 |
| S2 噪声网文 | 含章节号/作者话/广告/水印/重复段（2–5 万字） | AI 整理只删噪声不改正文；每条 `removed.snippet` 可定位、区间不重叠；`cleaned` 可复现；对 `confirmed` 分集无漏字/重复 |
| S3 长篇 | 3–4 万字真实长文 | 分段处理有进度与成本提示；中断后可恢复；边界降级可用；确认稿分集一致性断言全过 |

每个样本验收结果记录到迭代台账（数据来自真实运行，非合成断言），作为后续质量统计基线（roadmap §10 指标采集）。

---

## 8. 验收标准（对应 Issue #61，逐条可勾选）

- [ ] 状态与接口闭环：source/cleaned/confirmed/user-edited/skip 全路径可在 §5.3 接口上走通（`user-edited` 入口 = `PUT /dramas/:id/source/current`；版本切换/回到原文入口 = `POST /dramas/:id/source/switch`，T12 覆盖），无「已拍板/候选」混写（候选仅出现在 §4.2/§6 明确标注的「实施拆分时细化」条目内）。
- [ ] 自动整理不误改正文：质量门 §2.1 四条可测；§3.3 一致性断言可测。
- [ ] 人工编辑后不再执行严格相减证明：状态切换由 T10（`PUT /source/current` 编辑 → user-edited + 快照保留）、T11（并发 409）与 T12（switch 版本切换/回到原文）覆盖；T9 保证旧项目路径不回归。
- [ ] 分集顺序不变、不漏字、不重复：T2 + S2/S3 全覆盖。
- [ ] 定位失败可降级：§3.4 有实现路径与用例（T2 unresolved 分支）。
- [ ] 旧项目与跳过整理保持现有行为：§5.2 兼容规则 + T9。
- [ ] 从整理稿出剧集闭环：`from-plan` 正文读取与哈希校验以当前有效正文为对象（§5.2 必改点 1），确认稿/编辑稿项目可正常生成剧集；旧项目/跳过整理走 `dramas.description` 回退，行为零回归。
- [ ] 每项验收可落成后续自动测试或代表样本测试：§7.2 矩阵全部标注可执行。
- [ ] PR 只包含契约文档及必要索引，不包含运行时代码。

---

## 9. 实施拆分方向（契约合入后由主账号发布 Issue，不占本期）

1. **DB 版本表迁移任务**：`source_versions` + 锚点表幂等 DDL（热点：`backend/src/db/`）。
2. **后端健康检查/整理任务**：规则型健康检查、AI 整理任务化、质量门校验器、版本写入（热点：`backend/src/routes/dramas.ts`、`services/`、`utils/` 共享工具区）。
3. **Agent 与锚点**：整理 Agent（或并入现有 Agent 体系）、段落锚点服务、`mastra/index.ts` 挂载（roadmap §4.1 锚点落点）。
4. **前端步骤**：检查/整理/确认向导与版本查看（热点：`frontend/app/views/drama/detail.vue` 巨型页、`useApi.ts`）。
5. **代表样本与质量基线**：S1/S2/S3 跑通并记录到台账（不与 1–4 抢热点）。

> 以上仅为后续拆分建议；实际以主账号按任务认领制发布的 Issue 为准。本文合入前不得改动任何热点文件。

---

## 10. 评审修订登记（Hermes PR #63 + Codex 接管复审，2026-09-05）

### 10.1 已修复 / 已吸收

**rev1（commit `6b7cc13`，响应初评）**：

| 编号 | 评审项 | 落点 |
| --- | --- | --- |
| P0-1 | `(drama_id, kind)` 唯一键与「保留版本历史 / 重跑清理」矛盾 | §6.1 定稿：项目内全局单调 `version_seq` + `uk(drama_id, version_seq)`，不设 kind 类唯一 |
| P0-2 | `deleted_at` + 唯一键软删死锁且暗示 D 系列清理 | §6.1 定稿：无 `deleted_at`，版本不可删，回退=新版本+切指针 |
| P0-3 | `confirmed → user-edited` 无端点入口 | §5.3 新增 `PUT /dramas/:id/source/current`；§2.2 回链 |
| P0-4 | `expected_version` 语义与并发返回码未定 | §5.3 confirm 三态返回表 + 原子性条件 UPDATE；字段语义=版本行 id |
| P1-1 | `source_hash` 字段名语义偷换 | §5.4/§6.1 引入 `content_hash`/`base_hash`，`episode_plan_drafts.source_hash` 解释为「分集输入正文哈希」，未整理旧项目逐字节一致 |
| P1-4 | 承诺进度暴露但无查询端点 | §4.3/§5.3 写死复用现有 `GET /tasks/:id`（`sys_task.id` 即 `task_key`） |
| P1-5 | 测试矩阵漏 `user-edited` 路径 | §7.2 新增 T10（并补 T11 并发） |

**rev2（本节修订，响应 Hermes 复审，2026-09-05）**：

| 编号 | 评审项 | 落点 |
| --- | --- | --- |
| P0-5 | `version_seq` 用 `MAX(version_seq)+1` 并发撞号 | §6.1 定稿：版本序号并入自增主键 `id`（AUTO_INCREMENT 由库分配），废除独立 `version_seq` 列与 `uk_source_versions_seq`；否决备选记录理由 |
| P0-6 | skip 承诺「版本切换」但契约无该端点 | §5.3 新增 `POST /dramas/:id/source/switch` 完整定义（三态返回表 + 原子性 UPDATE 指针）；skip 提示改指端点；§1.1 状态约束 / §6.1 指针时机联动；§7.2 新增 T12 |
| P1-新1 | `PUT current` 与 skip 状态机死锁（confirmed 后无法回 source） | 随 P0-6 方案 A 自动闭环：`switch` 可切回 `source` 行，T12 断言；无需单独立项 |

**rev3（本节修订，响应 Codex 接管复审 head `8bfd68c`，2026-09-05）**：

| 编号 | 评审项 | 落点 |
| --- | --- | --- |
| P0-① | confirm 条件 UPDATE 未锁项目行，「非最新必须 409」在并发不同 cleaned 下不可稳定复现 | §5.3 统一原子原语：所有指针写端点（clean 懒生成/confirm/PUT current/switch）事务内先 `SELECT ... FOR UPDATE` 锁 `dramas` 行再判定；confirm 三态改为锁内判定（rev2「UPDATE 后补 SELECT 区分 400/409」废除） |
| P0-② | switch 请求体无「调用方当前版本」，UPDATE 无法检测并发覆盖、T12 的 409 承诺不成立 | §5.3 switch 重写：请求体拆 `target_version_id` + `expected_current_version_id`；锁行 + 旧指针校验，409/幂等 200 语义写死 |
| P0-③ | §5.2 冻结 from-plan「行为零变化」与 §5.4「读取当前有效正文」冲突 | §5.2 from-plan 移出零变化清单，列为 v0.4 唯二必改点之一（读取+哈希校验对象 = 当前有效正文，旧项目 `description` 回退分支保留）；§5.4 回链；§8 验收补闭环条目 |
| P0-④ | T2「拼接=输入」与现状 trim 行为（输入整体 trim + 单集二次 trim）冲突 | §3.3 冻结规范化输入 `String(content).trim()`（版本/哈希/切片/断言同基准）；§5.2 必改点 2：保留段间换行、`normalizeReviewablePlan` 不再整篇二次 trim |
| P0-⑤ | skip 前置条件自相矛盾（clean 后指针=source 但「已有整理稿 400」同时成立） | §5.3 skip 定稿最严语义：仅「从未产生任何整理稿」时允许（存在未确认 cleaned 也 400） |
| P1-① | §3.3「AI 建议边界」超出 Agent 现状输出（集数/标题/摘要） | §0.1/§3.3 措辞降级为「AI 推荐集数与摘要 + 后端确定性切片」，不承诺 Agent 输出字符级边界 |
| P1-② | §2.1-5「章节标题不丢弃」与删除区间分类含 `chapter_marker` 冲突 | §2.1/§5.3：删除区间分类冻结 `{ad, watermark, duplicate, garbage}`，`chapter_marker` 仅检出/锚点，不入删除区间；health-check issues type 同步移除 |

**rev4（本节修订，响应 Codex rev3 复审 head `aaf50b4`，2026-09-05，最后一次契约收口）**：

| 编号 | 评审项 | 落点 |
| --- | --- | --- |
| P0（版本谱系） | confirm 原地迁移 cleaned 使旧 cleaned 重成 MAX、可再确认导致正文倒退；异步 clean 候选不绑定启动基线，id 最大即可覆盖新正文 | §5.3 confirm 重写：**版本行完全不可变**，confirm = 以 target `cleaned` 为 parent 新建 `confirmed` 派生行并切指针（cleaned 原行保留）；请求体拆 `target_version_id` + `expected_current_version_id`；锁内校验当前指针 / target=cleaned / `target.parent`=当前有效正文 / target=其 parent 下最新 cleaned；§5.3 clean 记录启动基线（`parent_version_id`）；§6.1 选型、`base_kind` 列、无 `deleted_at`、指针时机全部移除原地迁移描述；§5.3 统一原语同步 |
| P1-① | skip「出现过整理稿即永久禁止」与「cleaned 可放弃/整理可选」冲突，且「重跑 clean 覆盖」与保留历史矛盾 | §5.3 skip 回正：current=source 即可设置标记，存在未确认 cleaned 也允许（保留为未采用历史）；正文切离 source（clean/confirm/PUT current/switch）时清除标记；T8 同步 |
| P1-② | source 定义「导入原样」与版本行 `content=String(x).trim()` 冲突 | §1.1 区分 raw（`dramas.description`）与 canonical（`source_versions.content` = trim 后），全文「原文/逐字节」断言统一指向 canonical；§2.1 可复现、§5.2 兼容规则、§5.4 哈希措辞同步 |
| P2 | `GET /versions` 的 `current.kind` 枚举含 cleaned，与「cleaned 永不成为 current」矛盾 | §5.3 versions 响应枚举移除 cleaned；§6.1 指针说明同步 |

**rev5（本节修订，响应 Bugbot rev4 复审 head `59463d5`，2026-09-05，字段语义单一来源收口）**：

| 编号 | 评审项 | 落点 |
| --- | --- | --- |
| P1-① | clean 段把 `cleaned.content_hash` 写成任务基线正文的哈希，与 §6.1「content_hash = 本行 content 哈希」冲突（实际删除后正文与哈希不一致 → from-plan 固定 409） | §5.3 clean 重写：`content_hash` = `sha256(cleaned.content)`，基线记录统一走 `parent_version_id` + `base_hash`；rev4「content_hash 同步为基线哈希」废除；T6 断言同步；I1/I2 |
| P1-② | switch 只校验 target 的 kind，未校验 `drama_id`，他项目合法版本行可被切为本项目正文（confirm 同源） | §5.3 switch/confirm 目标校验补「`drama_id` = 路由项目」，跨项目 `400`（锁内 `SELECT ... WHERE id=? AND drama_id=?`）；返回表与原子性同步；T7/T12 补断言；I6 |
| P1-③ | 质量门 `cleaned = canonical source − removals` 与「clean 可基于 confirmed/user-edited 二次整理」冲突（删除区间应相对任务输入基线，非最初 source） | §2.1 质量门四条（可定位/不重叠/可复现/不改写）统一相对「任务输入基线 = 结果行 parent content」；T3 同步；I3 |
| P1-④ | confirmed 派生行复制 target cleaned 的 diff，但该 diff 相对 cleaned 的 parent（更早基线），破坏 parent/base_hash/diff 统一语义 | §5.3 confirm 成功行与 §6.1 `diff`/`stats` 列：confirmed = identity（内容与直接 parent=cleaned 相同），不复制 target 的 diff/stats；展示整理成果经 parent（cleaned）行读取；T7 断言；I3 |
| P2-① | versions 每行响应缺 `parent_version_id`，多 parent 候选下无法确定 diff 基线 | §5.3 versions 响应示例与字段说明补 `parent_version_id`（每行必返、坐标/哈希基准 = 该 parent 行）；T7 补接口断言；I3/I4 |
| P2-② | §6.1「放弃/回退/回到原文一律新建版本 + 切指针」与 switch「不新建版本行」及 T12 冲突 | §6.1 无 `deleted_at` 段与 §5.3 switch 引言措辞修正：**编辑/确认 = 新建派生行 + 切指针**；**回退/回到原文 = 仅移动指针（switch，不新建/不删除/不覆盖）**；I8 |
| 根治 | 同类字段/公式级不一致（content_hash 语义、diff 基线、parent 归属、跨项目检索、新建 vs 移动）多轮靠外部复审逐条暴露，根因是缺少跨章单一权威定义与修订重放清单 | §6.1 新增「字段语义单一来源与跨章不变量」I1–I9（唯一权威，冲突以本表为准，修订后逐条重放）；文档头修订记录同步 |

**rev6（本节修订，响应 Bugbot rev5 复审 head `56da3df`，2026-09-05，收口清零）**：

| 编号 | 评审项 | 落点 |
| --- | --- | --- |
| P2-A | §6.1 选型段「所有正文状态转换一律新建版本行 + 切指针」括注又含「switch 只移指针」，与 I8 / §5.3 / T12 冲突 | §6.1 选型句两分：**新增类**（懒生成 `source` / clean / confirm / PUT current）= 新建版本行 + 切指针；**回退类**（`switch`）= 仅移动指针、不新建版本行（I8） |
| P2-B | `PUT current` 对 `expected_current_version_id` 仍是「存在但不是当前 → 409」；传入他项目真实存在的版本 ID 也走 409，与 I6「跨项目一律 400」冲突 | §5.3 PUT current 校验改**归属优先**：先按 `id` + `drama_id` 判定（不存在或属于其他项目 → `400`），属于当前项目但非当前指针 → `409`，kind 不合法 → `400`；原子性段与 §7.2 T10 断言同步（I6）。**平行落实**：confirm 锁内校验 1 与 switch 返回表同样按归属先行（409 行限定「属于当前项目」，400 行覆盖跨项目的 target/expected），杜绝同缺口在含版本 id 参数端点重现 |

**rev7（本节修订，响应 Bugbot rev6 最终复核 head `cc9c26e`，2026-09-05，switch expected 归属收口）**：

| 编号 | 评审项 | 落点 |
| --- | --- | --- |
| P2 | switch 原子流程只按 `id` + `drama_id` 校验 `target_version_id`，随后直接比较 `expected_current_version_id` 与当前指针；跨项目真实存在的 expected 版本 ID 会走 409，与返回表 §5.3-355 及 I6「跨项目一律 400」不符 | §5.3 switch 原子性补全 5 步：锁 `dramas` 行 → target 按 `id`+`drama_id` 归属/kind 校验（400）→ expected 非 `null` 时按 `id`+`drama_id` 归属校验（400）→ 属于本项目但不等于锁内当前指针 → `409` → `UPDATE` 提交；§7.2 T12 补「跨项目 expected → 400」断言 |

**rev8（本节修订，响应 Bugbot rev7 最终复核 head `1053830`，2026-09-05，switch CAS 统一含 null）**：

| 编号 | 评审项 | 落点 |
| --- | --- | --- |
| P1 | switch 原子性第 4 步把 CAS 冲突判断限定为「expected 属于本项目」；expected=null 时该前置不成立 → 不返回 409、继续更新指针，绕过乐观并发控制；且与返回表「expected ≠ 当前指针 → 409」矛盾 | §5.3 switch 原子性第 4 步改**统一 CAS**：无论 expected 是数字还是 `null`，只要 ≠ 锁内当前指针（`null` vs 非 `null` 视为不等）→ `409`；第 3 步归属检查仅限非 `null` expected。confirm 锁内校验 1 与返回表 409 行同构澄清（null 参与统一 CAS）。§7.2 T12 补「expected=null 且锁内 current 已有版本 → 409」 |

### 10.2 登记 v0.4.1 修正式（后续独立 PR，本文不再扩大范围）

- **P1-2**：§3.1 段落稳定 ID 的 sha256 前缀碰撞预算（建议同项目碰撞概率 < 1e-6）与碰撞降级路径（回退 `[start, end)` + 段首短锚）。
- **P1-3**：补 §4.5「重试契约」——重试上限与退避、幂等键（`task_key` vs `source_hash + model`）、付费调用是否重试的取舍。
- **P1-6**：§9 实施拆分条目标注 `blocks / blocked-by` 依赖顺序（§9.2 涉及 `backend/src/utils/` 共享工具区，需与 Fork B #59/#62 协调热点）。
- **P1-新2（复审）**：§4.3/§4.5 明确 `sys_task` 字段复用规则（`status`/`progress`/`error`/`result` 为视频任务语义）+「running」判定条件（是 `sys_task.status=running`，还是存在未完成历史任务）+ 并发重跑幂等（是否产生两个 `sys_task` 行）；与 P1-3 一起打包 v0.4.1 修正式。

### 10.3 P2 意见（提交 owner 裁决时知情即可，不在本契约占位）

- §5.3 `health-check` 等只读端点使用 POST 的 REST 语义说明（用 POST 系因可选请求体；是否改 GET 由实施任务裁决）。
- `created_at`/`updated_at` 用 `VARCHAR(64)` 存储时间：为对齐现有表可保留，但时间倒序仅能字符串比较；是否切 `DATETIME`/`BIGINT` 由 DB 实施任务评估后裁决。
- §3.1 段首短锚兜底规则：空白段 / 短于 12 字符的段如何取锚。
- §7.1 回归清单是否覆盖 `backend/tests` 全量：实施 PR 应在触碰对应模块时补充说明。
- §0.2（本 PR 范围）与 §7.1（实施 PR 范围）的范围澄清：已在 rev1 落地于 §0.3，本条不再作为待裁决项。
