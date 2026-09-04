# JisuVideo-ai 多视频类型扩展完整实施方案

> 版本：v2.2（实施细节冻结稿，含 PR #8 评审修订 R20–R23）  
> 日期：2026-09-02  
> 状态：**已取消（2026-09-04 用户决策）**——原「评审修订完成，待复核冻结；尚未进入生产开发」  
> 说明：**主线二「多视频类型扩展」整体取消**，本文不再实施、不再据此排期，保留仅供追溯参考；后续主规划以 `docs/ui-optimization-plan.md` 为准（修订记录 v3.3 登记本取消决策）。shuohao 五件套导入方向已改为「短剧上游导入」独立立项，与本稿第 7 章轨道脱钩。  
> 适用仓库：`F:/JisuVideo/JisuVideo-ai`、`F:/JisuVideo/shuohao-skills`

## 0.1 修订记录（v2.0 → v2.2）

v2.1 基于 `F:/JisuVideo/JisuVideo-ai` 后端/前端代码现状逐项核实后修订，核实依据：`backend/src/db/mysql-schema.ts`、`backend/src/agents/`、`backend/src/services/generation.ts`、`backend/src/services/ffmpeg-merge.ts`、`backend/src/routes/`、`frontend/app/pages/index.vue`、`frontend/app/views/drama/*.vue`。主要修订与原因：

| # | 修订项 | 原因（代码现状） | 涉及章节 |
| --- | --- | --- | --- |
| R1 | 新增能力就绪度矩阵 | 现有代码中 TTS、字幕生成、转写(ASR)、说话人识别、节拍检测、音频混音**零实现**（无服务、无适配器）；`TaskType = 'image' \| 'video'` 仅两类任务；视频生成依赖 MiniMax H3 音画同步（官方无独立 TTS 开关）。能力清单不标注就绪度，六类闭环将无法验收 | 4.3、5.0、13 |
| R2 | 六类闭环分级 | narrative/marketing 可完整复用现有图片/视频/H3/合片链；talking/documentary/knowledge/music 依赖 R1 中不存在的能力，首期只能保证"导入+结构化+时间线+导出"闭环 | 5.0、18 |
| R3 | Agent Profile 与现有配置机制关系 | 代码中**不存在 `agent_configs` 表**（CLAUDE.md 文档过时）；Agent 实际配置链为 `workspace/prompts/<type>.md` 文件（frontmatter 带 model）→ SKILL.md 全文注入 → 工具白名单 → `ai_service_configs` 动态选模型。Profile 必须与这套机制打通，否则出现两套 prompt 源 | 2、4.4 |
| R4 | cut 首期定位为展示层资产 | 现有 `storyboards` 表一行=一个分镜段（`storyboard_number`），`video_prompt`/`minimax_h3_prompt`/`video_url`/生成任务均以**段**为粒度；shuohao 的"段+切镜(cut)"两级结构无对应表（`storyboard_cuts` 需新增）。若首期让 cut 参与生成任务，将波及 `generation.ts`、工作台与合片，破坏现有回归 | 7.6、8.2、10.3 |
| R5 | 创建流程兼容式改造 | 现有创建为硬编码两步表单：内容输入（粘贴/上传/链接）→ AI 提炼 → 选标题/风格/比例；**创建时无集数参数**（集数在详情页经 `episode_plan_drafts` 由 AI 推荐生成）。原向导式流程与现状冲突 | 10.1 |
| R6 | 两条建集路径统一 | 现有建集唯一入口是 `episode_plan_drafts` → `from-plan`；导入包的"outline 全集壳"必须走同款状态机，避免两套建集逻辑 | 7.2、8.3 |
| R7 | 局部重跑成本语义落地 | 现有 `generation.ts` 明确"创建请求不自动重试，避免重复扣费"（付费非幂等）；局部重跑=重新调用供应商=新扣费，需成本预估+确认+默认复用已生成媒体 | 8.4、9.3、11.1 |
| R8 | 字段语义与时长单位统一 | `dramas.genre` 已存在（题材），与新增 `video_type`（生产类型）语义重叠易混淆；`total_duration`/`episodes.duration`/`storyboards.duration` 单位需统一 | 8.1 |
| R9 | 供应商选型优先复用现有生态 | 现有 `ai_service_configs`/`ai_service_providers` + `adapters/`（openai/gemini/volcengine 图片；volcengine/minimax/autodl 视频）已成体系；MiniMax/Volcengine 均自带 TTS/ASR 能力，优先对接可减少新增供应商的合规与授权成本 | 11.2 |
| R10 | 阶段计划改双轨道并行 | 原 45–62 天估算将"能力开发+供应商集成"压缩在阶段 6（7–10 天），按代码现状至少低估 1.8–2.2 倍 | 12 |
| R11 | Agent 数量与配置链表述统一 | 代码核实共 7 个 Agent；4.4 表格已完整覆盖，2 节/18 节措辞统一为"5 生产核心 + 2 编排"，避免读者误判为 5 个 | 2、4.4、18 |

## 0. 执行摘要

### 0.2 v2.2 二次审查修订

本版在 v2.1 基础上继续冻结 8 项容易导致返工的细节。下文保留"v2.1 已确认"作为基线；本版新增内容统一标记为"v2.2 新增"。

| # | 修订 | 冻结结论 |
| --- | --- | --- |
| R12 | Tier B 能力边界 | mock 只产出可审阅的结构化时间线，不宣称真实字幕/TTS/ASR/节拍渲染已完成 |
| R13 | 时长换算 | `minutesPerEpisode × 60 × episodes` 才是秒；小数秒必须先转整数毫秒，禁止浮点累加 |
| R14 | 数据迁移 | 新业务字段以显式幂等迁移加列，`dramas.metadata` 只保存快照/扩展，不作为字段真源 |
| R15 | 工作流归属 | `workflow_runs` 和幂等键统一使用 `drama_id`，不使用未定义的 `project_id` |
| R16 | 任务幂等 | 为 `sys_task` 增加作用域化幂等键/请求指纹，避免工作流层防重但付费任务重复 |
| R17 | 包去重 | 原始包按 hash 可复用校验结果，但 approve 必须以用户/项目/幂等键隔离，不把一个包错误绑定到多个项目 |
| R18 | Provider 限制 | 导入阶段校验静态引用，执行器提交前校验完整 H3/视频参考素材列表；上限与现有 Adapter 一致（图 9、视频 3、音频 3、总数 12） |
| R19 | 上传限制 | 冻结文件大小、JSON 深度、数组长度和 validation TTL，避免实现各自解释 |

v2.2 收到 PR 评审后新增修订（2026-09-02，四条均属消除"冻结稿不可实施/不可验收"矛盾的必改项）：

| # | 修订 | 冻结结论 | 涉及章节 |
| --- | --- | --- | --- |
| R20 | Tier A 真实能力边界 | Tier A 首期只承诺"真实图片/视频/H3 生成 + 已生成镜头按序拼接"；TTS、字幕、时间线、音轨合成明确为轨道 B 或外部后期，narrative/marketing 不得表述为完整成片交付 | 5.0、5.1、5.5、18 |
| R21 | 首期单机单用户 | 当前仓库无认证/用户/成员/管理员模型；actor 固定为本地操作者，登录/角色/跨用户隔离表述全部降级；多用户与角色鉴权列为未来扩展 | 0.3、1.2、1.3、8.2、9.2、9.3、12.1 |
| R22 | 导入失败诊断两段事务 | import 记录与业务写入分独立事务：先独立提交 pending，再业务事务；失败后独立事务标 failed 并保存脱敏诊断；补"失败后业务数据为零、诊断仍可查询"集成验收 | 8.3、13.3 |
| R23 | 任务创建唯一边界 | 允许 generation.ts 兼容性最小改造，提取共享 task-factory，旧 `/api/v1/tasks` 入口与工作流入门共用；参考素材上限与幂等校验不得被旁路 | 7.6、9.3、12.1、12.2 |

### 0.3 v2.2 数据关系与状态机冻结摘要（新增）

为避免"包校验结果复用"和"项目导入实例"混为一谈，四类实体必须按以下关系实现：

```text
preproduction_packages（原始包，按 content_hash 去重）
        1 ── N preproduction_validations（按请求/版本保存校验快照）
        1 ── N preproduction_imports（每次 approve 的项目绑定实例）
                              N ── 1 dramas（实际项目）
```

- `preproduction_packages` 是不可变原始包索引；同一 `content_hash` 的校验结果可复用（服务端去重），但不得直接把 package 当作项目，也不得因 hash 命中而绕过项目归属校验或泄露 manifest/artifact 原文。首期为单机单用户部署（R21），不存在跨用户共享；多用户授权语义列入未来扩展。
- `preproduction_validations` 保存校验器版本、输入文件指纹、结果摘要、错误/警告、过期时间和创建者；同 hash 且校验器版本相同且未过期时可复用结果。
- `preproduction_imports` 保存 `package_id + validation_id + drama_id + actor_id + approve_idempotency_key`，是审计记录的唯一来源；`actor_id` 首期固定为唯一本地操作者（为未来多用户预留），同一 approve 幂等键只能得到一个导入实例（首期约束为 `approve_idempotency_key` 全局唯一）。
- validation 状态：`pending → valid|invalid → expired`；只有 `valid` 且未过期的快照可以 approve。
- import 状态：`pending → importing → succeeded|failed|rolled_back`；失败保留诊断（由独立事务写入，见 8.3 R22），业务事务回滚，不能将 package 或 validation 标记为成功。

冻结的默认限制：单文件 50 MiB、总包 200 MiB、JSON 最大深度 12、单数组最多 10,000 项、单包最多 100 个 artifact；validation TTL 24 小时。超限统一返回 HTTP 413、业务码 `4130 PACKAGE_LIMIT_EXCEEDED`。实现可通过服务端配置收紧，但不得放宽而不升级方案版本。

