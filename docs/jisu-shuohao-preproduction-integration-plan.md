# JisuVideo-ai 与 shuohao-skills 前期策划包导入方案

> 版本：v1.3（PR 方案版，实施规划，未执行）  
> 制定日期：2026-09-01  
> 依据：两项目结合分析报告、方案分析反馈及 v1.1 复核反馈（均为本次方案评审输入）  
> 首期目标：把 shuohao-skills 已产出的五阶段 JSON 策划包，安全地导入 JisuVideo-ai，并在不破坏既有生产链的前提下用于资产生成、视频任务与合成。

> **当前状态：方案已修订，尚未实施。** 已撤回本轮提出的代码、数据库与界面改动；在产品、技术及许可证决策完成前，不进入开发或部署阶段。

> 修订说明：v1.1 吸收《方案分析反馈》。v1.2 吸收《v1.1 复核反馈》，冻结了 sceneIndex 集内换算、episodes 建集范围、castMappings 哈希绑定、promptLang 默认值、风格一致性警告、时长/切点推导、outline.params 业务映射与 approve 默认值来源链等 9 项实现细节。本次实施严格限定为"新建项目导入 MVP"，导入清单使用 `preproduction-manifest.json`（避免与 shuohao 分镜投产包的 `manifest.json` 冲突）。

## 0. 方案摘要

### 0.1 要解决的问题

shuohao-skills 负责结构化的短剧前期策划，JisuVideo-ai 负责项目管理、资产生成、视频生成和合成。当前两者之间缺少稳定的数据契约、校验边界和可追溯导入链路，直接接入会产生 ID 错配、批次误判、提示词丢失、生产结果被覆盖及许可证不清等风险。

### 0.2 推荐方案

以 `jisu-preproduction/1.0` 为平台契约，使用独立的 `preproduction-manifest.json` 绑定 outline、cast、art、script、storyboard JSON。导入采用“上传 → 解析/校验 → 只读预览 → 用户确认 → 单事务创建新项目 → 异步生产”的分层流程。首期只创建新项目，不修改既有项目；增量导入和差异合并放到后续迭代。

### 0.3 本 PR 的交付物

- 一份可评审、可拆解、可验收的实施方案；
- 冻结的数据契约、ID 映射、依赖顺序、冲突与回滚规则；
- 后端 API、数据库、前端工作台、生产适配和测试发布门禁；
- 迭代 0–5 的工作量、依赖、责任分工和启动会清单。

本 PR **不包含任何运行时代码、数据库迁移、配置或前端改动**。方案获批后，按迭代 0 的门槛重新立项实施。

### 0.4 关键验收结论

只有同时满足以下条件，才允许进入编码：

1. `preproduction-manifest.json` 与 shuohao 原生 `manifest.json` 的边界已冻结；
2. cast 无 ID、sceneIndex 集内换算、全集剧集壳、promptLang、realistic、beats 等决策已有书面结论；
3. 合法 fixture 能通过上游校验和 JisuVideo 预期校验；
4. 导入事务、幂等、回滚、上传安全和许可证门禁均有可执行测试；
5. 产品、后端、前端、QA 及法务负责人明确签字或在项目记录中确认。

## 1. 交付边界与成功定义

### 1.1 首期纳入范围

首期交付的是"**策划包导入 MVP**"，不是把 Codex/Claude 工作流嵌进 JisuVideo。

支持导入下列 shuohao 产物：

| 阶段 | 输入文件 | 首期用途 |
| --- | --- | --- |
| 大纲 | `*-outline.json` | 创建项目、分集、资产引用和策划上下文。 |
| 角色 | `*-cast.json` | 创建角色、保存角色设计/音色信息和主图提示词。 |
| 美术 | `*-art.json` | 创建场景、道具、锚点、光照/状态变体和主图提示词。 |
| 剧本 | `*-script.json` | 创建每集的格式化剧本，并保留结构化节拍。 |
| 分镜 | `*-storyboard.json` | 创建段级视频任务、切镜、关键帧提示词与 H3 提示词。 |

首期允许按阶段渐进导入，但遵循依赖顺序：

```text
outline ──→ cast / art ──→ script ──→ storyboard
  必需          依赖            依赖        依赖
```

- 只导入 `outline`：允许，生成可审阅的项目草稿。
- `cast`、`art`：必须与同一包内的 `outline` 对齐；首期不写入既有项目。
- `script`：要求 `outline`；若引用的角色/场景/道具尚未导入，显示阻断错误。
- `storyboard`：要求 `script` 与相关资产映射完整；首期不允许将不完整的分镜直接变成视频任务。

一个包可含多个 `script`/`storyboard` 文件，每个文件可覆盖 1–3 集；覆盖范围由 JSON 内的 `ep` 字段决定，不能由文件数量推断。首个 MVP 的一次导入始终创建新项目；后续"对既有项目增量追加批次"属于迭代 5。

### 1.2 首期明确不做

- 不在 JisuVideo 后端直接运行 Codex/Claude；
- 不复制 shuohao 全量 `SKILL.md` 作为 Mastra 提示词；
- 不自动覆盖已出图、已出片或已合成的生产结果；
- 不做上游策划文件的在线反向编辑与回写；
- 不改造所有视频供应商；首期以"保留 H3 原提示词 + 复用现有通用视频流程"为准；
- 不承诺商业化授权。许可证核查是上线前置条件，不是开发完成后的补项。

### 1.3 MVP 成功标准

一个合法的五件套样例能够：

