# 原文整理与智能分集 v0.4 需求与契约

> 版本：v0.4-rev1（契约稿，待 Hermes 复审 → Bugbot 复审 → owner 最终裁决）
> 日期：2026-09-04（初稿）/ 2026-09-05（rev1，响应 PR #63 Hermes 技术评审）
> 修订记录：rev1 修复 P0-1/P0-2（§6.1 表结构选型与存储约束重写）、P0-3（§5.3 新增 `PUT /dramas/:id/source/current` + T10）、P0-4（§5.3 confirm 三态返回与原子性 UPDATE + T11）；同步吸收与本次表/端点修改同源的 P1-1（`source_hash` → `content_hash`/`base_hash`）、P1-4（整理任务进度复用 `GET /tasks/:id`）、P1-5（`user-edited` 测试缺口随 T10 补齐）；其余 P1-2/P1-3/P1-6 与 P2 各项登记为 v0.4.1 修正式 / owner 裁决意见（见 §10）。
> 关联：`docs/product-positioning-roadmap.md` §4「命名收敛」与 §4.1「v0.4 修正方向」、§5 定位裁决 #4；GitHub Issue #61
> 基线：主仓库 `master` = `21b1dd3`（PR #58 定位文档 + PR #60 协作基线合入后）
> 本文性质：**公共契约与需求稿**。只定义状态、数据、接口、失败降级与验收标准；不包含任何运行时代码、数据库迁移或对既有文件的业务修改。
> 本文约定：凡标「**已冻结**」的行为/字段/边界为 v0.4 契约，后续实施任务必须遵守；凡标「**实施拆分时细化**」的为方向性设计，允许在对应实施 PR 中调整，但调整不得违背已冻结项。

---

## 0. 目标与边界

### 0.1 用户价值（已冻结）

让系统更准确地理解长篇内容，并给出更可靠的分集边界。用户面对的能力名称为：

- **检查原文**：导入后识别章节号、广告、水印、重复段等噪声，只提示、不自动改。
- **AI 整理原文**（可选、可跳过）：去噪声但**不改写正文**，结果可预览、可复现、可回退。
- **查看整理结果**：原文 / AI 整理稿 / 用户确认稿 / 差异记录四者关系可见。
- **智能分集**：基于「用户确认稿」做 AI 边界建议 + 后端确定性切片，顺序不变、不漏字、不重复。

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
| 原文（源稿） | `source` | 导入原样保存的内容（粘贴 / TXT/MD / 小说链接导入后的原始正文） | — | 否（仅作回指与差异参照） |
| AI 整理稿 | `cleaned` | AI 只执行「删除噪声区间」后的结果，必须由「原文 + 删除区间」确定性复现 | 禁止 | 否 |
| 用户确认稿 | `confirmed` | 用户审阅整理结果后确认的正文；此后分集、项目方案一律读取该稿 | 允许（经用户编辑后进入 `user-edited` 状态） | **是** |
| 差异记录 | `diff` | 原文 → 整理稿之间每次操作的记录（区间 + 类型 + 分类 + 片段） | — | — |

**版本边界规则（已冻结）**：

1. `cleaned` 与 `confirmed` 的分界：用户执行一次「确认整理结果」动作后，`cleaned` 才升级为 `confirmed`；确认前整理稿随时可放弃或重跑，不影响任何下游。
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
- 正文状态与现有 `dramas.status`、`episodes.status` 互不干扰：整理发生在项目方案/分集之前，不改变剧集生命周期语义。

---

## 2. 质量门（A 系列，已冻结）

### 2.1 AI 自动整理阶段的质量门

AI 自动整理只被允许输出「删除区间建议」，不允许输出改写后的整篇正文。后端对结果执行确定性校验，任一不通过则整体拒绝并返回可读错误：

1. **可定位**：每条 `removed.snippet` 必须能在原文中按字符精确找到（见 §3 定位契约）。
2. **不重叠**：全部删除区间两两不重叠，并按原文顺序排列。
3. **可复现**：`cleaned = 原文 − Σ(删除区间)`；同一原文 + 同一删除区间集合必须逐字节复现同一 `cleaned`。
4. **不改写**：除删除区间外，原文任何字符不得被改动、替换、插写或重排。
5. **章节标题不丢弃**：识别为章节标题的区间先提取为结构锚点（入锚点表），不作为普通噪声删除；用户可在确认页决定是否同时保留在正文。