权限边界（R21 修订）：**首期为单机单用户部署**——当前仓库无 users/session/auth、无 `actor_id`/项目成员/管理员模型，本方案**不引入**认证层与权限矩阵。`actor` 语义固定为唯一本地操作者；`validate`/`approve`/读取/强制重生成接口均以本地操作者身份调用，`actor_id` 仅作审计字段（固定本地值）。仍须约束的是**数据归属**：接口按 `drama_id`/创建者绑定校验，禁止仅凭 package_id 或 validation_id 读取未绑定项目的原文；强制重生成必须二次确认预计费用。登录用户、创建者/成员/管理员角色与跨用户/租户隔离全部列为**未来多用户扩展**（与认证基础设施一并排期，见 12.1），不作为首期承诺或表结构前提。

`sys_task` 幂等字段迁移采用兼容顺序：先加 nullable 字段和普通索引，回填历史任务的 `scope='legacy'`；新代码先写入字段并双读，观测稳定后再对新建任务强制非空。历史任务恢复不得因为缺少幂等字段而重复提交供应商。完整字段、索引和迁移定义见 8.0–8.2.1。

本方案把 JisuVideo-ai 从"以短剧为中心的固定生产链"扩展为"类型目录 + 工作流模板 + 能力注册表 + Agent Profile + 公共生产模块"的视频生产平台。首期支持六个一级视频类型，并通过 shuohao-skills 的五阶段 JSON 策划包导入能力验证类型化架构。

实施遵循两个边界：

1. **平台扩展轨道**：新增类型、工作流和表单配置，复用现有图片/视频任务、H3、FFmpeg 合成和导出链。
2. **策划包导入轨道**：把 outline、cast、art、script、storyboard 安全导入为 JisuVideo 项目资产；shuohao 的 CLI 和 `SKILL.md` 不在后端运行时直接执行。

首期目标不是一次性重写生产链，而是先建立可回滚的基础设施，并用六类最小闭环证明：新增普通类型只增加配置、模板和 Profile，不修改核心执行器。

## 1. 目标、范围与成功定义

### 1.1 产品目标

- 用户可以在创建项目时选择一级类型、二级场景、输入方式、生产模式、风格和输出规格。
- 工作流由版本化模板驱动，类型与风格解耦，模板升级不改变历史项目。
- 所有任务通过能力注册表和 Provider Adapter 执行，禁止模板直接调用供应商或任意代码。
- 失败阶段可按依赖关系局部重跑，已生成媒体默认不被覆盖。
- 新增类型具备可量化的接入分级、测试门禁和回滚路径。

### 1.2 六个一级类型与二级场景

| 一级类型（稳定 key） | 二级场景 | 主要输入 | 默认呈现方式 |
| --- | --- | --- | --- |
| `narrative` 叙事剧情 | 短剧、漫剧、故事型品牌片 | 原文、剧本、角色/场景设定 | AI 画面 + 配音 |
| `talking` 口播对话 | 单人口播、双人口播、访谈、播客、虚拟人口播 | 文案、音频、实拍视频 | 真人/TTS/数字人 |
| `documentary` 纪实实拍 | Vlog、旅行纪录片、直播切片 | 实拍视频、图片、音频 | 实拍剪辑 + 字幕 |
| `knowledge` 知识资讯 | 课程、新闻解说、科普、培训、屏幕教程 | 文稿、课件、资料、录屏 | 讲解 + 标注 |
| `marketing` 产品品牌营销 | 产品介绍、电商广告、品牌宣传、软件演示 | 产品资料、卖点、品牌资产 | B-roll/产品镜头 + 配音 |
| `music` 音乐节奏视听 | 音乐视频、歌词视频、节拍卡点 | 音频、歌词、视频素材 | 节拍对齐 + 歌词 |

一级类型只负责业务语义；`style_preset`、`visual_mode`、`presenter_mode`、`output_profile` 均为独立维度。

> 注：上表"默认呈现方式"为目标形态；凡涉及 TTS 配音、字幕、时间线、音轨合成等呈现，须遵守 4.3.1 能力就绪度与 5.0.1/5.0.2 边界——对应能力为 `gap` 时首期只产出计划/mock/占位，不宣称真实音视频成片；Tier A 首期真实能力范围见 5.0.2。

### 1.3 首期纳入与不纳入

首期纳入：六类目录、六个基线模板、Schema 驱动创建表单、模板执行器基础能力、策划包导入 MVP、现有生产链适配、回归与观测。

首期不纳入：后端直接运行 Codex/Claude、在线回写 shuohao 源文件、完整插件市场、自动覆盖已有成片、供应商全量重构、面向外部商业化发布；认证/用户/成员/管理员模型与跨用户隔离（首期单机单用户，R21，多用户为未来扩展）。许可证结论未书面确认前只允许内部评估和测试。

### 1.4 MVP 成功标准（可验收）

1. 合法样例包可被上传、校验、预览并在确认后创建项目。
2. 六类项目均可完成"输入 → 规划 → 生成/导入 → 结构化时间线 → 合成或计划导出"的最小闭环；其中 Tier A 首期真实范围为"真实供应商的图片/视频/H3 生成 + 已生成镜头整集拼接（`video.merge`）"，配音、字幕、时间线、音轨合成**不属首期承诺**（见 5.0.2）；Tier B 仅允许 JSON/EDL 或带水印无声占位预览，mock 不得伪称真实 TTS/ASR/字幕/节拍能力。
3. 新增一个 Level 0 类型不修改核心生产链代码；只需类型目录、Profile、默认参数和 fixture。
4. 模板版本、供应商版本和项目快照可追溯；旧项目在模板升级后行为不变。
5. 单阶段失败可重试或局部重跑；事务失败不产生半个项目；已有媒体 URL 不被静默清空。

## 2. 当前仓库基线与改造边界

| 层 | 当前实现 | 本方案的改造方式 |
| --- | --- | --- |
| 前端 | Nuxt 3/Vue 3，`pages/`、`views/drama/`、可复用选择器和工作台 | 新增类型目录、Schema 表单、导入预览和工作流状态面板，保持现有路由兼容 |
| API | Hono，路由位于 `backend/src/routes/` | 新增 `/api/v1/video-types`、`/workflows`、`/preproduction`，不把导入逻辑散落到旧 CRUD |
| 数据库 | MySQL；`mysql-schema.ts` 启动建表，`schema.ts` 为 Drizzle 映射 | 新表两处同步登记；已有表只做显式、幂等迁移 |
| Agent | Mastra；现有 7 个 Agent：5 个生产核心（`script_rewriter`、`extractor`、`storyboard_breaker`、`prompt_generator`、`minimax_h3_prompt_generator`）+ 2 个编排（`project_analyzer`、`episode_planner`）。配置链：`workspace/prompts/*.md` 文件（frontmatter 指定 model）→ SKILL.md 注入 → 工具白名单 → `ai_service_configs` 动态选模型；**不存在 `agent_configs` 表** | 保留 Agent key；类型差异通过 Profile 注入，不复制 Agent；Profile 作为运行时附加段，不替代现有 prompt 文件（见 4.4） |
| 任务 | `sys_task` 统一图片/视频任务，已有恢复租约和 Provider 配置 | 能力执行器统一写入任务上下文，复用现有重试、恢复和统计 |
| 媒体 | `assets`、`storyboard_reference_assets`、图片/视频 URL 字段 | 导入阶段只登记来源和映射；生成后再写引用媒体，不预插空引用 |
| 合成 | FFmpeg merge 服务及 `video_merges` | 模板声明能力依赖，合成实现保持单一入口 |
| 技能 | Agent Workspace 注入 `SKILL.md` 文本 | 只复用其 Schema/规则和可移植纯校验逻辑，不把技能文本当作可执行插件 |

## 3. 总体架构

```text
类型目录 API
    ↓
Schema 驱动创建表单 ──→ ProjectConfig
    ↓                         ↓（冻结快照）
工作流模板注册表 ──→ DAG 执行器 ──→ 能力注册表 ──→ Provider Adapter
    ↓                         ↓
Agent Profile               sys_task / 任务队列
    ↓                         ↓
公共生产模块 ──→ 媒体资产、字幕、时间线、FFmpeg、导出

shuohao 五阶段 JSON ──→ 解析/Schema/交叉校验 ──→ ImportPlan ──→ 用户确认 ──→ 导入事务
```

### 3.1 分层职责与不变量

- **目录层**：类型、场景、输入/呈现/输出 Profile、可用模板和能力声明。
- **编排层**：模板解析、依赖排序、条件判断、并行、重试、局部重跑和幂等。
- **能力层**：转写、说话人识别、节拍检测、提示词编译、图片/视频/TTS、字幕、时间线和合成。
- **适配层**：Provider Adapter 屏蔽官方 API、中转站、超时、限流、成本和健康状态差异。
- **数据层**：业务实体、导入包、模板/Profile 版本、执行记录、资产来源和审计。

不变量：模板只能引用已注册 key；模板/Profile/Schema 版本不可变；外部输入先校验后写库；密钥和原文不进入日志；所有任务有幂等键。

### 3.2 建议代码布局

```text
JisuVideo-ai/backend/src/
├── workflows/
│   ├── capabilities/       # 能力契约、注册表、执行器
│   ├── templates/          # Git 管理的 YAML/JSON 模板
│   ├── profiles/           # Agent Profile 与类型参数 Schema
│   ├── registry/           # 启动注册、lint、版本哈希
│   └── executor/           # DAG、重试、局部重跑、状态机
├── preproduction/
│   ├── parser/             # manifest/artifact 解析
│   ├── validator/          # Schema 与跨阶段质量门
│   ├── importer/           # ImportPlan、映射和事务
│   └── schemas/            # 导入 DTO/JSON Schema
├── providers/              # Provider Adapter 与健康检查
└── routes/                 # videoTypes、workflows、preproduction、workflowRuns
```