1. 被上传、识别和校验，错误不会写入业务表；
2. 经用户确认后创建一个 JisuVideo 项目、剧集、角色、场景、道具、分镜及其关联；
3. 保留全部原始 JSON、文件哈希、映射关系与校验结果；
4. 在项目/剧集页查看五阶段策划内容和导入来源；
5. 从导入的资产生成图片，并从导入的段级分镜创建视频任务；
6. 对已生成内容的后续导入只显示影响和失效状态，不静默删除或覆盖。

## 2. 实施原则与关键决策

### 2.0 v1.1 已冻结的规格修订

- `cast.json` 每个角色必须有可追溯的 `id` 才能自动导入。无 ID 时，预览页必须要求用户逐项显式绑定到 outline 的 `Cxx` 后才允许确认；后端不得按姓名静默合并。团队也可选择严格模式，要求先使用 shuohao 的 `seed` 生成带 ID 的角色骨架。
- 平台包清单固定命名为 `preproduction-manifest.json`；shuohao 原生 `manifest.json` 仅作为分镜投产包清单保留，不参与平台包识别。
- 场次解析固定走 `storyboard.sceneIndex → script.episodes[ep].scenes[sceneIndex-1].sceneId → art Sxx → scenes.id`（sceneIndex 为该集内场次序号，1 起），缺环即阻断分镜导入。
- `outline.beats` 保存为 `preproduction_beats`；H3 的 `promptLang` 按 storyboard artifact 保存，不能默认为项目语言。切镜 `frame` 图像提示词保持其自身的英文规则，不随 H3 语言切换。
- shuohao `realistic` 对应平台新增的 `realistic` style preset，不映射为 `3d`。
- script/storyboard 文件可覆盖多集；导入器按 `ep` 对齐，首期仅支持新建项目，重复包以 source hash 幂等拒绝。
- 所有新增表同时登记 `mysql-schema.ts` 与 Drizzle `schema.ts`，并通过启动时 `CREATE TABLE IF NOT EXISTS` 建立；对既有表的变更必须新增显式、幂等迁移。

### 2.0.1 v1.2 复核后追加的冻结规格

- **sceneIndex 是"该集内场次序号"（1 起）**，换算规则固定为：`storyboard.episodes[ep].segments[].sceneIndex → script.episodes[ep].scenes[sceneIndex - 1].sceneId → art.scenes[].id → scenes.id`。先按 `ep` 定位集，再在**该集**的 `scenes[]` 内按下标取 `sceneId`；同集场次顺序不得颠倒后仍通过校验。
- **episodes 建集范围固定为"全集壳"**：按 outline 的全集 `ep` 创建全部剧集壳（状态"待导入剧本"），script/storyboard 覆盖的集再填充内容。approve 请求与前端"影响摘要"必须明确展示"N 集壳 + M 集含剧本"。
- **cast 无 ID 的用户映射按下标绑定**：`castMappings.characterIndex` 仅在 approve 时重算文件 SHA-256 与该 validation 快照一致的前提下有效；不一致则拒绝并提示重新校验。
- **validation 记录带 TTL（建议 ≥ 24h）**：approve 只接受未过期 validation，UI 标注失效时间。
- **`promptLang` 缺失时默认 `en`**（与 shuohao 官方默认一致）；仅当显式出现且值不在 `{zh,en}` 时阻断。
- **跨阶段风格一致性检查（警告级）**：manifest.`sourceStyle` 与各 artifact 顶层 `style` 不一致时产生警告并展示差异，记录到 `preproduction_packages`；首期不阻断。
- **切点/时长推导固定**：`storyboard_cuts.start_ms` = 前序 cuts.seconds 累加 × 1000（与 shuohao `cutStarts` 同源）；`duration_ms` = 本 cut.seconds × 1000；`storyboards.duration` = Σ cuts.seconds 向上取整；`cut_number = 1` 即主帧，不另设列。
- **outline.params 业务字段落表**：`params.genre → dramas.genre`；`params.episodes → dramas.total_episodes`；`params.minutesPerEpisode → 推算 dramas.total_duration`。
- **approve 默认值来源链固定**：标题默认 `manifest.title`（用户可改），兜底 `outline.source`；风格默认 `manifest.sourceStyle` 的映射结果（用户可改）；比例默认 16:9（用户可改）。

### 2.1 不可妥协的原则

1. **先验证，后写库。** 解析、schema 校验、交叉校验和用户确认均完成后，才进入导入事务。
2. **外部 ID 永久保存。** `C01/S01/P01/E01-01` 不是展示文本，而是跨阶段主键；不得以姓名匹配替代。
3. **段与切分层存储。** `segment → storyboard`，`cut → storyboard_cuts`；不得将全部切镜拍扁成 description 字符串。
4. **原始产物不可变。** 每次导入存一份 artifact 快照与 SHA-256；平台编辑是后续修订，不改写原始包。
5. **生产结果优先保护。** 对已有图片、视频、合片的对象，导入默认只创建版本差异和 stale 标记。
6. **协议优先于提示词。** 先落地 JSON 数据契约与确定性校验，再考虑用 JisuVideo Agent 内生生成。

### 2.2 实施前必须确认的产品决策

| 决策 | 推荐选项 | 若未确认的默认处理 |
| --- | --- | --- |
| 首期导入目标 | 仅"新建项目" | 不支持写入既有项目，避免覆盖风险。 |
| 文件集合 | 允许阶段式导入 | 缺依赖时阻断下游导入。 |
| 分镜粒度 | `segment → storyboard` | 以段时长创建视频任务，切镜只作结构化子记录。 |
| 已存在资产冲突 | 保留平台数据、显示差异 | 不做自动合并。 |
| H3 模式 | 直接保存导入 `h3Prompt` | 非 H3 供应商沿用当前视频提示词工作流。 |
| 许可证 | 完成法务/授权确认后再对外发布 | 开发和内部测试仅保留署名与 NOTICE。 |

