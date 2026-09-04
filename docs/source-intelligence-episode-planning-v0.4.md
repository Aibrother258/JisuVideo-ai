# 原文整理与智能分集 v0.4 需求与契约

> 版本：v0.4（契约稿，待 Hermes 技术评审 → Bugbot 复审 → owner 最终裁决）
> 日期：2026-09-04
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
              ├─(用户选择跳过整理)→ confirmed(skip)    （实际仍存 source，见 §5.3 skip）
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
- `POST /dramas/:id/episodes/from-plan`（全量确认后生成/同步剧集；`source_hash` 校验全文变化）
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
- 响应 `200`：`{ status: "running" | "already_running", task_key: string }`；并发规则同 §4.4。
- 完成结果写入版本（`kind=cleaned`）后，由 `GET /dramas/:id/source/versions` 或任务状态端点读取；清理中不覆盖任何旧版本。

#### `GET /dramas/:id/source/versions`

- 响应 `200`：当前项目版本历史（按创建时间倒序）：
```json
{ "code": 200, "data": {
  "current": { "kind": "source|cleaned|confirmed|user-edited", "id": 1, "updated_at": "..." },
  "versions": [
    { "id": 1, "kind": "source", "content": "<source>", "source_hash": "…",
      "diff": null, "stats": null, "created_at": "…" },
    { "id": 2, "kind": "cleaned", "content": "<cleaned>", "source_hash": "…",
      "diff": { "removals": [ { "start": 0, "end": 8, "snippet": "…", "category": "ad" } ],
                "removed_chars": 8 }, "stats": { "by_category": { "ad": 1 } }, "created_at": "…" }
  ]
}, "message": "success" }
```
- `content` 对超长版本允许按需截断展示（前端用 `char_count`/区间做预览），完整内容字段与截断策略由实施任务定，契约要求：**列表必须可用 `diff` 还原，不必依赖整篇 `content` 往返**。

#### `POST /dramas/:id/source/confirm`

- 请求体：`{ expected_version: number }`（乐观锁，指向待确认的 `cleaned` 版本 id）。
- 校验：目标版本存在且为 `kind=cleaned`；否则 `400`。并发冲突返回 `409 VERSION_CONFLICT`。
- 成功：新建 `kind=confirmed` 版本（内容=cleaned，diff 保留），当前有效正文切换为确认稿。
- 响应 `200`：新版本对象。

#### `POST /dramas/:id/source/skip`

- 请求体：`{ note?: string }`（≤200 字）。
- 成功：在项目记录中标记「跳过整理」，当前有效正文 = `source`；可再次发起健康检查/整理取消该标记。
- 响应 `200`：`{ skipped: true, current: "source" }`。

### 5.4 与分集端点的衔接（已冻结）

- 「智能分集」按钮在确认稿/跳过整理状态下行为一致：前端把当前有效正文文本传给现有 `analyze-episodes` 的 `content`；分集草稿保存逻辑（`source_hash` 与 `content_fingerprint`，见 `episode-plan-draft.ts`）不变。
- `source_hash` 计算方式不变：`sha256(String(content || '').trim())`（与 `sourceHash()` 一致），保证「全文变化检测」在确认稿切换后继续有效。

---

## 6. 数据字段类型与迁移方向（实施拆分时细化，方向已冻结）

### 6.1 新增存储（不实施）

新增「正文版本表」`source_versions`（草案，字段类型冻结，DDL 由实施任务在 `backend/src/db/mysql-schema.ts` 以幂等 CREATE/ALTER 追加，不重建既有表）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `INT` PK AI | |
| `drama_id` | `INT` NOT NULL | 关联 `dramas.id` |
| `kind` | `VARCHAR(16)` NOT NULL | `source / cleaned / confirmed / user-edited` |
| `content` | **`LONGTEXT`** | 版本全文（`clean_text` 一律用 `LONGTEXT`，不落 `TEXT`，对齐 roadmap §4.1 工程修正） |
| `source_hash` | `VARCHAR(64)` | 原文 sha256（`sourceHash` 语义） |
| `parent_version_id` | `INT` NULL | 上一版本 id（`cleaned → confirmed` 等链式关系） |
| `diff` | `LONGTEXT` NULL | 相对 parent 的删除区间/差异 JSON |
| `stats` | `TEXT` NULL | 删除统计 JSON（按 §2.1 分类） |
| `created_at` / `updated_at` | `VARCHAR(64)` | 与现有表时间格式一致（ISO 字符串） |
| `deleted_at` | `VARCHAR(64)` NULL | 软删，遵循现有软删惯例 |