每个目录配套单元测试；模板和 Profile 通过 CI lint 后才能合并，生产环境只加载构建产物中的白名单版本。

## 4. 类型与配置契约

### 4.1 类型目录对象

```json
{
  "key": "narrative",
  "version": "1.0.0",
  "label": "叙事剧情类",
  "subtypes": ["short_drama", "comic_drama", "story_brand"],
  "inputProfiles": ["script", "outline", "reference_media"],
  "visualModes": ["ai", "hybrid", "live_action"],
  "presenterModes": ["voiceover", "character_dialogue", "none"],
  "defaultWorkflow": "narrative.standard@1.0.0",
  "supportedOutputProfiles": ["vertical_9_16", "landscape_16_9", "square_1_1"],
  "status": "active"
}
```

目录由服务端返回，前端不得永久硬编码一级类型列表。新增目录项默认 `draft`，通过 feature flag 灰度后才变为 `active`。

### 4.2 Workflow Template 契约

模板采用 Git 管理的 JSON/YAML 文件，数据库只保存注册状态、哈希和项目快照。最小结构：

```yaml
key: narrative.standard
version: 1.0.0
type: narrative
subtypes: [short_drama, comic_drama]
inputs:
  required: [script]
  optional: [outline, cast, art, reference_media]
steps:
  - id: normalize_input
    capability: text.normalize
  - id: extract_entities
    agentProfile: narrative.extractor@1.0.0
    dependsOn: [normalize_input]
  - id: storyboard
    agentProfile: narrative.storyboard_breaker@1.0.0
    dependsOn: [extract_entities]
    supportsPartialRerun: true
  - id: generate_media
    capability: video.generate
    dependsOn: [storyboard]
    mode: [ai, hybrid]
    retryPolicy: provider_default
conditions:
  - when: "input.visual_mode == 'live_action'"
    skip: [generate_media]
limits:
  maxParallel: 4
  maxSegmentSeconds: 15
```

必备字段：`key`、`version`、`type`、`inputs`、`steps`、`dependsOn`、`when`、`mode`、`retryPolicy`、`supportsPartialRerun`。条件表达式使用受限 AST，不允许 `eval`、SQL 或文件系统访问。

### 4.3 能力注册表

首期能力 key：

```text
text.normalize                 media.import
speech.transcribe              speech.diarize
content.structure              beat.detect
prompt.compile                 image.generate
video.generate                 voice.tts
subtitle.generate              audio.normalize
timeline.compose               video.merge
export.render                  asset.register
```

每项能力声明 `inputSchema`、`outputSchema`、`executorVersion`、超时、重试、幂等策略、是否支持局部重跑和成本标签。执行器注册缺失、Schema 不通过或 Provider 未健康时，任务必须在提交前拒绝。

#### 4.3.1 能力就绪度矩阵（v2.1 已确认，原因 R1）

下表依据 `backend/src` 代码现状核实（就绪度：ready=现有完整实现；partial=部分/内嵌实现；gap=不存在需新建）：

| 能力 key | 现状核实 | 就绪度 | 供应商 |
| --- | --- | --- | --- |
| text.normalize | 无独立服务，由 Agent 阶段承担 | partial | - |
| media.import | `/upload/image\|video\|audio` + `assets` 表 + SSRF 防护（`source-import.ts`） | ready | - |
| speech.transcribe | 无任何 ASR 代码 | gap | MiniMax/Volcengine ASR（R9 优先复用） |
| speech.diarize | 无 | gap | 同上 |
| content.structure | `extractor`/`storyboard_breaker` 部分承担 | partial | - |
| beat.detect | 无 | gap | 本地音频分析服务（待评估） |
| prompt.compile | `services/final-prompt.ts` 已编译最终提示词 | ready | - |
| image.generate | `sys_task` + openai/gemini/volcengine 适配器 | ready | 已有 |
| video.generate | `sys_task` + volcengine/minimax/autodl 适配器（含 H3） | ready | 已有 |
| voice.tts | 无；现依赖 MiniMax H3 音画同步（官方无独立 TTS 开关） | gap | MiniMax/Volcengine TTS（R9） |
| subtitle.generate | 无；仅 `storyboards.subtitle_url` 字段预留 | gap | - |
| audio.normalize | `ffmpeg-merge.ts` 内嵌音频归一化（aac 48kHz/静音补轨） | partial | - |
| timeline.compose | 无独立时间线服务 | gap | 新建（本方案设计范围内） |
| video.merge | `ffmpeg-merge.ts` 完整（copy/reencode 双路径 + ffprobe 预检） | ready | - |
| export.render | 无独立导出服务；合片后依赖 `video_merges` | partial | - |
| asset.register | `assets` 表 + 上传落盘 | ready | - |

规则：模板必须声明依赖能力及其就绪度门槛；`gap` 能力未接入真实供应商前，对应模板模式以 mock 通过并在验收中标注"能力模拟"；不支持的组合在创建表单阶段阻止提交。**Tier A（narrative/marketing）首期模板只允许把 `ready` 能力（`image.generate`/`video.generate`/`video.merge`）作为真实交付承诺**；`voice.tts`、`subtitle.generate`、`timeline.compose` 等 `gap` 能力不得进入 Tier A 首期真实链路，只能作计划占位、降级至 Tier B 验收口径或由外部后期承接（见 5.0.2）。

## 4.4 Agent Profile

Profile 统一描述：通用 Agent、类型/场景 Profile、输入/输出 Schema、示例与质量门、能力约束和 prompt 版本。

| Agent | 主要 Profile | 约束 |
| --- | --- | --- |
| `script_rewriter` | narrative、knowledge | 导入的 shuohao script 默认只读；受控修订不得重造外部 ID |
| `extractor` | narrative、marketing | 角色/场景/道具抽取，外部 ID 冲突必须报错 |
| `storyboard_breaker` | narrative、marketing、knowledge | 输出段级任务，单段建议 8–15 秒 |
| `prompt_generator` | image/video 通用 | 资产和风格注入由编译器完成，Agent 不直接决定供应商 |
| `minimax_h3_prompt_generator` | H3 视频 | 只写 `minimax_h3_prompt`，不得覆盖 `video_prompt` |
| `project_analyzer` | 项目初始化 | 仅负责结构化分析，不创建生产任务 |
| `episode_planner` | 分集规划 | 输出需通过 Episode Schema 和唯一集号校验 |

**Profile 与现有 Agent 配置机制的关系（v2.1 已确认，原因 R3）**：现有 Agent 的 system prompt 来自 `workspace/prompts/<type>.md` 文件（frontmatter 可指定 model），SKILL.md 全文注入 instructions 末尾，工具按白名单挂载，模型经 `ai_service_configs` 动态解析。`agent_profiles` 表**只保存版本化元数据**（输入/输出 Schema、示例、能力约束、质量门）与文件引用；运行时将 Profile 内容作为 system prompt 的**附加段**注入，prompt 正文仍以 workspace 文件为唯一可编辑源。禁止出现两套可编辑的 prompt 源。

## 5. 六类基线工作流

所有工作流均使用公共模块；箭头是逻辑阶段，不代表每阶段必须同步执行。5.1–5.6 描述目标完整流程，首期实际执行必须遵守 5.0.1 的 Tier B mock 边界与 5.0.2 的 Tier A 真实能力边界，以及能力就绪度 gate；流程图中的 TTS、ASR、字幕、节拍和真实导出在能力为 `gap` 时只能落为计划或占位状态。

### 5.0 六类闭环分级（v2.1 已确认，原因 R2）

| 级别 | 类型 | 首期闭环定义 | 依据 |
| --- | --- | --- | --- |
| Tier A 真实闭环（R20 首期范围收窄） | narrative、marketing | 首期真实承诺 = 真实供应商的图片/视频/H3 生成 + 已生成镜头按序拼接（`video.merge`）；配音、字幕、时间线合成、音轨合成**不属于首期承诺**，归轨道 B 或外部后期（见 5.0.2） | 现有 `sys_task` + H3 + `ffmpeg-merge.ts` 可完整承接图片/视频/H3/拼接；TTS/字幕/时间线为 gap（见 4.3.1） |
| Tier B MVP 闭环 | talking、documentary、knowledge、music | 导入 + 结构化 + 时间线计划 + JSON/EDL 导出（可选带水印无声占位预览）；TTS/ASR/节拍以 mock 占位，真实供应商在轨道 B 接入后切换 | 上述能力当前为 gap（见 4.3.1），无法首期接真实供应商 |

Tier B 模板验收时须在输出中标注"能力模拟"；能力切换真实供应商属于能力版本升级，不影响项目快照与历史项目行为。

#### 5.0.1 Tier B mock 输出与产品文案边界（v2.2 新增）

Tier B 首期只允许生成"可审阅计划"，不得伪装成已完成的媒体能力：