## 3. 迭代路线图

以下以一个"后端 + 前端 + 测试"的小团队为估算基准；工作量为开发工作日，不含需求等待、第三方授权、模型调优和验收等待。

| 迭代 | 名称 | 预计工作量 | 依赖 | 可演示成果 |
| --- | --- | ---: | --- | --- |
| 0 | 设计冻结与共同样例 | 3–5 天 | 无 | 策划包 v1 契约、字段映射、fixture、验收用例。 |
| 1 | 解析与只读校验 | 5–7 天 | 迭代 0 | 上传五件套，看到结构/交叉校验和问题定位。 |
| 2 | 数据库与新建项目导入 | 7–10 天 | 迭代 1 | 一键创建可编辑项目，保留快照和 ID 映射。 |
| 3 | 策划包工作台 | 5–8 天 | 迭代 2 | 项目中可浏览五阶段、资产变体与分镜切镜。 |
| 4 | 生产链适配 | 8–12 天 | 迭代 2、3 | 导入资产可出图，段级分镜可创建视频任务/H3 出片。 |
| 5 | 增量导入与影响控制 | 7–10 天 | 迭代 4 | 重新导入显示差异、标记 stale、可逐项确认。 |

建议以迭代 0–2 作为首个里程碑。迭代 3–5 应根据真实用户对导入质量和生产效率的反馈排期。

## 4. 迭代 0：设计冻结与共同样例

### 4.1 目标

把实施中最容易返工的契约、来源优先级和合规问题提前拍板。

### 4.2 任务分解

| 编号 | 任务 | 负责人建议 | 产出 |
| --- | --- | --- | --- |
| D0-01 | 选定无版权风险的端到端故事样例 | 产品/内容 | 原文、五件套 JSON、预期截图/视频清单。 |
| D0-02 | 定义 `jisu-preproduction/1.0` manifest | 后端 | Manifest schema、文件命名、`format/version` 与 hash 规则。 |
| D0-03 | 固化字段映射矩阵 | 后端+内容 | 外部字段、内部表、导入策略、不可逆损失说明。 |
| D0-04 | 决定冲突规则 | 产品+后端 | 新建、跳过、覆盖、并行修订的处理表。 |
| D0-05 | 许可证与 NOTICE 核查 | 产品/法务 | 内部使用与公开部署的许可结论。 |
| D0-06 | 定义验收清单 | QA+产品 | 正常、错误、回滚、幂等、已有生产结果场景。 |

### 4.3 `preproduction-manifest.json` 冻结契约

平台包清单固定命名为 `preproduction-manifest.json`。不得以"自动发现兼容模式"替代清单：这会与 shuohao 分镜导出的 `manifest.json` 冲突。缺少平台清单时，可在前端提供"生成清单草稿"辅助功能，但用户必须审核后再上传。

```json
{
  "format": "jisu-preproduction",
  "version": "1.0",
  "source": "示例短剧",
  "title": "示例短剧",
  "sourceStyle": "realistic",
  "createdAt": "2026-09-01T10:00:00.000Z",
  "producer": { "name": "shuohao-skills", "version": "<git-revision>" },
  "artifacts": [
    { "kind": "outline", "filename": "示例-outline.json", "sha256": "..." },
    { "kind": "cast", "filename": "示例-cast.json", "sha256": "..." },
    { "kind": "art", "filename": "示例-art.json", "sha256": "..." },
    { "kind": "script", "filename": "示例-script-batch-01.json", "sha256": "..." },
    { "kind": "storyboard", "filename": "示例-storyboard-batch-01.json", "sha256": "..." }
  ]
}
```

约束：

- `format` 和 `version` 是解析分支的唯一依据；
- `filename` 只作上传文件绑定，必须唯一，且不接受目录、绝对路径、`..` 或符号链接语义；
- `sha256` 必须在服务端重新计算，不能信任上传值；
- `storyboard/manifest.json` 可作为 shuohao 投产包的附件保留，但不属于 `artifacts`，不得被解析为平台 manifest；
- 原始包里的 HTML、PNG、MP4 不作为必需输入；第一版只收 JSON，媒体在后续扩展。

#### 4.3.1 cast 无 ID 的确认协议

当 `cast.characters[]` 不带 `id` 时，预览 API 只返回候选项，不返回可导入状态。前端必须让用户逐项选择一个 outline `Cxx`，并提交以下单独的确认数据；映射不写回上游 JSON：

```json
{
  "castMappings": [
    { "artifact": "示例-cast.json", "characterIndex": 0, "externalId": "C01" }
  ]
}
```

后端需验证每个 `Cxx` 恰好映射一次、名称/aliases 仅作为 UI 提示而非匹配规则，并把用户确认的来源保存到 `preproduction_id_maps.source_revision`（或等价 JSON 字段）。

`characterIndex` 是 JSON 数组下标，只在"确认提交时该文件与校验时是同一份"时才稳定。因此 approve 时后端必须重算 cast 文件的 SHA-256 并与该 validation 快照比对，不一致则拒绝并提示重新校验。validation 记录带 TTL（建议 ≥ 24h），approve 只接受未过期 validation，前端标注失效时间。

### 4.4 迭代 0 完成门槛

