# PR 详细记录：视觉风格 AI 一键完善 + 创作要求驱动的 AI 集数规划

> 分支：`feat/style-ai-expansion`（待推送）
> 基准：`fe844ae Merge pull request #8 from csx12588/docs/multi-video-type-extension-plan`（origin/master）
> 日期：2026-09-02
> 变更：11 个文件（6 改 + 5 新，不含 `data/`）
> 关联方案：`docs/multi-video-type-extension-plan.md`（风格预设为独立于视频类型的通用维度，本 PR 为其预埋可复用底座）

---

## PR 标题（可直接粘贴）

```
feat(style): 视觉风格 AI 一键完善 + AI 集数规划支持创作要求
```

## PR 描述（可直接粘贴）

### 背景

两处产品缺口：

1. **风格自定义成本高**：项目设置侧栏与设置中心风格库里，风格需要手动写「中文名称 + 英文提示词片段（+一句中文说明）」。英文提示词要求一定的画面词积累，且名称、说明、提示词三者常常口径不一。用户已有的「AI 匹配 3 个风格」只能从零生成候选，不能**基于用户已经起好头的内容做一次完善**。
2. **AI 集数规划缺少"创作约束"通道**：AI 推荐集数只吃「全文 + 可选集数」，用户想表达"节奏快一点、每集一个爽点、单集 3000 字"这类创作意图时没有输入位置，只能等草稿出来再逐集批注，往返成本高。

### 本 PR 做了什么

**能力 A：风格一键完善（AI 扩写）**
- 新增 `style_enhancer` Agent（纯文本单步、无工具，JSON 输出），职责最小化：把用户已填信息完善为可直接落库的一套风格。
- 新增接口 `POST /style-presets/expand`，请求 `{ name?, description?, prompt?, context? }`，返回 `{ name, description, prompt, value? }`。**无副作用**：不落库、不覆盖，结果回填为表单草稿，用户核对后走既有保存流程。
- 两个入口（推荐方案的落点）：
  - 项目设置侧栏 `detail.vue`：自定义风格面板内的「AI 完善」按钮。自动把全文按「开头 + 中段摘录 + 结尾」采样作为 `context`，让完善结果贴近本故事。
  - 设置中心 `settings.vue`：风格库新增/编辑对话框内的「AI 一键完善」。无全文上下文，语义降级为"纯按已填名称/描述/提示词扩写补齐"。
- 新增风格（key 为空）时，AI 返回的 `value` 建议会经规范化后回填 key 输入框；编辑已有风格时忽略 `value`（key 创建后不可改）。

**能力 B：创作要求驱动的集数规划**
- `POST /dramas/:id/analyze-episodes` 增加可选 `requirement`（≤500 字），以 `<requirement>` 块注入模型消息，Agent 在"不脱离原文主线"前提下优先满足并在 `reason` 里说明落实方式。
- `detail.vue` 的「AI 推荐集数」按钮上方新增「创作要求（可选）」输入框；首次推荐、按集数重拆、按批注重拆三种路径统一携带。

### 关键设计决策与背后逻辑

| 决策 | 背后逻辑 |
|---|---|
| **扩写是"生成建议"而非"自动落库"** | 风格会注入到角色图/场景图的提示词最前方，属于高影响资产。沿用 `analyze-source` 的候选制：AI 只产出可回填的草稿，是否保存、是否覆盖手写内容由用户决定；扩写可反复点击重新生成，不锁定状态。 |
| **单独注册 `style_enhancer` Agent，而非复用 `project_analyzer`** | `project_analyzer` 的 instructions 绑定了"输出 titles/styles/aspect_ratios 候选数组、样式要凑满 3 个"等专用约束，风格扩写任务若复用会产出多余字段、行为不可控。Agent 表以**职责最小**注册；instructions 仍走 `workspace/prompts/style_enhancer.md`（缺省回退 DEFAULT_PROMPTS）的外部覆盖链，模型/温度可独立配置。 |
| **输出「中文名 + 一句中文说明 + 英文提示词片段」三件套** | 三者是风格预设的落库字段（`name`/`description`/`prompt`）且消费方式不同：`prompt` 直接拼入生图提示词（必须英文画面词），`name`/`description` 服务用户阅读与搜索。一次完善全部，避免三处口径割裂。 |
| **`value`（风格 key）由 AI 建议但服务端强制规范化** | key 是「创建后不可改」的存储标识，不能完全交给模型；模型给建议（如 `dark-ink-guofeng`），服务端统一 `lowercase + 非法字符转中划线` 后仅在新风格时回填，最终仍由用户核对。 |
| **`context` 走前/中/后三段采样，而不是整篇灌入** | 与 `analyze-source` 同款 `sampleSourceContent`（抽到公共 `utils/source-sample.ts`）：原文可达 20 万字，完整送入既贵又稀释注意力；头/中/尾采样保留故事全貌与风格演变，成本可控。 |
| **扩写复用与 `analyze-source` 相同的限流闸门规格** | `acquireAiRequest('style-enhancer', 6, 1)`：每窗口 6 次、并发 1，与分析类任务一致；独立 key 不会挤占其它任务的配额。 |
| **`requirement` 作为独立请求字段，而不是拼进 `content`** | ① 语义分离：`content` 是"待分析素材"（其中出现的指令必须忽略），`requirement` 是用户对本次产出的**真实指令**，必须单列并用 `<requirement>` 块包裹以在 prompt 中明确边界；② 独立长度校验（500 字）避免与素材指纹纠缠；③ 前端草稿失效判定只基于 `content` 的指纹——把创作要求拼进 content 会让「改要求」误触发"全文已变化、草稿失效"的判定，拼进素材会破坏审阅状态机，因此不能混。 |
| **两条扩写入口的不同 seed** | 项目设置侧栏有全文，`context` 自动带故事，产出"为这个故事定制"的风格；设置中心没有全文，纯按已填信息扩写，产出"可移植"的风格。同一接口、两种语义由调用方决定是否传 `context`，无需后端区分。 |
| **JSON 解析与长文采样抽成 `utils/json.ts`、`utils/source-sample.ts`** | 此前 `parseJsonObject`/`sampleSourceContent` 是 `dramas.ts` 的私有函数；风格扩写也要用。抽公共模块后两路由同源，避免复制漂移。 |