| 能力 | mock 允许输出 | 首期禁止宣称/动作 |
| --- | --- | --- |
| `speech.transcribe` | 带来源标记的占位转写 JSON（或用户提供的原文） | 不得标记为"自动转写完成"，不得据此自动生成字幕时间码 |
| `speech.diarize` | `speaker_1` 等待确认的说话人占位 | 不得自动绑定真实角色或直接进入口型/数字人合成 |
| `voice.tts` | 旁白段落与预计时长计划 | 不得生成或播放"已合成"语音，不得写入已完成音频 URL |
| `subtitle.generate` | 基于文本的字幕草稿/EDL，时间码标记 `estimated=true` | 不得标记为最终字幕或烧录成片 |
| `beat.detect` | 节拍点计划（整数毫秒）或人工提供节拍 | 不得宣称已完成自动节拍检测 |
| `timeline.compose` | JSON/EDL 时间线、依赖清单、缺口列表 | 不得输出"已渲染成片"状态 |
| `export.render` | 可下载的 JSON/EDL；如需视频仅允许带明显水印的无声占位预览 | 不得生成可对外发布的成片或将占位视频计为完成 |

UI、API 和验收报告统一使用"时间线计划（能力模拟）""待接入 TTS/ASR"等文案；只有对应能力就绪度变为 `ready`、Provider 健康且真实产物通过质量门后，状态才可变为 `rendered/succeeded`。Tier B MVP 的"闭环完成"定义为计划可审阅、可导出、可恢复，不等同于真实音视频交付。

#### 5.0.2 Tier A 首期真实能力边界（R20 新增）

`narrative`、`marketing` 首期只承诺以下"真实"能力，作为产品文案、验收与后续实施共用的可验收基线：

- **真实交付（就绪度 `ready`，真实供应商）**：`image.generate`、`video.generate`（含 H3）、`video.merge`（已生成镜头按序拼接、音频透传镜头自带音轨）；产物可写 `video_url`、可下载整集拼接视频。
- **不属于 Tier A 首期承诺（就绪度 `gap`/`partial`）**：`voice.tts`、`subtitle.generate`、`timeline.compose`、`export.render`（多版本/字幕/音轨合成导出）及 TTS/ASR/节拍相关能力。未接入真实能力前，这些环节只能落为计划占位或标注"外部后期承接"，**不得**把 narrative/marketing 产物表述为"完整成片""含配音字幕成片"等。
- **文案与验收口径统一**：Tier A = "AI 画面/镜头 + 整集拼接片"。5.1 narrative 与 5.5 marketing 流程图末段（配音/字幕/时间线/合成导出）首期对应为"计划占位 → 外部后期或轨道 B"；能力就绪并接入后才升级描述，不影响项目快照与历史项目行为。

### 5.1 叙事剧情 `narrative.standard`

原文/剧本 → 结构化剧本 → 角色/场景/道具 → 分镜段/切镜 → 图片与视频提示词 → 图片/视频生成 → 配音/字幕 → 时间线 → 合成导出。

> 首期范围（5.0.2）：narrative 为 Tier A，真实交付至"图片/视频/H3 生成 + 整集拼接"；流程末段的配音/字幕/时间线/合成导出在能力接入前只作计划占位，由外部后期或轨道 B 承接。

硬规则：角色、场景、道具使用外部 ID；段级视频任务与切镜分离；单段不超过 15 秒。

### 5.2 口播对话 `talking.standard`

文案/音视频 → 转写 → 说话人识别 → 口播/对话脚本 → 镜头规划 → 真人/TTS/数字人 → 字幕 → 时间线 → 导出。

硬规则：说话人 ID 与字幕时间轴必须一致；无说话人识别结果时只能人工确认，不自动合成。

### 5.3 纪实实拍 `documentary.standard`

素材导入 → 媒体元数据分析 → 场景/静音/高光切点 → 剪辑计划 → 字幕/旁白/音乐 → 时间线 → 导出。

硬规则：原始媒体只读；剪辑计划引用源媒体时间码；替换源文件前检查下游引用。

### 5.4 知识资讯 `knowledge.standard`

文稿/课件/录屏 → 章节/知识点 → 讲解脚本 → 课件/屏幕分析 → 画面规划 → 配音/虚拟人 → 字幕与重点标注 → 合成导出。

硬规则：章节、知识点和引用资料保留来源定位；重点标注与字幕使用同一时间基准。

### 5.5 产品品牌营销 `marketing.standard`

产品资料/卖点/品牌资产 → 受众与卖点分析 → 营销脚本 → 产品镜头 → B-roll/图片/视频 → 配音字幕音乐 → 多版本合成 → 平台导出。

> 首期范围（5.0.2）：marketing 为 Tier A，真实交付至"图片/视频/H3 生成 + 整集拼接"；流程末段的多版本/配音字幕/平台导出在能力接入前只作计划占位，由外部后期或轨道 B 承接。

硬规则：Logo、商标和免责声明为锁定资产；输出版本只改变 Output Profile，不复制策划数据。

### 5.6 音乐节奏视听 `music.standard`

音乐/歌词 → 音频分析 → BPM/节拍/段落 → 视觉风格 → 镜头/素材规划 → 画面生成 → 节拍对齐 → 歌词字幕 → 合成导出。

硬规则：切点使用整数毫秒；音频变速或裁切必须记录处理参数，避免画面与歌词漂移。

## 6. 风格、生产模式与输出 Profile

### 6.1 风格预设

风格与类型独立。现有 `style_presets` 保持兼容，新增 `realistic`（半写实厚涂）预设，禁止把 shuohao `realistic` 映射为平台 `3d`。跨阶段 `sourceStyle` 与 artifact 顶层 `style` 不一致时给出警告并记录，不在首期阻断。

风格预设可影响图片/关键帧提示词、字幕主题、调色、转场、音乐、封面和品牌包装；资产级显式提示词优先于平台默认风格词。

### 6.2 生产模式

统一枚举：`ai`（全 AI）、`hybrid`（混合）、`live_action`（全实拍）、`manual`（人工素材）。每个模板声明支持的模式和可跳过阶段；不支持的组合在创建表单阶段阻止提交。

### 6.3 输出 Profile

至少包含比例、分辨率、帧率、编码、音频采样率、字幕策略、封面规格和平台标签。内置 `vertical_9_16`、`landscape_16_9`、`square_1_1`。同一项目可生成多个输出版本，共享策划和资产版本。

## 7. shuohao 策划包导入 MVP

### 7.1 包格式

平台清单固定命名为 `preproduction-manifest.json`；shuohao 原生 `manifest.json` 仅作为分镜投产包清单，不参与平台包识别。

```json
{
  "format": "jisu-preproduction",
  "version": "1.0",
  "source": "shuohao-skills",
  "title": "渡口",
  "sourceStyle": "realistic",
  "artifacts": [
    {"kind": "outline", "filename": "渡口-outline.json", "sha256": "..."},
    {"kind": "cast", "filename": "渡口-cast.json", "sha256": "..."},
    {"kind": "art", "filename": "渡口-art.json", "sha256": "..."},
    {"kind": "script", "filename": "渡口-script.json", "sha256": "..."},
    {"kind": "storyboard", "filename": "渡口-storyboard.json", "sha256": "..."}
  ]
}
```

文件名只用于绑定上传对象；拒绝绝对路径、`..`、目录、符号链接语义和重复文件名。包内容按 SHA-256 做幂等判断。

### 7.2 导入依赖与范围

```text
outline ──→ cast / art ──→ script ──→ storyboard
```

允许只导入 outline 形成草稿。storyboard 必须有可解析的 script、art 和资产引用；缺依赖时只生成预览错误，不创建视频任务。

outline 的全集 `ep` 创建全部剧集壳，状态为"待导入剧本"；script/storyboard 只覆盖部分集时按 `ep` 填充。预览和确认页显示"N 集壳 + M 集含剧本"。首期只允许新建项目，后续批次追加属于迭代 5。

### 7.3 关键校验规则

| 范畴 | 规则 | 级别 |
| --- | --- | --- |
| manifest | 格式、版本、文件哈希、文件种类唯一 | 阻断 |
| schema | 每个 artifact 通过对应 JSON Schema；未知字段保留但不参与写库 | 阻断/警告 |
| cast | 角色有外部 ID 才自动导入；无 ID 必须人工绑定 outline 的 `Cxx`，不得按姓名静默合并 | 阻断 |
| episode | `ep` 为正整数且不重复；outline 全集与批次覆盖关系可解释 | 阻断 |
| scene | 固定解析 `storyboard.episodes[ep].segments[].sceneIndex → script.episodes[ep].scenes[sceneIndex-1].sceneId → art.scenes[].id → scenes.id` | 阻断 |
| storyboard | 段 ID 唯一；切镜时长为正且不超过 15 秒；`cut_number=1` 为主帧 | 阻断 |
| 时间 | `duration_ms = Math.round(cut.seconds × 1000)`；`start_ms = Σ(各前序 duration_ms)`；毫秒级换算统一采用 `Math.round`，段/集/项目聚合到秒时向上取整，禁止浮点累加 | 阻断 |
| promptLang | 缺失默认 `en`；显式值只允许 `zh/en`；frame 图像提示词继续遵循英文规则 | 阻断 |
| style | manifest 与 artifact 顶层 style 不一致给出差异警告并记录 | 警告 |
| 业务映射 | `params.genre → dramas.genre`；`params.episodes → dramas.total_episodes`；`minutesPerEpisode × episodes → total_duration` | 阻断/警告 |

### 7.4 cast 无 ID 确认协议

校验阶段保存 `validation_id`、上传文件 SHA-256 和候选角色列表。确认请求的 `castMappings` 必须引用该 validation 快照；重新计算的文件哈希不一致或 validation 过期即拒绝。TTL 冻结为 24 小时，并在界面显示失效时间；相同 `content_hash + validator_version + input_fingerprint` 的未过期校验可复用，但任何 approve 都必须新建独立的 `preproduction_imports` 实例。

### 7.5 导入映射