- 评审人确认 `segment → storyboard`、`cut → storyboard_cuts` 和"不自动覆盖"三项不可变决策；
- `preproduction-manifest.json`、`jisu-preproduction/1.0`、`artifacts[].filename` 与 shuohao 原生 `manifest.json` 的处理边界已书面冻结；
- cast 无 ID 的严格/兼容策略、`sceneIndex → script.episodes[ep].scenes[sceneIndex-1].sceneId → art Sxx → scenes.id` 的集内两步解析链、episodes"全集壳"建集范围、`realistic` 风格策略和 `outline.beats` 的结构化存储范围均已拍板；
- 切点/时长推导（`start_ms` 累加、`duration` 取整、`cut_number=1` 主帧）、`promptLang` 缺失默认 `en`、`outline.params` 业务字段映射、approve 默认值来源链与 validation TTL 均已冻结；
- fixture 同时通过 shuohao 自身脚本检查和拟定的 JisuVideo 导入校验，且包含多集批次、不同 artifact 语言、"outline 全集 + script 只覆盖部分集"与"同包 style 不一致"的情况；
- 对许可证存在的疑问有明确的风险记录和决策人，不以口头假设进入对外发布。

## 5. 迭代 1：解析、校验与只读预览

### 5.1 后端实现任务

建议新增模块（路径为建议，不要求与现有结构完全一致）：

```text
backend/src/preproduction/
├── types.ts                 # 输入/输出 DTO、错误码、状态枚举
├── manifest.ts              # manifest 校验、自动发现、哈希
├── parser.ts                # JSON 解析与大小/编码限制
├── validators/
│   ├── outline.ts
│   ├── cast.ts
│   ├── art.ts
│   ├── script.ts
│   ├── storyboard.ts
│   └── cross-stage.ts       # C/S/P 引用、时长、切点交叉校验
├── normalizer.ts            # 外部数据 → 内部 ImportPlan，不写数据库
├── diff.ts                  # 后续增量导入共用
└── errors.ts                # 稳定错误码与字段路径
backend/src/routes/preproduction.ts
```

实现顺序：

1. 为 JSON 上传增加独立接口，**不要复用**当前仅处理媒体的 `routes/upload.ts`。
2. 限制请求体大小、artifact 数量、单文件大小、总展开大小和最大嵌套深度。
3. 将文件保存到隔离的临时目录或内存对象，完成解析后生成 `ImportPlan`；此时不创建 `dramas` 等业务记录。
4. 在 `ImportPlan` 中统一表达：实体数、依赖、警告、阻断错误、拟创建对象、外部 ID、所有可见字段。
5. 对 shuohao 的确定性规则，第一版可先实现**导入安全所必需**的子集，再将全部门禁移植为共享校验包；不可因"验证器尚未完整移植"而跳过引用和时长检查。

### 5.2 首批 API 契约

| 接口 | 请求 | 响应 | 写库 |
| --- | --- | --- | --- |
| `POST /api/v1/preproduction/validate` | multipart：`preproduction-manifest.json` + 多个 JSON 文件 | `validation_id`、artifact 摘要（含 `filename`、`promptLang`）、issues、plan 摘要、待确认 cast 映射 | 仅临时验证记录，可设置 TTL。 |
| `GET /api/v1/preproduction/validations/:id` | 路径参数 | 完整预览、问题、可导入阶段 | 不写业务表。 |
| `POST /api/v1/preproduction/validations/:id/approve` | `target: "new"`、项目基础配置、导入范围 | `package_id`、`drama_id`、导入结果 | 迭代 2 才启用。 |

统一问题格式：

```json
{
  "severity": "error",
  "code": "REFERENCE_NOT_FOUND",
  "artifact": "script",
  "path": "episodes[0].scenes[1].characters[0]",
  "message": "角色 C07 未在 outline/cast 中找到",
  "hint": "请补充角色定义，或删除该场次引用"
}
```

错误码必须稳定，前端不能通过中文错误文案判断逻辑。

### 5.3 最低必需校验

| 类别 | 必需规则 |
| --- | --- |
| 文件安全 | JSON MIME/扩展名只是提示，必须以 JSON parse 为准；拒绝超限、重复 artifact、非法 path。 |
| Manifest | 固定文件名、`format/version`、artifact 文件名唯一、哈希一致、来源一致；拒绝 shuohao 原生 `manifest.json` 作为平台清单。 |
| Outline | `ep` 连续、`C/S/P` ID 唯一、每个引用存在、总集数一致；beats ID 唯一。 |
| Cast/Art | 名称非空；cast ID 必须显式存在或经过用户确认映射；场景/道具 ID 与 outline 可对齐，必需 image prompt 非空。 |
| Script | 每集 `ep` 存在于 outline；场次 C/S/P 引用存在；动作/台词结构合法；目标时长可计算。 |
| Storyboard | 段 ID 唯一、按 `sceneIndex → script.episodes[ep].scenes[sceneIndex-1].sceneId → art Sxx`（集内下标，1 起）解析场景；切镜连续、时长为正、总段时长不超限制；角色/道具引用属于该场；`cut_number=1` 为主帧。 |
| 跨阶段 | outline、script、storyboard 的集号集合可解释；每个 segment 的切镜总时长与 `duration` 一致；H3 切点与 cuts 一致；`promptLang` 缺失默认 `en`、显式出现且值不在 `{zh,en}` 时阻断，而 frame 仍遵循英文图像提示词规则；manifest.`sourceStyle` 与各 artifact 顶层 `style` 不一致时给出警告。 |

### 5.4 前端实现任务

在 `frontend/app/pages/index.vue` 的项目启动区域增加"导入策划包"入口，独立于现有"粘贴原文/上传 TXT/公开 URL"流程。

预览页至少包含：

- 上传区：多选 JSON、拖放、显示已识别的文件类型；
- 校验摘要：阻断错误、警告、可导入阶段、文件哈希；
- 五阶段页签：只读展示对象计数和关键字段；
- 影响摘要：将创建多少集、角色、场景、道具、段和切；
- "导入"按钮仅在无 `error` 时可用；首期只能"创建新项目"。