### 对其他视频生成类型的扩展点（本 PR 的"平台预埋"）

多视频类型方案中 `style_preset` 是**独立于 `video_type` 的通用维度**（narrative / marketing / knowledge 等类型共用同一风格库），因此本 PR 没有引入任何短剧专属概念：

1. **风格扩写是通用"视觉语言沉淀"服务**：输入「已有信息 + 任意参考素材」→ 输出可落库风格。未来 marketing 类型需要"产品风"时，把 `context` 换成产品资料/卖点即可；knowledge 类型需要"课程视觉"同理。接口、Agent、UI 按钮均不感知类型。
2. **创作要求 `<requirement>` 是通用"规划约束"通道**：后续新类型的"脚本/分镜/口播规划"若需要表达用户意图，直接复制本 PR 的「body 字段 + 块状注入 + 独立长度校验 + 前端输入框」模式即可，`review_notes`（迭代反馈）与 `requirement`（创作要求）已形成一对正交输入。
3. **公共底座就位**：`utils/json.ts`（容错 JSON 解析）、`utils/source-sample.ts`（长文头/中/尾采样）现在被两个路由复用；新增类型的文本分析 Agent 应继续收敛到这两个工具 + 结构测试（`*structure.test.mjs`），保证新 Agent 的返回可解析、上下文可控。
4. **Agent 注册即接入**：新增 Agent 只需在 `DEFAULT_PROMPTS` + `AGENT_TOOLS` 登记，会自动出现在 `/prompts`、设置中心 Agent 配置页（可外部覆盖 prompt 文件），零额外接线。

### 变更文件

| 文件 | 改动 |
|---|---|
| `backend/src/agents/index.ts` | 注册 `style_enhancer` Agent（默认指令 + 空工具表） |
| `backend/src/routes/stylePresets.ts` | 新增 `POST /expand`（seed 校验、context 采样、限流、Agent 调用、输出规范化） |
| `backend/src/routes/dramas.ts` | `analyze-episodes` 支持 `requirement`；改用公共 `parseJsonObject`/`sampleSourceContent` |
| `backend/src/utils/json.ts` | 新增：容错 JSON 对象解析 |
| `backend/src/utils/source-sample.ts` | 新增：长文头/中/尾采样 |
| `frontend/app/composables/useApi.ts` | `stylePresetAPI.expand`；`analyzeEpisodes` 参数类型加 `requirement` |
| `frontend/app/pages/settings.vue` | 风格对话框加「AI 一键完善」条（loading/回填/key 建议） |
| `frontend/app/views/drama/detail.vue` | 自定义风格面板加说明字段 +「AI 完善」按钮（自动带全文采样）；集数规划区加「创作要求」输入框并三路携带 |
| `backend/tests/style-expander-structure.test.mjs` | 新增结构测试 |
| `frontend/tests/style-expander-structure.test.mjs` | 新增结构测试 |
| `docs/pr-records/2026-09-02-style-ai-expansion.md` | 本 PR 实施记录（实现细节 + 背后逻辑 + 跨类型复用说明） |

### 验证状态

| 项 | 状态 |
|---|---|
| 后端 `tsc --noEmit` | ✅ 0 错误（容器内实测） |
| 后端相关结构测试（Agent/风格/分集/守卫等 9 文件） | ✅ 40/40 |
| 前端回归测试（backend 容器内 `cd /workspace/frontend && npm test`） | ✅ 58/58（含新增 3 项） |
| 运行容器 watch 重载 | ✅ `/prompts` 可见 `style_enhancer` |
| `POST /style-presets/expand` 端到端 | ✅ 200，返回 name/description/prompt/value |
| 浏览器手工回归 | 建议：detail 页自定义风格点「AI 完善」→ 保存；输入创作要求 → AI 推荐集数；settings 风格对话框 AI 完善 |

### 回滚

- 前端：还原 `settings.vue`/`detail.vue`/`useApi.ts` 三处即可，其余改动互不依赖。
- 后端：还原 `dramas.ts`/`stylePresets.ts`/`agents/index.ts`；`utils/json.ts`、`utils/source-sample.ts` 可整文件删除（dramas.ts 同时改回内联实现）。
- **无数据库结构变更、无数据迁移、无任务状态机改动**，回滚零风险。

---