建议唯一/索引（方向）：`uk_source_versions_drama_kind(drama_id, kind)` 只允许每个 kind 保留一个「当前」行 + 版本历史行用 `(drama_id, id)` 普通索引；`deleted_at` 过滤沿用现有 `isNull` 模式。

### 6.2 与既有表的关系（已冻结）

- `dramas.description`（LONGTEXT）继续作为「项目创建/导入时的原文落点」与旧项目兼容位；整理后**不回写** `description`，避免破坏 `episodes.content` 与现有分集/剧本链路。
- `episodes.content`（LONGTEXT）语义不变：仍为剧集正文；整理/版本表与剧集表通过「项目级」关联，不逐集复制版本状态。
- 章节/段落锚点索引建议入独立表（`source_anchors`：`drama_id, version_id, para_id, anchor_text, hash, start, end, sort_order`），锚点表在实施拆分时落库；该表不承载正文，正文唯一权威仍为 `source_versions.content`。

### 6.3 迁移与回填（已冻结）

- 旧项目零回填：无 `source_versions` 记录的项目全部按 `source` 处理，链路与现状一致（§5.2）。
- 迁移文件遵循仓库现状：不引入独立迁移工具，DDL 在 `mysql-schema.ts` 的幂等 `initMySqlSchema` 流程追加（`db/index.ts` 启动调用），保证对已存在旧库可重复执行。

---

## 7. 测试矩阵与代表样本验收

### 7.1 回归基线（v0.4 实施 PR 不得破坏，命令照抄）

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
| T7 | 路由（confirm） | 版本锁 | 成功切换当前有效正文；过期 `expected_version` → 409 |
| T8 | 路由（skip） | 跳过整理 | 当前正文=source；可再发起整理取消标记 |
| T9 | 集成（旧项目） | 无版本记录项目完整走分集 | 行为与现状基线一致（逐接口 diff 为空） |

### 7.3 三个代表样本（roadmap §6「真实基线」先行对象）

| 样本 | 特征 | 验收判据 |
| --- | --- | --- |
| S1 干净短文 | 无噪声、段落规整（≤1 万字） | 健康检查 `clean`；分集直接走现状链路；无整理提示 |
| S2 噪声网文 | 含章节号/作者话/广告/水印/重复段（2–5 万字） | AI 整理只删噪声不改正文；每条 `removed.snippet` 可定位、区间不重叠；`cleaned` 可复现；对 `confirmed` 分集无漏字/重复 |
| S3 长篇 | 3–4 万字真实长文 | 分段处理有进度与成本提示；中断后可恢复；边界降级可用；确认稿分集一致性断言全过 |

每个样本验收结果记录到迭代台账（数据来自真实运行，非合成断言），作为后续质量统计基线（roadmap §10 指标采集）。

---

## 8. 验收标准（对应 Issue #61，逐条可勾选）

- [ ] 状态与接口闭环：source/cleaned/confirmed/user-edited/skip 全路径可在 §5.3 接口上走通，无「已拍板/候选」混写（候选仅出现在 §4.2/§6 明确标注的「实施拆分时细化」条目内）。
- [ ] 自动整理不误改正文：质量门 §2.1 四条可测；§3.3 一致性断言可测。
- [ ] 人工编辑后不再执行严格相减证明：状态切换 §2.2 有测试用例（T7/T9 覆盖入口语义）。
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