### 5.5 迭代 1 验收

- 合法 `jisu-preproduction/1.0` 五件套返回完整 `ImportPlan`，数据库中的 `dramas/episodes/...` 数量不变；
- 缺 `outline` 的 `storyboard`、重复 C ID、错场景、错切点均返回字段级错误；
- 验证 API 的输入不能使服务器读取用户指定路径或执行上传内容；
- 导入预览在桌面宽度和窄屏下可用，错误不被长 JSON 淹没。

## 6. 迭代 2：数据模型与新建项目导入

### 6.1 数据库变更策略

JisuVideo 当前以 `backend/src/db/mysql-schema.ts` 的 `CREATE TABLE IF NOT EXISTS` 建表，并对少量历史字段使用手写幂等 `ALTER TABLE`。本功能优先采用**新表**而非给大量老表加不可逆字段；若需要 `ALTER TABLE`，必须加入同样显式、幂等的 migration runner。每个新表还必须登记进 `backend/src/db/schema.ts`，否则 Drizzle 查询层不可用。

新增表建议如下：

| 表 | 主键/索引 | 最小字段 | 用途 |
| --- | --- | --- | --- |
| `preproduction_packages` | `id`；`drama_id` 索引；`content_hash` 唯一索引 | `drama_id`、`format_version`、`source_name`、`source_style`、`content_hash`、`status`、`manifest_json`、`created_at`、`updated_at` | 一次导入的主记录。 |
| `preproduction_artifacts` | `package_id + filename` 唯一 | `package_id`、`kind`、`filename`、`sha256`、`prompt_lang`、`content_json`、`validation_json`、时间字段 | 原始文件与校验快照；`prompt_lang` 位于 storyboard artifact。 |
| `preproduction_id_maps` | `package_id + entity_kind + external_id` 唯一；`internal_id` 索引 | `package_id`、`entity_kind`、`external_id`、`internal_id`、`source_revision`、时间字段 | 外部 ID 到内部数值 ID，保存用户确认的 cast 映射来源。 |
| `preproduction_beats` | `package_id + external_id` 唯一 | `package_id`、`external_id`、`type`、`weight`、`episode_number`、`setup`、`payoff`、时间字段 | 保存 outline 的爽点表；剧集的 `beatsClaimed/hookBeat` 保存在 artifact 快照，并在工作台展示。 |
| `storyboard_cuts` | `storyboard_id + cut_number` 唯一 | `storyboard_id`、`cut_number`、`start_ms`、`duration_ms`、`beat_start`、`beat_end`、`size`、`camera`、`frame_prompt`、`note`、时间字段 | 段内切镜与关键帧指令。 |
| `storyboard_cut_entities` | `cut_id + entity_kind + entity_id` 唯一 | `cut_id`、`entity_kind`、`entity_id` | 保存切级角色/道具，不污染现有段级关联。 |
| `asset_variants` | `entity_kind + entity_id + variant_key` 唯一；`variant_of_id` 索引 | `entity_kind`、`entity_id`、`variant_key`、`variant_of_id`、`label`、`prompt`、`negative_prompt`、`metadata_json`、`asset_id`、时间字段 | 场景光照、道具状态、设定图等可生成变体；`variant_of_id` 指向同实体的父变体（基础变体为空）。 |

`art.scenes[].variantOf` 以 `asset_variants.variant_of_id`（或等价父变体关联）表达，不能只把 `changes` 拼到说明字段。已有的 `storyboard_reference_assets` 用于实际生成后保存 H3 图片参考顺序；导入 JSON 阶段尚无图片资产，不应预先插入空引用。

保留现有 `storyboards` 表：`duration` 填段内 cuts 的总秒数（Σ cuts.seconds 向上取整）；`minimax_h3_prompt` 保存段级 H3 结果；`storyboard_cuts` 存所有切级数据。切点推导固定：`storyboard_cuts.start_ms` = 前序 cuts.seconds 累加 × 1000（与 shuohao `cutStarts` 同源），`duration_ms` = 本 cut.seconds × 1000；`cut_number=1` 即主帧，段内其余为子帧，不另设标识列。

### 6.2 导入事务设计

导入核心数据必须在单一数据库事务中按下列顺序创建：

```text
preproduction_package
  → drama
  → preproduction_artifacts
  → characters / scenes / props
  → preproduction_id_maps（C/S/P）
  → episodes（按 outline 全集创建剧集壳；script/storyboard 覆盖的集填充内容）
  → episode_characters / episode_scenes / episode_props
  → storyboard（segment）
  → preproduction_id_maps（segment）
  → storyboard_cuts / storyboard_cut_entities
  → package.status = imported
```

关键实现要求：

- `ImportPlan` 是唯一写库输入，导入阶段不得再次解析上传文件；
- 每次导入生成 `idempotency_key = validation_id + content_hash`，重复提交返回已有导入结果；
- 事务内使用明确的 insert ID，不通过名称二次查询；
- 图片/关键帧生成、文件复制和视频任务创建不放进此事务；这些是导入完成后的异步用户操作；
- 任何一步失败必须回滚核心业务行，包记录可留为 `failed` 并保留诊断；
- 导入成功后统一读取一次聚合结果返回前端，避免前端自行拼接 ID。

### 6.3 结构化剧本渲染

新增纯函数 `renderImportedScript(scriptEpisode, lookups)`，将 `script.json` 稳定渲染为 JisuVideo 可编辑的 `episodes.script_content`。建议输出格式：

```text
## S01 | 渡船船舱 | 晨雾

动作：……
角色名：（表演提示）台词
```

并在导入 artifact 中保留完整的节拍 JSON。不得以此渲染文本作为后续重导入的唯一事实源。