| shuohao 数据 | JisuVideo 落点 |
| --- | --- |
| outline 基本信息 | `dramas` + `preproduction_artifacts` |
| outline `beats` | `preproduction_beats` |
| outline episodes | `episodes` 全集壳及集级快照 |
| cast | `characters` + `preproduction_id_maps` |
| art scenes/props/variants | `scenes`、`props`、`asset_variants` |
| script scenes/dialogue | `episodes.script_content` + artifact 原文快照 |
| storyboard segment | `storyboards` |
| storyboard cut | `storyboard_cuts` |
| H3 prompt/promptLang | `storyboards.minimax_h3_prompt` + 包级语言字段 |
| 原始文件和校验结果 | `preproduction_artifacts`、对象存储/隔离文件区 |

导入 JSON 阶段不预插 `storyboard_reference_assets` 空记录；生成图片后再按 cut 顺序写入，以支持 H3 参考图复用。

### 7.6 cut 首期定位（v2.1 已确认，原因 R4）

现有 `storyboards` 表一行=一个分镜段（`storyboard_number`），`video_prompt`/`minimax_h3_prompt`/`video_url` 与生成任务均以**段**为粒度。`storyboard_cuts` 为新增表，首期仅作为**展示层资产**：承接导入、校验、预览、时长换算与参考图顺序（`storyboard_reference_assets` 按 cut 排序提交 H3 参考图，`cut_number=1` 主帧优先）；**生成任务仍以段为单位**，`video_url` 写回段。cut 级生成任务（每 cut 一个视频）列入 Level 2 能力，不进首期，`episode.vue` 工作台不改；`generation.ts` 按 R23 允许做兼容性最小改造（提取共享 task-factory，见 9.3/12.2），但不涉及 cut 语义或段粒度变化。

## 8. 数据模型与迁移

### 8.0 导入数据关系与状态机（v2.2 新增）

`preproduction_packages` 是不可变内容寻址记录：文件落盘并计算 `content_hash` 后仅保持 `uploaded`，不承载校验或导入结果。校验结果只属于 `preproduction_validations`，项目绑定和导入结果只属于 `preproduction_imports`，从而避免 package 的"不可变"与可变状态相冲突。

```text
package(uploaded, immutable)
  ├─ validation: pending → valid|invalid → expired
  └─ import: pending → importing → succeeded|failed|rolled_back → drama
```

同一 package 可有多个 validation 和 import；同 hash 未过期且 validator/input 指纹一致时仅复用 validation 结果，不复用用户权限或项目绑定。完整状态迁移、权限与限制摘要见 0.3；本节定义落库字段与事务边界。

### 8.1 项目字段

`dramas` 增加或确认：

```text
video_type, video_subtype, workflow_family,
workflow_template_key, workflow_template_version,
input_profile, visual_mode, presenter_mode,
style_preset_id, output_profile, workflow_snapshot_json
```

历史项目默认 `video_type=narrative`、`workflow_family=legacy`，不回填虚构的模板版本。

**字段语义隔离（v2.1 已确认，原因 R8）**：

- `video_type`（生产类型：narrative/talking/documentary/knowledge/marketing/music）与现有 `genre`（题材，如"都市""悬疑"，已有 `dramas.genre` 字段）**语义不同，不得合并**；
- 时长单位统一为**秒**（INT）：`dramas.total_duration`、`episodes.duration`、`storyboards.duration`；`minutesPerEpisode × 60 × episodes` 先换算为秒；涉及 cuts 时统一先换算为整数毫秒，段/集/项目落库再按"向上取整到秒"聚合，禁止浮点累加；换算公式 `dramas.total_duration = Σ episodes.duration`；
- `dramas.metadata` 只保存导入清单、扩展参数和快照摘要，不作为类型字段真源；新增列必须通过显式、幂等 `ALTER TABLE` 迁移并在 `schema.ts` 同步登记。

### 8.2 新增表

| 表 | 关键字段/索引 | 用途 |
| --- | --- | --- |
| `video_type_catalog` | `key + version` 唯一 | 类型、场景、Schema、启用状态 |
| `workflow_templates` | `key + version` 唯一、hash | 模板注册、来源、启用状态 |
| `agent_profiles` | `key + version` 唯一 | Profile、输入输出 Schema、质量门 |
| `project_workflow_snapshots` | `drama_id + revision` 唯一 | 项目创建时冻结模板/Profile/配置 |
| `preproduction_packages` | `content_hash` 唯一；状态固定 `uploaded` | 导入包原始索引、清单和来源（不可变，不绑定项目） |
| `preproduction_validations` | `package_id + validator_version + input_fingerprint` 索引 | 校验快照、错误/警告、TTL、创建者 |
| `preproduction_imports` | `approve_idempotency_key` 唯一（首期单用户下全局唯一；R21 引入多用户后按 actor 作用域）；`drama_id` 索引 | 每次 approve 的项目绑定实例和审计记录 |
| `preproduction_artifacts` | `package_id + kind + sha256` 唯一 | 原始 JSON、Schema 结果、覆盖集号 |
| `preproduction_id_maps` | `package_id + entity_kind + external_id` 唯一 | C/S/P 与数据库 ID 映射 |
| `preproduction_beats` | `package_id + external_id` 唯一 | 爽点表及集号、setup、payoff |
| `storyboard_cuts` | `storyboard_id + cut_number` 唯一 | cut、时长、切点、frame/video prompt |
| `asset_variants` | `asset_id + variant_of_id` 索引 | `variantOf` 母子关系、变体差异 |
| `workflow_runs` | `drama_id + idempotency_key` 唯一 | DAG 执行、阶段状态、重跑关系；项目实体在当前库以 `dramas` 表表示 |
| `sys_task`（变更） | `scope + idempotency_key` 普通索引；`request_fingerprint` 普通索引 | 防止工作流重试/用户重跑重复创建付费图片或视频任务 |

`storyboard_cuts` 首期定位见 7.6（展示层资产，不参与生成任务）。

所有新增表必须同时更新 `backend/src/db/mysql-schema.ts` 与 `backend/src/db/schema.ts`，并由显式幂等 migration runner 建立。`CREATE TABLE IF NOT EXISTS` 不得被当作已有表字段迁移方案。

#### 8.2.1 最小字段与索引冻结（v2.2 新增）

以下字段为首期最小实现；JSON 字段用于快照，不替代可查询列。

| 表 | 最小字段（类型为 MySQL 语义） | 约束/索引 |
| --- | --- | --- |
| `preproduction_packages` | `id BIGINT PK`、`content_hash CHAR(64)`、`format_version VARCHAR(32)`、`source VARCHAR(64)`、`storage_key VARCHAR(512)`、`manifest_json JSON`、`status ENUM('uploaded')`、`created_by BIGINT`、`created_at DATETIME(3)`、`updated_at DATETIME(3)` | `UNIQUE(content_hash)`；内容和状态不可变，原文不得写日志 |
| `preproduction_validations` | `id BIGINT PK`、`package_id BIGINT`、`validator_version VARCHAR(64)`、`input_fingerprint CHAR(64)`、`status ENUM('pending','valid','invalid','expired')`、`result_json JSON`、`error_count INT`、`warning_count INT`、`expires_at DATETIME(3)`、`created_by BIGINT`、`created_at DATETIME(3)` | `INDEX(package_id,status,expires_at)`；同一指纹可复用 |
| `preproduction_imports` | `id BIGINT PK`、`package_id BIGINT`、`validation_id BIGINT`、`drama_id BIGINT`、`actor_id BIGINT`（首期固定为本地操作者，R21）、`approve_idempotency_key VARCHAR(128)`、`status ENUM('pending','importing','succeeded','failed','rolled_back')`、`mapping_json JSON`、`error_json JSON`、`created_at DATETIME(3)`、`completed_at DATETIME(3)` | 首期 `UNIQUE(approve_idempotency_key)`；引入多用户后升级 `UNIQUE(actor_id,approve_idempotency_key)`；`INDEX(drama_id)` |
| `project_workflow_snapshots` | `id BIGINT PK`、`drama_id BIGINT`、`revision INT`、`template_key VARCHAR(128)`、`template_version VARCHAR(32)`、`profile_versions_json JSON`、`config_json JSON`、`snapshot_hash CHAR(64)`、`created_by BIGINT`、`created_at DATETIME(3)` | `UNIQUE(drama_id,revision)`；快照不可更新 |
| `workflow_runs` | `id BIGINT PK`、`drama_id BIGINT`、`parent_run_id BIGINT NULL`、`idempotency_key VARCHAR(128)`、`input_revision CHAR(64)`、`status ENUM('pending','running','succeeded','failed','cancelled')`、`stage_state_json JSON`、`output_revision CHAR(64) NULL`、`error_json JSON NULL`、`actor_id BIGINT`（首期固定为本地操作者，R21）、`started_at DATETIME(3) NULL`、`completed_at DATETIME(3) NULL`、`created_at DATETIME(3)` | `UNIQUE(drama_id,idempotency_key)`；`INDEX(drama_id,status)` |
| `sys_task`（新增列） | `scope VARCHAR(64) NULL`、`idempotency_key VARCHAR(128) NULL`、`request_fingerprint CHAR(64) NULL`、`workflow_run_id BIGINT NULL`、`provider_task_id VARCHAR(256) NULL`、`created_at/updated_at DATETIME(3)`（沿用原字段） | `INDEX(scope,idempotency_key)`、`INDEX(request_fingerprint)`；首期允许 NULL 兼容历史 |
| `asset_variants` | `id BIGINT PK`、`asset_id BIGINT`（变体资产）、`variant_of_id BIGINT`（母资产，同一 assets 实体）、`changes_json JSON`、`source_hash CHAR(64)`、`status ENUM('active','archived')`、`created_at DATETIME(3)` | `UNIQUE(asset_id,variant_of_id)`；删除母资产前必须阻断或级联归档 |