> 删除区间的分类采用有限集合，v0.4 冻结如下：`chapter_marker`（章节号/卷标题行）、`ad`（广告）、`watermark`（水印/作者话）、`duplicate`（重复段）、`garbage`（乱码/无意义字符）。分类仅用于展示与统计，不改变删除语义。分类集合属于「实施拆分时可扩充」项。

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

### 3.3 AI 建议边界与后端确定性切片

延续现有职责划分（`backend/src/routes/dramas.ts` `POST /dramas/:id/analyze-episodes` + `splitSourceIntoEpisodes`），v0.4 冻结为：

- **AI 只做内容理解**：`episode_planner` Agent 只输出 `recommended_count / reason / episodes[{title, summary}]`；正文永远来自输入文本，由后端切片（现状已如此）。
- **分集输入**：读取当前有效正文版本（`confirmed` / `user-edited` / 跳过整理时的 `source`），将文本原样作为 `content` 传入现有分集链路。
- **后端确定性切片**：沿用 `splitSourceIntoEpisodes` 的边界候选 + 顺序切分算法；对确认稿新增「段落锚边界」候选源（候选边界必须落在段落边界集合内），使分集边界与段落锚对齐。
- **一致性断言（每轮切片必过，可测）**：各集正文按 `episode_number` 顺序拼接后逐字符等于输入文本；`character_count` 之和等于输入长度；段落在各集内不重复出现。

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

### 5.2 现有端点与行为（零变化，兼容旧项目与跳过整理）

以下端点在 v0.4 中**不改变行为**；未整理/跳过整理项目走它们 = 现状：

- `POST /dramas`（创建项目，含原文导入到 `dramas.description`）
- `POST /dramas/:id/analyze-episodes`（AI 集数/标题/摘要建议 + 确定性切片 + 草稿保存；`content` 由调用方传当前有效正文）
- `GET|PUT /dramas/:id/episode-plan`（草稿读取/保存，乐观锁 `expected_version`）
- `POST /dramas/:id/episodes/from-plan`（全量确认后生成/同步剧集；`source_hash` 列名沿用现状，其「分集输入正文哈希」语义见 §5.4）
- `PUT /episodes/:id`、`GET /episodes/:id/pipeline-status` 等既有剧集端点

兼容规则（已冻结）：

- 旧项目（`source_versions` 无任何记录）：健康检查与整理全部可跳过，链路与现状逐字节一致。
- 前端在「导入原文 → 分集」之间新增的可选步骤不改变任何现有保存动作的请求/响应结构。

### 5.3 新增端点草案（契约冻结，实施任务拆分时落地）

> 以下为 v0.4 冻结的请求/响应形状；实际路由文件、幂等迁移与前端接线由后续实施 PR 承担。未获授权的清理/回收类（D 系列）端点不在此列。

#### `POST /dramas/:id/source/health-check`

只读健康检查（不调用付费模型，用规则 + 可选轻量模型）。