### 6.4 接口扩展

| 接口 | 责任 |
| --- | --- |
| `POST /preproduction/validations/:id/approve` | 对有效且未过期的 `validation_id` 创建新项目。请求包含标题、风格、比例、导入阶段集合。默认值来源链：标题默认 `manifest.title`（兜底 `outline.source`）、风格默认 `manifest.sourceStyle` 映射结果、比例默认 16:9，均用户可改。 |
| `GET /dramas/:id/preproduction/packages` | 返回项目的导入历史与状态。 |
| `GET /preproduction/packages/:id` | 返回 manifest、artifact 摘要、映射与校验结果。 |
| `GET /preproduction/packages/:id/artifacts/:kind` | 返回指定原始 JSON（权限/大小受控）。 |
| `GET /storyboards/:id/cuts` | 段内切镜列表。 |

所有导入 API 路由设置在 `/api/v1/preproduction`，避免把导入逻辑散落到 `dramas`、`upload` 或各资产 CRUD 中。

### 6.5 迭代 2 验收

- 合法五件套一次导入后，项目详情可读到完整的剧集、资产与分镜；
- C/S/P/segment 外部 ID 全部可查询到唯一内部 ID；
- 任意人为制造的数据库错误会回滚本次业务导入，不留下半个项目；
- 同一个 validation 重复确认不创建重复项目；
- 导入不改变原有项目和现有数据；
- 后端 typecheck 和现有测试均通过，并新增导入事务与映射测试。

## 7. 迭代 3：策划包工作台

### 7.1 项目详情页改造

在 `frontend/app/views/drama/detail.vue` 的现有"原文 / 剧集 / 素材"之外增加"前期策划"页签：

```text
原文 | 前期策划 | 剧集 | 素材
       ├─ 大纲
       ├─ 角色
       ├─ 美术
       ├─ 剧本
       └─ 分镜
```

每个面板应显示：

- 来源包版本、导入时间、校验状态；
- 导入对象和 JisuVideo 实体间的链接；
- 上游原始字段（只读）与当前平台编辑值（若不同）的差异标识；
- 跳转入口：角色→资产、剧本→剧集、分镜→制作工作台；
- "查看原始 JSON"调试入口（仅开发/高级模式，避免日常用户被结构化数据干扰）。

### 7.2 分镜工作台增强

在 `frontend/app/views/drama/episode.vue` 的分镜详情中增加可折叠的"切镜时间轴"：

- 以 `start_ms` / `duration_ms` 绘制时间条；
- 显示景别、运镜、节拍区间、角色/道具；
- 展示主关键帧与子关键帧提示词/图片状态；
- 段级按钮仍是"生成视频"，切级按钮只负责生成/替换关键帧；
- 提示 H3 对齐状态：有效、依赖已变更、需要重新生成。

### 7.3 资产变体 UI

在现有角色、场景、道具详情内增加"基础设定 / 变体"而非为每个变体创建重复实体：

- 场景：默认光照 + 晨/昼/夜/天气变体；
- 道具：默认状态 + 打开/损坏/特写状态；
- 角色：角色设定图、造型变体（第一版可只展示，不强制实现所有生成入口）；
- 每个变体显示来源、提示词、负面词、参考图、当前任务状态。

### 7.4 迭代 3 验收

- 非技术用户可以辨认"上游设计"和"平台生产数据"的区别；
- 用户可以从策划页跳到对应资产/剧集/段，反向也能看见来源；
- 切镜不会被误当成多个独立视频任务；
- 页面不会一次渲染超大 JSON 或所有关键帧，列表采用按需加载。

## 8. 迭代 4：生产链适配

### 8.1 图片生成适配

复用现有角色/场景/道具生成任务，但增加"从变体生成"的服务入口：

1. 读取 `asset_variants` 和其所属的角色/场景/道具；
2. 组合风格预设、基础提示词、变体提示词和负面词；
3. 调用既有 `generateImage` 服务创建 `sys_task`；
4. 成功后写入 `asset_variants.asset_id`，并将图片加入现有 `assets` 素材库；
5. 不覆盖基础资产图，除非用户明确设为默认参考图。

### 8.2 关键帧生成适配

新增按 `storyboard_cut` 生成关键帧的接口：

```text
POST /api/v1/storyboard-cuts/:id/generate-frame
```

执行条件：

- 段关联场景与角色/道具映射完整；
- 若 `frame_prompt` 引用角色/场景，则从其基础设定图/变体图自动提供参考；
- 生成结果写入资产库及 `storyboard_cuts.frame_asset_id`；
- 主/子帧以 `cut_number` 判定：`cut_number=1` 为主帧，其余为子帧（与 6.1 冻结规则一致，不依赖数组顺序猜测）。

### 8.3 视频生成适配

| 视频提供方 | 首期处理 |
| --- | --- |
| MiniMax H3 | 若导入 `h3Prompt` 且来源未过期，直接使用；参考图按 cut 的主/子帧时间排序提交。 |
| Seedance/火山 | 由现有 `video_prompt`/提示词 Agent 生成供应商执行版；不直接复用 H3 的结构化文本。 |
| AutoDL/ComfyUI | 导出段级生产包/引用素材路径，沿用既有适配器约束。 |

新增"来源指纹"计算规则：段的 H3 指纹必须包含段级 H3 文本、cuts 的时长/顺序、所引用关键帧、场景/角色/道具的当前参考图。任一项变化后，将 `minimax_h3_source_hash` 置空并在 UI 标记 stale；不清空已有视频 URL。

### 8.4 迭代 4 验收