所有外键按现有数据库策略选择显式 FK 或应用层校验，但必须记录 `drama_id` 归属并在查询层强制过滤。`scope` 取值建议 `drama:{id}`、`workflow:{runId}`、`legacy`；付费媒体任务必须使用 `drama:{id}` 作用域。

### 8.3 事务与幂等

导入采用**独立提交的两段事务**（R22 修订；import 记录与业务写入不得在同一事务内，否则业务回滚会连失败诊断一起消失）：

1. **事务 T1（独立提交）**：创建并提交 `preproduction_imports(pending)` 记录（含 `package_id + validation_id + approve_idempotency_key + drama_id`，drama_id 可先预分配或成功后回填）；此时仅导入实例落库。
2. **事务 T2（独立提交）**：导入业务数据，顺序为 `dramas → episodes（按 outline 全集） → characters/scenes/props → episode 关联表 → storyboards/storyboard_cuts → id_maps/beats/artifacts`。T2 内任一步失败则整段回滚，业务数据零残留。
3. **事务 T3（独立提交）**：T2 成功后把 import 更新为 `succeeded`；T2 失败后用独立事务把 import 更新为 `failed` 并保存**脱敏诊断**（`error_json`，只含 JSON Path/artifact kind/外部 ID/修复建议）。T1/T3 均短事务，T2 为长事务。

仅在后续提供"撤销本次导入"能力且完成反向删除/归档审计时，才允许使用 `rolled_back`，不得把普通异常误记为回滚。`preproduction_packages` 与 validation 在任何路径都保持原始/校验事实，不以导入结果覆盖。所有批量写入使用显式事务、唯一索引和 `source_hash`；相同原始包可复用校验结果，但 `approve` 的唯一键必须为 `approve_idempotency_key`（首期全局唯一，R21 多用户扩展后为 `actor_id + approve_idempotency_key`），并显式绑定新建的 `drama_id`，不得把同一 package 记录静默复用到不同项目。

**集成验收项（R22 新增）**：导入中途失败（在 T2 内任意位置注入失败）后断言：业务数据为零（`dramas`/`episodes`/`characters`/`scenes`/`storyboards` 等均无残留）、`preproduction_imports` 记录为 `failed` 且 `error_json` 诊断可查询、`preproduction_packages`/`validation` 事实未变。

### 8.4 局部重跑的成本与幂等语义（v2.1 已确认，原因 R7）

- 现有 `sys_task` 无幂等键，且 `generation.ts` 明确"创建请求不自动重试，避免重复扣费"；`workflow_runs.idempotency_key` 仅防重复提交，不防"用户主动重跑产生新扣费"。
- 默认策略：阶段输入哈希（`input_revision`）未变时，重跑**直接复用** `result_url`/本地产物，零成本；仅当用户显式选择"强制重新生成"才重新调用供应商。
- `rerun-stage` 在确认前返回 `estimate_cost`（重跑阶段成本 + 已复用阶段 0 成本），前端必须展示成本确认（见 9.3）。
- 导入中途失败时业务事务回滚、业务数据零残留，`preproduction_imports` 记录保留 `failed` 与诊断（按 8.3 两段事务，诊断经独立事务 T3 写入，不被回滚吞掉）；不可变 package 和 validation 事实不被覆盖，已生成媒体 URL 不被静默清空（沿用现有行为）。
- 指纹规则：`request_fingerprint = SHA-256(capability + provider/model + canonical_input + asset_hashes + output_profile + input_revision + force_nonce)`；JSON 必须 canonicalize，密钥、展示标题和瞬态时间戳不得参与。常规重试的 `force_nonce` 为空；强制重新生成必须使用新的随机 `force_nonce`，从而产生新指纹和新任务记录。
- 字段职责分离：`idempotency_key` 是服务端按作用域确定性派生的业务防重键（示例：`drama:{dramaId}:{capability}:{input_revision}`），用于同一意图只创建一个任务；`request_fingerprint` 是请求内容指纹，用于检测可复用结果、校验供应商恢复和区分强制重生成。两者均写入 `sys_task`，不可由客户端直接指定。

## 9. API 契约

### 9.1 类型与模板

```text
GET  /api/v1/video-types
GET  /api/v1/video-types/:key
GET  /api/v1/workflows?type=&subtype=&mode=
GET  /api/v1/workflows/:key/:version
```

### 9.2 导入

```text
POST /api/v1/preproduction/validate
GET  /api/v1/preproduction/validations/:id
POST /api/v1/preproduction/validations/:id/approve
GET  /api/v1/preproduction/packages/:id
GET  /api/v1/preproduction/packages/:id/diff
GET  /api/v1/preproduction/packages/:id/issues
```

`validate`/`approve`/读取接口在**首期单机单用户**部署下均以本地操作者身份调用（R21：无登录/角色概念，本方案不引入 users/session/auth 与权限矩阵）；调用约束退化为**数据归属校验**与**操作确认**。`validate` 只返回 `validation_id`、artifact 摘要、覆盖集号、ImportPlan、阻断错误/警告和待确认 cast 映射，不写 `dramas` 等业务表。单文件 50 MiB、总包 200 MiB、JSON 深度 12、数组 10,000 项和 artifact 100 个均在上传/解析前后双重校验。`approve` 必须携带用户最终确认的标题、风格、比例、castMappings 和 `approve_idempotency_key`；服务端创建 `preproduction_imports`，不可将 package 直接当作项目。

读取 `validation`、`package`、`diff`、`issues` 前仍须校验记录归属（所属 `drama_id` 或创建者），禁止仅凭 package_id/validation_id 跨项目枚举读取；未绑定项目的 validation 不向无关上下文返回原文。登录用户、创建者/成员/管理员角色及跨用户隔离列入**未来多用户扩展**（与认证基础设施一并排期，见 12.1），不作为首期契约。

默认值优先级：`manifest.title（用户可改） > outline.source`；风格默认取 `manifest.sourceStyle` 映射结果；比例默认 `16:9`。预览页显示最终可编辑值。

### 9.3 生产执行

```text
POST /api/v1/workflow-runs
GET  /api/v1/workflow-runs/:id
POST /api/v1/workflow-runs/:id/retry
POST /api/v1/workflow-runs/:id/rerun-stage
POST /api/v1/tasks                 # 复用现有图片/视频任务入口（经共享 task-factory，R23）
GET  /api/v1/episodes/:id/generation-tasks
```

重跑请求必须说明 `stage_id` 和 `input_revision`；依赖输入版本变化时自动扩展受影响阶段，否则拒绝使用过期输出。`retry` 仅复用或恢复既有指纹；`rerun-stage` 的 `force=true` 须二次确认预计费用并提交成本确认令牌，服务端生成新的 `force_nonce`，客户端不得自行伪造请求指纹。R21：首期单机单用户不区分角色，创建者/成员/管理员权限限制与成本确认令牌的签发规则列入未来多用户扩展。

`rerun-stage` 在确认前必须返回 `estimate_cost`（预估新增费用与将复用阶段的列表）；前端展示"将重新生成 N 个阶段（预计成本 X）、复用 M 个阶段（0 成本）"，确认后才提交。

### 9.4 错误 DTO 与状态码

统一返回 `{ code, message, details?, request_id }`。建议错误码：`4001 INVALID_MANIFEST`、`4002 SCHEMA_INVALID`、`4003 CROSS_STAGE_MISMATCH`、`4004 VALIDATION_EXPIRED`、`4005 HASH_MISMATCH`、`4031 IMPORT_FORBIDDEN`、`4032 RERUN_FORBIDDEN`、`4091 IDEMPOTENCY_CONFLICT`、`4092 PROJECT_CONFLICT`、`4130 PACKAGE_LIMIT_EXCEEDED`、`4221 UNSUPPORTED_MODE`、`5031 PROVIDER_UNAVAILABLE`。`details` 只返回脱敏后的 JSON Path、artifact kind、外部 ID 和修复建议。

## 10. 前端工作台

### 10.1 创建项目

```text
[类型选择(默认 narrative)] → 内容输入(AI 提炼) 或 场景/参数向导
→ 生产模式 → 风格 → 输出规格 → 模板预览 → 创建
```

**兼容式改造（v2.1 已确认，原因 R5）**：保留现有"内容输入 → AI 提炼 → 选标题/风格/比例"两步流程为默认路径；类型选择作为创建对话框第一步的可选字段（默认 narrative），仅当所选类型需要额外参数（如 music 的音频源、documentary 的素材清单）时展开对应 Schema 表单。完整向导（一级类型→二级场景→输入→模式→参数→风格→输出）作为 Schema 驱动表单的进阶形态，不替换现有路径。

表单由目录 Schema 驱动；字段带默认值、支持模式和校验信息。用户修改后显示将执行的阶段和预计资源消耗，不把供应商密钥暴露到前端。`gap` 能力对应的模式组合在提交前被 gate（见 4.3.1）。

### 10.2 策划包导入

四步界面：上传与识别 → 问题与依赖 → 影响摘要 → 确认导入。

必须展示：文件哈希、覆盖集号、阻断错误、警告、风格映射、H3 语言、`N 集壳 + M 集含剧本`、预计创建的角色/场景/分镜数量，以及无 ID cast 的逐项绑定控件。

### 10.3 项目与分镜页

- 项目页展示类型、模板版本、生产模式、风格、输出 Profile 和导入包来源。
- 剧集页按需加载剧本、节拍、分镜和任务状态，不一次渲染完整 JSON。
- 分镜页展示段与 cut 的层级、`promptLang`、主帧、H3 来源指纹和参考素材顺序。
- 变体 UI 展示母场景、`changes` 和生成结果，禁止把变体当作新主资产覆盖原资产。

## 11. 执行器、任务和 Provider 适配