- 请求体：`{ source_content?: string }`（省略时用服务器当前有效正文）。
- 响应 `200`：
```json
{ "code": 200, "data": {
  "status": "clean" | "issues",
  "issues": [ { "type": "chapter_marker|ad|watermark|duplicate|garbage",
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
- 任务成功：新增一行 `base_kind=cleaned` 版本（基于当前有效正文计算，见 §6.1）；**不改变当前有效正文指针**——清理稿未确认前不生效，用户可预览、可放弃、可重跑，旧版本不被覆盖也不被删除。

#### `GET /dramas/:id/source/versions`

- 响应 `200`：当前项目版本历史（按 `version_seq` 升序）+ 当前有效正文指针（`current` 为 `dramas.current_source_version_id` 指向的行；`null` 表示未整理，正文 = `dramas.description`）：
```json
{ "code": 200, "data": {
  "current": { "kind": "source|cleaned|confirmed|user-edited", "id": 1, "version_seq": 1, "updated_at": "..." },
  "versions": [
    { "id": 1, "kind": "source", "version_seq": 1, "content": "<source>", "content_hash": "…",
      "base_hash": "…", "diff": null, "stats": null, "created_at": "…" },
    { "id": 2, "kind": "cleaned", "version_seq": 2, "content": "<cleaned>", "content_hash": "…",
      "base_hash": "…",
      "diff": { "removals": [ { "start": 0, "end": 8, "snippet": "…", "category": "ad" } ],
                "removed_chars": 8 }, "stats": { "by_category": { "ad": 1 } }, "created_at": "…" }
  ]
}, "message": "success" }
```
- `content` 对超长版本允许按需截断展示（前端用 `char_count`/区间做预览），完整内容字段与截断策略由实施任务定，契约要求：**列表必须可用 `diff` 还原，不必依赖整篇 `content` 往返**。
- 响应字段与存储列的对应：`kind` ↔ `base_kind`；`content_hash` = `sha256(String(content || '').trim())`；`base_hash` 定义见 §6.1。

#### `POST /dramas/:id/source/confirm`

把「最新一份 `cleaned`」确认为分集输入基线。`expected_version` = 该 `cleaned` 版本行 id（版本行 id，不是 `version_seq`）。

- 请求体：`{ expected_version: number }`。
- 三态返回表（已冻结，实施 PR 照此实现）：

| `expected_version` 指向 | 判定 | 返回 |
| --- | --- | --- |
| 行存在，`kind=cleaned`，且是该项目 `kind=cleaned` 中 `version_seq` 最大的一行 | 成功 | `200`：该行 `base_kind` 原地迁移为 `confirmed`（内容/`diff`/`stats` 不变），当前有效正文指针切换为该行 |
| 行存在，但已是 `confirmed`（被并发重复确认）或不是最新的 `cleaned`（存在更新清理稿） | 冲突 | `409 VERSION_CONFLICT` |
| 行不存在 | 参数错误 | `400` |

- 原子性（已冻结）：单事务内执行条件 UPDATE——
  `UPDATE source_versions SET base_kind='confirmed', updated_at=? WHERE id=? AND drama_id=? AND base_kind='cleaned'`，**影响行数 = 1 才算成功**；影响行数 = 0 时补一次 SELECT 区分「不存在 → 400」与「kind 已变 / 非最新 → 409」。成功后 `UPDATE dramas SET current_source_version_id=? WHERE id=?`。并发重复 confirm 同一行时，第二个请求的 UPDATE 影响行数为 0 → `409`。
- 响应 `200`：迁移后的版本对象。

#### `PUT /dramas/:id/source/current`

用户直接编辑「已确认正文」的入口，触发 `confirmed → user-edited`（§2.2）并自动落版本快照。

- 请求体：`{ expected_version: number, content: string, note?: string }`。
  - `expected_version` = 当前有效正文所在版本行 id，且 `kind ∈ { confirmed, user-edited }`；
  - `content`：编辑后的正文，≤20 万字（与分集分析输入上限对齐）；`note` ≤200 字。
- 校验（已冻结）：
  - `expected_version` 不存在 → `400`；
  - 存在但**已不是当前有效正文**（并发下被其他请求切走）→ `409 VERSION_CONFLICT`；
  - 存在且为当前，但 `kind` 不是 `confirmed`/`user-edited` → `400`（不允许直接编辑 `cleaned`/`source`）。
- 行为（已冻结）：新建一行 `base_kind=user-edited` 版本，`content` = 请求正文，`parent_version_id` = 旧当前行 id，当前指针切换为新行；旧当前行完整保留（即「编辑前自动版本快照」）。
- 原子性：事务内先 `INSERT` 新行，再
  `UPDATE dramas SET current_source_version_id=?new_id WHERE id=? AND current_source_version_id=?expected_version`，**影响行数 = 1 才提交**；影响行数 = 0 → `409` 并回滚。
- 响应 `200`：新版本对象。

#### `POST /dramas/:id/source/skip`

- 前置条件（已冻结）：仅当当前有效正文 = `source`（`current_source_version_id` 为 NULL 或指向 `kind=source` 行）时允许；已存在整理稿时返回 `400` 并提示「如需回到原文，请使用版本切换」。
- 请求体：`{ note?: string }`（≤200 字）。
- 行为：在项目记录中写入跳过整理标记（方向：`dramas` 新增列 `source_skip_at`，见 §6.1）；当前有效正文保持 = `source`。
- 取消标记：用户显式发起 `POST /source/clean` 时清除。
- 响应 `200`：`{ skipped: true, current: "source" }`。

### 5.4 与分集端点的衔接（已冻结）

- 「智能分集」按钮在确认稿/编辑稿/跳过整理状态下行为一致：前端把**当前有效正文**（`current_source_version_id` 指向行的 `content`；NULL 时为 `dramas.description`）传给现有 `analyze-episodes` 的 `content`；分集草稿保存逻辑（`source_hash` 与 `content_fingerprint`，见 `episode-plan-draft.ts`）本身不变。
- 哈希语义（rev1，响应 P1-1）：`episode_plan_drafts.source_hash` 的列名沿用现状，本文统一解释为「**分集输入正文哈希**」= 当前有效正文的 `content_hash`（算法不变：`sha256(String(content || '').trim())`，与现有 `sourceHash()`（`backend/src/services/episode-plan-draft.ts`）算法一致）。检测对象由「固定 `dramas.description`」改为「当前有效正文」：
  - 未整理旧项目：当前有效正文 = `description`，哈希与现状逐字节一致，零回归（§5.2/T9）；
  - 整理/编辑后：`confirm`、`PUT current` 切换当前指针即改变哈希 → 既有「全文已变化，请重新生成分集建议」的 409 语义自然延续到确认稿/编辑稿，不产生误报与漏报。
- 存储列不另设 `source_hash`；版本行哈希字段为 `content_hash`/`base_hash`（定义见 §6.1）。

---

## 6. 数据字段类型与迁移方向（实施拆分时细化，方向已冻结）

### 6.1 新增存储（不实施）

#### `source_versions` 正文版本表（rev1 定稿）

选型（响应 Hermes P0-1 / P0-2，已冻结）：**版本行不可变 + `base_kind` 允许 `cleaned → confirmed` 原地状态迁移 + 项目内全局单调 `version_seq`**；「当前有效正文」用 `dramas.current_source_version_id` 指针列表达，不做同表唯一键技巧。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `INT` PK AI | |
| `drama_id` | `INT` NOT NULL | 关联 `dramas.id` |
| `base_kind` | `VARCHAR(16)` NOT NULL | `source / cleaned / confirmed / user-edited`；仅 `cleaned → confirmed` 允许原地迁移（§5.3 confirm），其余行创建后不再变更 |
| `version_seq` | `INT` NOT NULL | 项目内全局单调递增（INSERT 事务内取 `MAX(version_seq)+1`），不复用、唯一标识顺序 |
| `content` | **`LONGTEXT`** NOT NULL | 版本全文（`clean_text` 一律用 `LONGTEXT`，不落 `TEXT`，对齐 roadmap §4.1 工程修正） |
| `content_hash` | `VARCHAR(64)` NOT NULL | `sha256(String(content || '').trim())`（算法与现有 `sourceHash` 一致）；「全文变化检测」与定位的哈希依据 |
| `base_hash` | `VARCHAR(64)` NOT NULL | `base_kind=source` 行 = 自身 `content_hash`；其余行 = `parent_version_id` 指向行的 `content_hash`；用于跨版本完整性与 §2.1 可复现校验 |
| `parent_version_id` | `INT` NULL | 前驱版本行 id（`source` 首行为 NULL） |
| `diff` | `LONGTEXT` NULL | 相对 parent 的删除区间/差异 JSON（形状见 §5.3 versions 示例：`{ removals: [{ start, end, snippet, category }], removed_chars }`） |
| `stats` | `TEXT` NULL | 删除统计 JSON（按 §2.1 分类） |
| `created_at` / `updated_at` | `VARCHAR(64)` NOT NULL | 与现有表时间格式一致（ISO 字符串；时间列类型取舍见 §10 P2 登记） |

约束与索引（rev1 定稿）：

- 唯一键：`uk_source_versions_seq (drama_id, version_seq)`。**不设 `(drama_id, base_kind, …)` 类唯一**——同一 kind 存在多行历史是常态（重跑清理、重复编辑），rev0 的 `(drama_id, kind)` 方案与「保留版本历史」直接矛盾（P0-1）。
- 普通索引：`idx_source_versions_drama (drama_id)`、`idx_source_versions_parent (parent_version_id)`。
- **无 `deleted_at`**（rev1）：版本行一经创建不可删除、`content` 不可更新（仅 `base_kind` 状态迁移）。「放弃/回退/回到原文」一律通过新建版本 + 切换当前指针实现，不清历史；与 §0.2/§8 D 系列禁区一致，历史清理机制留待授权后另立决策（见 §10）。rev0 的「`deleted_at` + 唯一键软删重建」在 MySQL 上软删后重建会撞唯一键，且变相暗示清理流程（P0-2），已废止。
- 当前有效正文指针：`dramas` 新增列 `current_source_version_id INT NULL`（方向）。`NULL` = 未整理/旧项目 → 有效正文 = `dramas.description`（零回填兼容位，§6.3）。`cleaned` 行永不成为 current（未确认不生效）；指针只在「懒生成 `source` 行 / confirm 原地迁移 / PUT current 切换」三类时机变化。
- 跳过整理标记：`dramas` 新增列 `source_skip_at VARCHAR(64) NULL`（方向，§5.3 skip）。

否决备选（rev1 记录，避免实施 PR 回头纠结）：`is_current` 单行置 1 + 历史置 NULL 的唯一键技巧依赖 MySQL「唯一索引允许多 NULL」语义，理解与实现成本高于「指针列放 `dramas`」，否决。

### 6.2 与既有表的关系（已冻结）

- `dramas.description`（LONGTEXT）继续作为「项目创建/导入时的原文落点」与旧项目兼容位；整理后**不回写** `description`，避免破坏 `episodes.content` 与现有分集/剧本链路。
- `episodes.content`（LONGTEXT）语义不变：仍为剧集正文；整理/版本表与剧集表通过「项目级」关联，不逐集复制版本状态。
- 章节/段落锚点索引建议入独立表（`source_anchors`：`drama_id, version_id, para_id, anchor_text, hash, start, end, sort_order`），锚点表在实施拆分时落库；该表不承载正文，正文权威为「当前有效正文」（`current_source_version_id` 指向行；NULL 时为 `dramas.description`，见 §6.1）。

### 6.3 迁移与回填（已冻结）

- 旧项目零回填：无 `source_versions` 记录的项目全部按 `source` 处理，链路与现状一致（§5.2）。
- `source` 行懒生成（rev1）：不为存量项目批量建行；当项目首次发起健康检查 / 整理 / 或 `analyze-episodes` 首次携带正文时，由后端把当前有效正文（此时 = `dramas.description`）落为 `base_kind=source` 首行并回填 `current_source_version_id`。`POST /dramas` 行为不变（正文仍写 `description`），避免改变现状创建链路。
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
| T2 | 纯函数（切片一致性） | 确认稿进入 `splitSourceIntoEpisodes` | 拼接=输入；`character_count` 和=输入长度；段落不重复 |
| T3 | 纯函数（可复现性） | 同一原文+同一删除区间集合跑两次整理校验 | 两次 `cleaned` 逐字节相等 |
| T4 | 纯函数（质量门） | 删除区间含重叠/越界/找不到 snippet 的非法集 | 校验拒绝并给出具体错误 |
| T5 | 路由（健康检查） | clean/issues 两态响应 | 无模型调用；issues 分类计数正确 |
| T6 | 路由（clean） | 发起/重跑/并发 | running/already_running；旧版本不被覆盖 |
| T7 | 路由（confirm） | 三态返回 + 原子迁移 | 最新 cleaned → 200 且该行 `kind` 原地迁移为 confirmed、指针切换；重复确认同一行 → 409；确认非最新 cleaned → 409；`expected_version` 不存在 → 400 |
| T8 | 路由（skip） | 跳过整理 | 仅当当前正文=source 时 200 并记录标记；已有整理稿 → 400；再发起 clean 可取消标记 |
| T9 | 集成（旧项目） | 无版本记录项目完整走分集 | 行为与现状基线一致（逐接口 diff 为空） |
| T10 | 路由（user-edited） | `PUT /source/current` 编辑切换 | confirmed 编辑后新建 `user-edited` 行、指针切换、旧行保留为快照；重复编辑产生第二条 user-edited；过期 `expected_version` → 409；对 `cleaned`/`source` 行编辑 → 400 |
| T11 | 路由（并发） | confirm / PUT current 并发 | 同一 cleaned 并发 confirm 两次，第二个 409（UPDATE 影响行数 0 判定）；PUT current 并发切换，败者 409 且无孤儿版本行 |

### 7.3 三个代表样本（roadmap §6「真实基线」先行对象）

| 样本 | 特征 | 验收判据 |
| --- | --- | --- |
| S1 干净短文 | 无噪声、段落规整（≤1 万字） | 健康检查 `clean`；分集直接走现状链路；无整理提示 |
| S2 噪声网文 | 含章节号/作者话/广告/水印/重复段（2–5 万字） | AI 整理只删噪声不改正文；每条 `removed.snippet` 可定位、区间不重叠；`cleaned` 可复现；对 `confirmed` 分集无漏字/重复 |
| S3 长篇 | 3–4 万字真实长文 | 分段处理有进度与成本提示；中断后可恢复；边界降级可用；确认稿分集一致性断言全过 |

每个样本验收结果记录到迭代台账（数据来自真实运行，非合成断言），作为后续质量统计基线（roadmap §10 指标采集）。

---

## 8. 验收标准（对应 Issue #61，逐条可勾选）

- [ ] 状态与接口闭环：source/cleaned/confirmed/user-edited/skip 全路径可在 §5.3 接口上走通（`user-edited` 入口 = `PUT /dramas/:id/source/current`），无「已拍板/候选」混写（候选仅出现在 §4.2/§6 明确标注的「实施拆分时细化」条目内）。
- [ ] 自动整理不误改正文：质量门 §2.1 四条可测；§3.3 一致性断言可测。
- [ ] 人工编辑后不再执行严格相减证明：状态切换由 T10（`PUT /source/current` 编辑 → user-edited + 快照保留）与 T11（并发 409）覆盖；T9 保证旧项目路径不回归。
- [ ] 分集顺序不变、不漏字、不重复：T2 + S2/S3 全覆盖。
- [ ] 定位失败可降级：§3.4 有实现路径与用例（T2 unresolved 分支）。
- [ ] 旧项目与跳过整理保持现有行为：§5.2 兼容规则 + T9。
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

## 10. 评审修订登记（Hermes PR #63 评审，2026-09-05）

### 10.1 本次（rev1）已修复 / 已吸收

| 编号 | 评审项 | 落点 |
| --- | --- | --- |
| P0-1 | `(drama_id, kind)` 唯一键与「保留版本历史 / 重跑清理」矛盾 | §6.1 定稿：项目内全局单调 `version_seq` + `uk(drama_id, version_seq)`，不设 kind 类唯一 |
| P0-2 | `deleted_at` + 唯一键软删死锁且暗示 D 系列清理 | §6.1 定稿：无 `deleted_at`，版本不可删，回退=新版本+切指针 |
| P0-3 | `confirmed → user-edited` 无端点入口 | §5.3 新增 `PUT /dramas/:id/source/current`；§2.2 回链 |
| P0-4 | `expected_version` 语义与并发返回码未定 | §5.3 confirm 三态返回表 + 原子性条件 UPDATE；字段语义=版本行 id |
| P1-1 | `source_hash` 字段名语义偷换 | §5.4/§6.1 引入 `content_hash`/`base_hash`，`episode_plan_drafts.source_hash` 解释为「分集输入正文哈希」，未整理旧项目逐字节一致 |
| P1-4 | 承诺进度暴露但无查询端点 | §4.3/§5.3 写死复用现有 `GET /tasks/:id`（`sys_task.id` 即 `task_key`） |
| P1-5 | 测试矩阵漏 `user-edited` 路径 | §7.2 新增 T10（并补 T11 并发） |

### 10.2 登记 v0.4.1 修正式（后续独立 PR，本文不再扩大范围）

- **P1-2**：§3.1 段落稳定 ID 的 sha256 前缀碰撞预算（建议同项目碰撞概率 < 1e-6）与碰撞降级路径（回退 `[start, end)` + 段首短锚）。
- **P1-3**：补 §4.5「重试契约」——重试上限与退避、幂等键（`task_key` vs `source_hash + model`）、付费调用是否重试的取舍。
- **P1-6**：§9 实施拆分条目标注 `blocks / blocked-by` 依赖顺序（§9.2 涉及 `backend/src/utils/` 共享工具区，需与 Fork B #59/#62 协调热点）。

### 10.3 P2 意见（提交 owner 裁决时知情即可，不在本契约占位）

- §5.3 `health-check` 等只读端点使用 POST 的 REST 语义说明（用 POST 系因可选请求体；是否改 GET 由实施任务裁决）。
- `created_at`/`updated_at` 用 `VARCHAR(64)` 存储时间：为对齐现有表可保留，但时间倒序仅能字符串比较；是否切 `DATETIME`/`BIGINT` 由 DB 实施任务评估后裁决。
- §3.1 段首短锚兜底规则：空白段 / 短于 12 字符的段如何取锚。
- §7.1 回归清单是否覆盖 `backend/tests` 全量：实施 PR 应在触碰对应模块时补充说明。
- §0.2（本 PR 范围）与 §7.1（实施 PR 范围）的范围澄清：已在 rev1 落地于 §0.3，本条不再作为待裁决项。