- 任意场景光照或道具状态变体可生成图片并在素材库可见；
- 一个含多个 cuts 的 segment 至少可发起一个视频任务；
- H3 的参考图顺序、切点和提示词经导入后可追溯；
- 更换关键帧或素材会使 H3 提示词过期，而不会删除历史视频；
- 现有未导入项目的图片/视频生成回归通过。

## 9. 迭代 5：增量导入、差异与回滚

### 9.1 增量导入流程

```text
新策划包
  → 校验并计算 SHA-256
  → 通过 external ID 对齐旧包
  → 生成 diff（新增 / 修改 / 移除 / 无变化）
  → 计算下游影响（资产 / 关键帧 / 视频 / 合片）
  → 用户按对象确认策略
  → 创建新 package revision
  → 写入允许更新的数据，并将下游标为 stale
```

### 9.2 冲突处理矩阵

| 对象状态 | 上游变化 | 默认策略 | 用户可选操作 |
| --- | --- | --- | --- |
| 未生成资产 | 角色/场景/道具设计变化 | 更新平台字段 | 保留平台版 / 采用上游版。 |
| 已生成图片 | 资产提示词或锚点变化 | 保留图片，标记资产 stale | 重出图 / 指定保留旧图。 |
| 未出片分镜 | cuts、时长、H3 文本变化 | 更新结构化分镜 | 保留平台版 / 采用上游版。 |
| 已出片分镜 | 关键帧/分镜变化 | 保留视频，标记视频 stale | 重出片 / 保留历史。 |
| 已合成剧集 | 任何已使用分镜变化 | 不触碰合片 | 建立新合成版本。 |
| 平台手工编辑 | 同字段上游变化 | 产生冲突，不自动合并 | 比较后选一侧或并行修订。 |

### 9.3 回滚定义

"回滚"不是删除新包，而是把某个 package revision 重新设为当前参考版本：

- 原始 artifact 永不删除；
- 仅未生产或用户显式允许覆盖的字段可回写；
- 已生成资产/视频持续保留并有其生成时的 package 关联；
- 所有选择进入审计日志，便于定位"为什么当前项目与策划包不同"。

### 9.4 迭代 5 验收

- 修改一个 C/S/P/segment 后，差异仅影响相关下游对象；
- 导入到一半失败时项目状态和包修订仍一致；
- 用户可看到每次变化来自哪一份文件、哪条外部 ID、哪次确认；
- 同一修订重复应用不产生重复关联或孤儿 cut/variant 行。

## 10. 测试计划

### 10.1 测试层级

| 层级 | 测试重点 | 推荐位置 |
| --- | --- | --- |
| 单元测试 | parser、hash、schema、cross-stage 校验、时间换算、ImportPlan | `backend/tests/preproduction/*.test.mjs` |
| 数据库集成测试 | 导入事务、幂等、回滚、映射唯一性、软删除隔离 | 独立测试库或临时 schema。 |
| API 测试 | validate/approve/packages/cuts 的状态码和错误 DTO | Hono app 测试。 |
| 前端组件测试 | 上传、问题列表、预览、确认禁用态、差异页 | 沿用前端现有 Node test 方式。 |
| 端到端测试 | 五件套 → 项目 → 图片 → 视频任务 → 合片 | 仅用 fixture 和 mock provider，避免消耗真实额度。 |
| 回归测试 | 原有创建项目、剧本、提取、资产、视频、合片 | 现有 `backend npm test`、`frontend npm test` 加新断言。 |

### 10.2 必备 fixture

- 完整正常五件套；
- 只有 outline 的最小包；
- cast 无 `id` 的包：分别覆盖严格模式拒绝，以及兼容模式中用户逐项显式绑定 `Cxx` 后通过；
- 包内混入 shuohao 原生 `manifest.json`：它只能作为附件，不能替代或污染 `preproduction-manifest.json` 的识别；
- 多个 script/storyboard artifact 但仅覆盖部分集的批次：按 JSON `ep` 建立集号集合，不得按文件数量补齐或推断缺失集；
- outline 全集（如 60 集）但 script/storyboard 只覆盖 3 集的包：验证"全集壳 + 部分集内容"的建集行为与影响摘要展示；
- 同包内各 artifact 顶层 `style` 与 manifest.`sourceStyle` 不一致的包：验证警告级校验与差异记录，不阻断导入；
- cast 无 `id` 且确认后文件被替换的包：验证 approve 时 SHA-256 重算不一致导致拒绝；
- 含 `variantOf` 的场景变体包：验证父场景/变体关系、`changes` 字段及 `asset_variants.variant_of_id` 映射；
- 含 `promptLang: "zh"` 的 H3 分镜：验证该字段保存于对应 storyboard artifact，且切镜 `frame_prompt` 仍使用英文图像提示词；
- 含多个 storyboard artifact 且 `promptLang` 不同的包：验证语言不被项目默认值或其他 artifact 覆盖；
- 重复外部 ID；
- script 引用不存在 C/S/P；
- storyboard cut 时长总和错误；
- H3 对齐时间错误；
- 含多光照、多道具状态、多个 cuts 的复杂包；
- 同一包重复提交；
- 已生成图片/视频后导入新修订的冲突包；
- 非法 JSON、超限文件、带路径穿越 manifest。

### 10.3 发布门禁

在合并到主分支前，至少要求：

```text
后端类型检查通过
后端现有与新增测试通过
前端现有与新增测试通过
shuohao fixture 校验通过
导入事务失败场景无残留业务数据
安全审查通过（上传、解析、HTML 显示、路径）
许可证/NOTICE 检查通过
```

## 11. 发布、观测与运维

### 11.1 功能开关与灰度