### 11.1 DAG 执行器

支持拓扑排序、并行上限、条件跳过、阶段超时、指数退避、人工暂停、断点恢复、幂等和局部重跑。状态机：

```text
pending → running → succeeded
                  ↘ failed → retrying → running
                  ↘ skipped
```

阶段输出使用 `run_id + stage_id + input_revision` 作为版本键。跳过阶段必须记录原因，不能以空输出冒充成功。工作流重试只重试非付费/可确认安全阶段；涉及供应商提交的阶段必须先查询 `sys_task` 的请求指纹和上游 taskId，再决定恢复、复用或人工确认。

**媒体复用默认策略（v2.1 已确认，原因 R7）**：`input_revision` 未变时，局部重跑/断点恢复直接复用既有输出（`result_url`/`local_path`），不重新调用供应商；只有用户显式"强制重新生成"才重新付费调用。强制重生成必须生成新的 request fingerprint，不覆盖旧任务记录，成本确认见 8.4/9.3。

### 11.2 Provider Adapter

统一接口：`capabilities()`、`healthCheck()`、`estimateCost()`、`submit()`、`poll()`、`cancel()`、`normalizeError()`、`redactLog()`。

Provider 选择顺序：项目显式配置 → 服务类型默认配置 → 健康且优先级最高的适配器。连续失败触发熔断，恢复后半开探测。供应商版本、模型、请求摘要和成本写入任务记录。

**供应商选型约束（v2.1 已确认，原因 R9）**：TTS/ASR 优先评估现有已集成厂商的配套能力（MiniMax、Volcengine 均提供语音服务），复用 `ai_service_configs`/`ai_service_providers` 配置体系；新增陌生供应商一律走 Level 3（版本、健康检查、权限、成本、回滚）。首期不新增独立插件中心。

### 11.3 H3 与现有生产链

复用现有 `storyboards.minimax_h3_prompt`、`minimax_h3_source_hash`、`minimax_h3_generated_at`。来源指纹变化只使 H3 结果不可直接复用，不清空已有 `video_url`。参考图使用已有 `storyboard_reference_assets`，按 `sort_order` 提交；执行器在提交 H3 Provider 前对"场景图 + 角色图 + 道具图 + 额外参考图 + 首帧/尾帧"的完整列表统一执行上限：图片最多 9、视频最多 3、音频最多 3、总参考素材最多 12，超限即阻断并返回可定位错误。导入校验只校验可静态确定的引用数量，不重复计算运行时首帧/尾帧。

## 12. 分阶段实施计划

以下估算以 1 名后端、1 名前端、1 名 QA 并行为基准，不含等待法务和供应商授权。

**双轨道并行（v2.1 已确认，原因 R10）**：轨道 A（平台基础设施）与轨道 B（能力开发）并行启动；原"阶段 6 生产适配 7–10 天"把 TTS/ASR/字幕/节拍等从零能力 + 供应商集成全部压缩，按代码现状至少低估 1.8–2.2 倍。Tier B 类型的真实闭环随轨道 B 进度交付，不阻塞轨道 A 上线。

| 轨道 | 阶段 | 周期 | 交付物 | 完成门槛 |
| --- | --- | --- | --- | --- |
| A | 0. 冻结 | 3–5 天 | 类型目录、Schema、映射矩阵、fixture、许可证结论、能力就绪度矩阵定稿 | 关键决策全部签字（含 12.1 新增项）；所有阻断规则有样例；试点判据预定义（见 12.2） |
| A | 1. 注册表 | 4–6 天 | 类型/模板/Profile 文件和读取 API、哈希校验 | 未注册 key 无法执行；历史项目回归通过；narrative 垂直切片与 Level 0 追加演练通过（见 12.2） |
| A | 2. 执行器 | 7–10 天 | DAG、条件、并行、重试、幂等、局部重跑、媒体复用策略 | mock 能力跑通成功/失败/恢复三条路径 |
| A | 3. 导入后端 | 8–12 天 | parser、validator、ImportPlan、事务、映射表、cut 展示层 | 五件套导入不写脏数据；错误可定位到 JSON path |
| A | 4. 导入前端 | 5–8 天 | 上传、预览、影响摘要、cast 绑定、确认、创建流程兼容改造 | 阻断错误时确认按钮不可用 |
| A | 5. 六类基线 | 8–12 天 | 六个模板、Profile、默认参数、端到端 mock | 六类 MVP 闭环全部可执行；Tier A 真实闭环通过 |
| A | 6. 灰度发布 | 3–5 天 | feature flag、指标、告警、回滚脚本 | 灰度期间错误率和成本在阈值内 |
| B | B1. TTS/ASR | 与 A 并行 10–15 天 | 供应商调研、adapter、mock→真实切换 | 至少一个真实供应商 + mock 回退 |
| B | B2. 字幕 | 与 A 并行 5–8 天 | 字幕生成与烧录服务 | 字幕时间轴与段视频对齐 |
| B | B3. 节拍/音频 | 与 A 并行 8–12 天 | 节拍检测、BGM 混音服务 | 切点为整数毫秒；漂移校验通过 |
| B | B4. 时间线/导出 | 与 A 并行 5–8 天 | timeline.compose、export.render | 多版本输出共享策划与资产版本 |
| A | 7. 增量导入 | 后续迭代 | 差异、追加批次、软删除、版本回滚 | 不影响首期新建项目 MVP |

首期总周期建议 8–10 周（原 45–62 天 ×1.8–2.2）。

### 12.1 迭代 0 必须拍板

既有项：cast 无 ID 策略、全集壳范围、sceneIndex 集内换算、时长取整、主帧规则、promptLang 默认值、realistic 预设、许可证结论、错误码/幂等键和 Provider 成本上限。

v2.1 已确认项：能力就绪度矩阵定稿（4.3.1）；Tier A/B 闭环分级（5.0）；cut 首期定位（7.6）；Agent Profile 注入方式（4.4）；局部重跑成本与媒体复用策略（8.4/9.3）；`genre` 与 `video_type` 语义隔离与时长单位（8.1）。

v2.2 新增拍板项：包/validation/import/drama 四实体关系和状态机（0.3）；单文件 50 MiB、总包 200 MiB、深度 12、数组 10,000、artifact 100、TTL 24 小时（0.3/9.2）；`preproduction_imports` 的 approve 幂等边界（0.3/8.2）；`sys_task` nullable→双读→新任务必填的迁移顺序及请求指纹公式（0.3/8.4）；Provider 参考素材上限（图 9、视频 3、音频 3、总数 12）；Tier B 仅时间线计划、无声水印预览的文案边界（5.0.1）；项目/校验/强制重生成权限矩阵（0.3/9）；**变更性质与试点边界**：本方案定性为平台化增量扩展（additive platform extension），**非重构**；试点以 narrative 为垂直切片跑通"类型目录 → Schema 表单 → 模板 → DAG 执行器 → 复用现有 sys_task/H3/合片链"，并以**一次 Level 0 类型追加**（只加目录项/Profile/fixture，不改核心执行器）实证可扩展性；四条边界为：现有链路零行为变化（回归门禁）、`sys_task` 只加列、`generation.ts` 仅做**兼容性最小改造并提取共享 task-factory**（R23：旧入口与新工作流入门统一经其创建任务，禁止新增旁路，见 9.3/12.2）、模板/Profile/能力注册表只增不改。

v2.2 评审修订拍板项（R20–R23，2026-09-02）：Tier A 首期真实能力边界（5.0.2，narrative/marketing 不得宣称含配音/字幕的完整成片交付）；首期单机单用户与 actor 语义（R21，登录/用户/成员/管理员与跨用户隔离列为未来扩展）；导入失败诊断采用两段独立事务并补集成验收（8.3）；任务创建唯一边界——`generation.ts` 兼容性最小改造 + 共享 task-factory，参考素材上限与幂等校验不可被 `/api/v1/tasks` 或任何新入口旁路。

### 12.2 试点垂直切片验收清单（v2.2 新增）

试点类型固定为 narrative（现有链路最成熟、Tier A 真实闭环就绪）；验证对象是"框架链路"而非业务闭环（业务闭环现网已可跑通，不产生新增量信息），并包含一次 Level 0 类型追加演练以实证可扩展性。

**A0 冻结结束判据（试点启动前）**：

- 变更性质签字：additive platform extension，非重构；四条边界书面确认——现有链路零行为变化、`sys_task` 只加列、`generation.ts` 仅兼容性最小改造并提取共享 task-factory（R23）、模板/Profile/能力注册表只增不改。
- 首期部署形态签字：单机单用户，actor=本地操作者，认证/角色鉴权列为未来扩展（R21）。
- narrative 目录项、基线模板、Profile、fixture 与回归基线就绪；12.1 拍板项全部签字。
- 试点成功判据在启动前公示，禁止试点结束后"补定义"。

**A1 注册表结束判据（试点 DoD）**：

1. 框架链路判据：
   - narrative 类型目录由服务端返回并驱动 Schema 表单与模板选择，前端不硬编码一级类型列表；
   - 模板声明的 capability 引用能解析到现有执行器（模板不得直连供应商）；
   - 新任务统一经**共享 task-factory** 创建并写入 `sys_task`，携带 `scope / idempotency_key / request_fingerprint`；旧 `/api/v1/tasks` 入口与新工作流入门共用该边界，参考素材上限与幂等校验不可被旁路；历史任务与恢复逻辑回归可读。
2. narrative 全链路走通：类型目录 → Schema 表单 → 模板注册 → DAG 执行器 → 图片/视频/H3 → 整集拼接（`video.merge`，见 5.0.2 Tier A 真实边界）→ 项目产出。
3. 回归：现有 narrative 创建/生成/合片/任务恢复路径零行为变化；历史项目快照可读取。
4. Level 0 追加演练：追加第二个类型（marketing 或一个 mock 类型），仅新增目录项、Profile、fixture 与前端 Schema，**不改核心执行器代码**；第二类型可创建、可执行。
5. 门禁抽查：未注册 key 无法执行；`gap` 能力组合在表单阶段被 gate；上传/校验限制与权限矩阵抽查通过。

任一判据失败，试点结论为"框架假设不成立或需修订"，回退 12.1 重新拍板，不得带病进入阶段 2。

## 13. 测试、质量门与验收

### 13.1 测试层级

| 层级 | 范围 |
| --- | --- |
| 单元 | parser、SHA-256、Schema、条件表达式、时间换算、ImportPlan |
| 数据库集成 | 事务、唯一索引、幂等、回滚、软删除、Drizzle 映射 |
| API | 状态码、错误 DTO、权限、上传大小/路径安全、TTL |
| 前端 | 类型表单、导入预览、问题列表、确认禁用、差异展示 |
| 端到端 | fixture → 项目 → 资产生成 → 视频任务 → 合片（mock provider） |
| 回归 | 现有 drama/episode/storyboard、H3、任务恢复、FFmpeg 合成测试 |

### 13.2 必备 fixture

完整五件套（outline 60 集、script/storyboard 只覆盖 1–3 集）；cast 缺 ID/重复 ID/哈希变化；sceneIndex 越界或跨集错位；原生 `manifest.json` 混入；promptLang 缺失/zh/非法值；realistic/ghibli 及 style 不一致；`variantOf`；小数秒 cuts、空切镜、超过 15 秒；重复 hash、validation 过期；Provider 超时、部分失败和进程重启恢复。

### 13.3 量化发布门禁

- 单元/API/集成测试通过率 100%；合法 fixture 导入成功率 100%，非法 fixture 均在预期阶段阻断。
- 导入两段事务验收（R22）：在 T2 内任意位置注入失败后，业务数据为零（无孤儿业务记录）、`preproduction_imports` 记录为 `failed` 且 `error_json` 诊断可查询、package/validation 事实未变（见 8.3）；重复请求不新增项目和付费任务。
- 局部重跑只执行受影响阶段，未受影响阶段复用率 100%。
- 现有项目回归通过；历史项目模板快照可读取。
- P95 validate ≤ 5 秒（不含上传）；P95 预览 API ≤ 1 秒。
- 能力就绪度 gate：`gap` 能力的模板模式在创建表单阶段 100% 被阻止；mock 能力在验收报告中标注"能力模拟"。
- 上传限制和 TTL：超过 50 MiB 单文件、200 MiB 总包、深度 12、数组 10,000 项或 artifact 100 个必须 100% 拒绝并返回 `4130`；24 小时后 approve 必须 100% 返回 `4004`。
- 数据与归属：同一原始包可复用 validation，但每个 approve 必须产生独立 `preproduction_imports`；仅凭 package_id/validation_id 跨项目读取未绑定原文必须 100% 拒绝。R21：首期单机单用户无跨用户语义，跨用户/角色授权测试列入未来多用户扩展。
- 付费任务：普通重试仅恢复/复用相同 request fingerprint；`force=true` 必须产生新指纹、新任务和成本确认审计，二者的集成测试均通过；所有付费任务创建必须经共享 task-factory（R23）执行参考素材上限与幂等校验，`/api/v1/tasks` 或其他入口不得旁路该边界。
- Tier B：仅允许 JSON/EDL 和有水印无声占位预览；不得出现"字幕已生成""音频已合成""成片已渲染"等成功文案，真实能力接入前不得用于对外发布。
- Tier A（R20）：narrative/marketing 验收口径为真实图片/视频/H3 + 整集拼接；不得宣称含 TTS/字幕/时间线/音轨合成的完整成片交付；`voice.tts`/`subtitle.generate`/`timeline.compose` 等 gap 能力接入前，对应环节必须标注"外部后期/计划占位"。
- 导入、阶段耗时、重试、Provider 错误、成本和合成失败均有看板及告警。
- 许可证、NOTICE、上游署名链和对外发布范围有书面记录。

## 14. 安全、合规与运维

### 14.1 上传与数据安全

限制单文件 50 MiB、总包 200 MiB、JSON 深度 12、单数组 10,000 项、artifact 100 个；拒绝原型污染字段和重复外部 ID。上传文件保存到隔离临时区，解析时不访问用户路径、网络 URL 或执行内容。原始 JSON 按权限访问，日志仅记录长度、hash、阶段和必要 ID。API Key 只在服务端配置。

### 14.2 观测指标

按类型、模板、Provider 聚合导入成功/失败、阻断原因、警告数、阶段耗时、重试次数、幂等命中、局部重跑、任务积压、Provider 错误、生成成本和合成失败。

### 14.3 灰度与回滚

使用服务端 `PREPRODUCTION_IMPORT_ENABLED` 和按类型 feature flag。发布顺序：内部 fixture → 单项目灰度 → 六类各一个真实项目 → 扩大范围。回滚只关闭入口和新模板，不删除已导入项目；数据库迁移先备份并提供向后兼容脚本。

## 15. 风险与应对

| 风险 | 触发信号 | 应对 |
| --- | --- | --- |
| 类型分支膨胀 | 模板出现大量复制代码 | 强制能力注册表、Profile 和模板 lint |
| 模板配置失控 | 条件/依赖无法解释 | 受限 AST、Schema、注册时静态校验 |
| Agent 输出漂移 | Schema 失败率升高 | 版本化 Profile、示例、质量门和人工采样 |
| 类型与风格耦合 | preset 数量指数增长 | 风格独立、资产级覆盖、禁止组合枚举 |
| Vlog 被迫走叙事链路 | 实拍项目出现无意义抽取 | 条件跳过和 documentary 专用模板 |
| H3/供应商失败 | 超时、限流、模型下线 | Adapter、熔断、备用配置、保留原提示词 |
| 历史项目被破坏 | 模板升级后结果变化 | 项目快照、不可变版本、回归 fixture |
| 许可证冲突 | 无书面授权结论 | 仅内部评估；发布门禁阻断外部部署 |

## 16. 新类型接入分级与 Definition of Done

### Level 0：新增类型/Profile

新增目录项、Profile、默认参数、fixture、前端 Schema；不改核心生产链。DoD：目录可发现、表单可创建、能力 gate 通过、至少一个 mock 闭环通过。

### Level 1：新增工作流模板

组合已有能力，新增模板、输入输出 Schema、前端参数和端到端测试。DoD：模板 lint、依赖图、跳过/重试/局部重跑通过。

### Level 2：新增公共能力

新增执行器、Schema、超时重试、日志、指标、成本标签和局部重跑。DoD：能力契约、幂等和至少一个 Provider Adapter 测试通过。

### Level 3：新增供应商或插件

新增 Adapter、版本、健康检查、权限、成本、熔断和回滚。DoD：安全评审、许可证核查、灰度指标和故障演练。首期不建设完整插件中心。

## 17. 首次启动会行动清单

1. 确认六类一级类型、稳定 key、二级场景和首期模板负责人。
2. 选定无版权风险的五件套 fixture，并跑通 shuohao 自身 selftest。
3. 冻结 `preproduction-manifest.json`、Schema、哈希、TTL 和导入状态机。
4. 拍板 cast ID、全集壳、sceneIndex、promptLang、时长取整和 realistic 预设。
5. 完成数据库字段/索引盘点，确定新表及 `schema.ts`/`mysql-schema.ts` 双登记。
6. 评审 API DTO、错误码、幂等键、权限和上传安全限制。
7. 确认 Provider 优先级、成本上限、熔断阈值和 mock 策略。
8. 建立测试 fixture、发布门禁、指标看板、告警和回滚脚本。
9. 对外展示、分发或商业化前取得 CC BY-NC-SA 4.0、Apache-2.0 及上游署名链的书面结论。

## 18. 最终决策

首期采用：

```text
6 个一级类型
+ 多个二级场景
+ 5 个生产核心 Agent + 2 个现有编排 Agent
+ 版本化工作流模板
+ 能力注册表（含就绪度矩阵）
+ Agent Profile（运行时附加注入段）
+ 公共生产模块
+ 独立风格/生产模式/输出 Profile
+ 项目级快照
+ shuohao 策划包导入 MVP（cut 首期为展示层）
+ Provider Adapter、任务恢复、观测和灰度
+ 单机单用户部署（actor=本地操作者；认证/成员/管理员与多用户隔离为未来扩展，R21）
```

首期闭环承诺（v2.2，评审修订 R20/R21）：**narrative、marketing 为真实供应商闭环，范围限于“真实图片/视频/H3 生成 + 已生成镜头整集拼接”**——TTS 配音、字幕、时间线合成与音轨合成不属于首期承诺，归轨道 B 或外部后期（见 5.0.2）；talking、documentary、knowledge、music 为计划级 MVP 闭环（导入+结构化+时间线计划+JSON/EDL 导出，允许带水印无声占位预览；TTS/ASR/字幕/节拍能力就绪后切换真实供应商）。首期能力缺口在轨道 B 独立排期，不阻塞平台基础设施上线；**Tier A 与 Tier B 均不得对外宣称含配音/字幕的完整成片交付**，能力就绪并接入前以“整集拼接片/时间线计划（能力模拟）”口径交付。

未来新增类型优先走 Level 0/1；只有确实产生新生产能力时才升级为 Level 2，只有供应商或独立团队边界明确时才建设 Level 3。任何实现若无法满足"先验证后写库、版本可追溯、失败可恢复、旧项目不变、未注册不执行"五项不变量，不得进入合并或发布。