- 使用服务端 feature flag `PREPRODUCTION_IMPORT_ENABLED` 控制入口与 API；
- 第一阶段仅开发环境开放；
- 生产首批只对测试用户开放"新建项目导入"；
- 增量更新、变体生产和 H3 直连采用独立开关，便于单独回退。

### 11.2 结构化日志与指标

导入全过程使用现有任务日志风格，增加：

- `package_id`、`validation_id`、`drama_id`、`content_hash`；
- artifact 数量和总字节数；
- 校验耗时、错误/警告数、导入耗时；
- 导入创建的实体数量；
- 幂等命中、事务回滚、stale 标记数量；
- 关键帧与视频生成按 package/segment 的成功率。

日志不能打印完整原著、API Key 或超长提示词；对 JSON 内容只记录长度、hash 和必要的 ID。

### 11.3 备份与恢复

- 数据库迁移前做可恢复备份；
- 生产前导入包与 artifact 保留策略需明确（至少与项目生命周期一致）；
- 清理任务不得删除仍被 `preproduction_artifacts`、`asset_variants`、`storyboard_cuts` 引用的媒体；
- 数据修复脚本须支持 dry-run、指定 package ID 和事务执行。

## 12. 人员分工建议

| 角色 | 主要责任 |
| --- | --- |
| 产品/内容负责人 | 确认导入边界、样例、冲突体验和是否允许平台修订。 |
| 后端工程师 | schema、迁移、parser、validator、ImportPlan、事务、API、任务适配。 |
| 前端工程师 | 上传/预览、策划页、时间轴、变体 UI、错误与影响呈现。 |
| AI/提示词工程师 | 将上游设计提示词转换为供应商执行提示词，验证 H3 对齐。 |
| QA | fixture、回归、失败回滚、跨阶段一致性与上传安全测试。 |
| 法务/项目负责人 | CC BY-NC-SA 与 Apache-2.0 的分发、署名、商用授权结论。 |

## 13. 首次启动会的行动清单

1. 确认首期只导入到"新建项目"，不触碰既有项目。
2. 指定一个完整、可公开用于测试的 shuohao 五件套 fixture。
3. 拍板 cast 无 ID 的策略：严格拒绝上游补 ID，或采用用户逐项显式绑定；禁止按名称静默匹配。
4. 评审并确认 `jisu-preproduction/1.0`、`preproduction-manifest.json` 命名、`artifacts[].filename` 约束，以及 shuohao 原生 `manifest.json` 的附件处理规则。
5. 确认 `sceneIndex → script.episodes[ep].scenes[sceneIndex-1].sceneId → art Sxx → scenes.id`（集内下标，1 起）为分镜导入的硬阻断链，并冻结段/切模型。
6. 决定 `realistic` 风格的实现方式（新增预设或显式配置），不得暂时映射为 `3d`；同时确认 `outline.beats` 是否作为首期结构化数据落库，以及跨阶段 `style` 一致性警告的落库位置。
7. 选择数据库迁移策略：新增表先行，补充一套显式 migration runner。
8. 将迭代 1 拆为后端解析/校验与前端预览两个可并行任务。
9. 拍板 episodes 建集范围（推荐 outline 全集壳）、`promptLang` 缺失默认 `en`、`start_ms`/`duration` 推导与取整、approve 默认值来源链，并确认 castMappings 的 SHA-256 绑定与 validation TTL。
10. 在任何对外展示、分发或商业化前，取得 CC BY-NC-SA 4.0 与 Apache-2.0 组合使用的书面许可证结论；未完成时仅限内部评估。
11. 设定发布门禁：安全、事务、回归、许可证检查缺一不可。

## 14. 实施后的下一步（不属于当前 MVP）

当导入链路稳定、真实用户认可其质量门和工作台体验后，再评估以下扩展：

- 在 JisuVideo 内生生成 shuohao 兼容的 outline/cast/art/script/storyboard JSON；
- 共享 shuohao 的纯确定性校验包，减少两套规则漂移；
- 导入/导出标准包，支持团队协作、审稿和第三方工具；
- 接入 TTS，消费 `cast.json` 中的 voice profile；
- 为不同视频供应商建立明确的 `execution_prompt` 与可比较的出片评估；
- 多人审阅、角色权限、包修订比较与审计导出。

这些能力应在 MVP 的数据模型和版本策略之上实现，而不应反向挤压首期导入链路的安全性与可验证性。

## 15. 本 PR 提交说明

### PR 标题

```text
docs: 完善 JisuVideo-ai 与 shuohao-skills 前期策划包导入方案
```

### PR 摘要

本 PR 仅新增前期策划包导入的完整实施方案，不包含运行时代码或数据库变更。方案定义了 `jisu-preproduction/1.0` 数据契约、独立 manifest、五阶段 JSON 的依赖与校验、外部 ID 映射、单事务新建项目导入、工作台展示、生产链适配、增量导入、回滚、测试、灰度和许可证门禁。

### 评审重点

- 是否同意首期只创建新项目，并将既有项目增量导入延后；
- 是否同意 cast 无 ID 必须严格拒绝或由用户逐项显式绑定；
- 是否同意 `sceneIndex` 按集内序号解析，以及 `segment → storyboard`、`cut → storyboard_cuts` 的存储粒度；
- 是否同意 `realistic` 独立风格预设、`outline.beats` 结构化落库和 artifact 级 `promptLang`；
- 是否同意新增表、幂等导入、stale 标记及“不覆盖生产结果”的冲突策略；
- 是否同意许可证书面结论作为对外发布阻断条件。

### 合并后动作

合并后只进入迭代 0：冻结契约、准备 fixture、完成字段映射和法务确认。任何后端、前端或数据库实现须另开实施 PR，并以本方案的迭代 0 门槛和发布门禁为准。
