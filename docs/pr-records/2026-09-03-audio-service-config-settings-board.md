# PR 详细记录：设置页「音频服务」配置板块与 AutoDL IndexTTS2 预设

> 分支：`feat/audio-service-config`（提交 `1296f51`、`5f72b21`、`a61da01`）
> 基准：master（先基于 PR #20 `e2f6f42`，两轮评审后变基至 PR #22 `cf3a301`）
> 日期：2026-09-03（合入，merge commit `e3c0724`）
> 变更：8 文件（+77/−26）
> 关联方案：独立立项（配音/旁白功能前置配置层），不属 `ui-optimization-plan.md` token 线
> PR：#21

---

## 触发条件

视频 H3 工作流（AutoDL）上线后，用户侧需为后续「配音 / 旁白合成」等音频能力预留配置入口；后端因安全边界长期**不引入独立 TTS 厂商 adapter**（此前已移除 voice agent/tools/`aiVoices` 路由），仅允许 AutoDL 工作流。本 PR 把「音频」以**服务配置板块**形式接入设置页——与既有 text/image/video 同构，只做配置层的保存/测试/预设，不含生成链路。

## 改了什么

| 层面 | 改动 |
|---|---|
| 后端（ai.ts） | `ServiceType` 扩展 `'audio'`；`officialProviders` 新增 `audio: ['autodl']`（白名单仅 AutoDL，其余厂商不可选/不可保存） |
| 后端（aiConfigs.ts） | `/models` 探测的 AutoDL 提示由「固定 H3 工作流模型」改为「固定 ComfyUI 工作流模型」——IndexTTS2 等音频工作流同样是 ComfyUI 形态，措辞不再局限于视频 H3 |
| 后端（测试） | `remove-audio-tts-structure` / `official-provider-adapters` / `minimax-provider-surface` 三处收紧：`audio` 白名单断言从「无 audio」改为「仅 `'autodl'` 且不含 minimax」；仍断言无 TTS adapter / `aiVoices` / `getAudioConfig` |
| 前端（settings.vue） | 新增「音频」二级目录与板块（serviceMeta 音频描述、AutoDL IndexTTS2 preset 模板、模型固定提示）；服务商下拉按类型白名单收窄（audio 只显示 AutoDL）；音频配置的默认/优先级交互条件化（详见评审处理） |
| 前端（测试） | `official-provider-settings` / `remove-audio-voice-structure` 增补音频板块结构断言：板块存在、provider 白名单过滤、默认生效暗示的条件化边界 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **音频先只做「配置层」** | 后端长期不引入 TTS 厂商 adapter（安全/边界约束），配置先落地供后续 AutoDL IndexTTS2 工作流消费；生成链路与工作台入口属后续工作流立项，UI 文案必须与之匹配 |
| **`audio` 白名单仅 `autodl`** | 与后端 `officialProviders` 完全一致；前端选择器若暴露 gemini/openai/minimax 等，保存只会收到 `Unsupported service_type/provider` |
| **「默认生效」暗示一律按接入状态条件化** | 音频尚无 adapter/消费入口，所有「当前默认模型 / 工作台自动采用优先级最高的启用配置」类交互与文案对 audio 关闭或改「待接入后生效」，避免误导用户以为配置已生效 |

## 评审处理过程（两轮 CHANGES_REQUESTED）

| 轮次 | 意见 | 处理 |
|---|---|---|
| 1（P1） | 文案越界：总说明「启用后即可被工作台自动采用」、音频 desc「语音合成与音色克隆」与「仅配置层」范围冲突 | 总说明改为「已接入工作流的能力启用后即被自动采用，仅配置/测试阶段的接入中能力暂不生效」；audio desc 改为「当前仅保存与测试 AutoDL IndexTTS2 配置；语音生成与工作台接入将在后续工作流完成后开放」 |
| 1（P2） | 音频复用通用服务商下拉（含 gemini/openai/volcengine/minimax），改选保存必报错 | 新增 `providerWhitelistByType = { audio: ['autodl'] }`，`providerSelectOptions` 按类型过滤；补结构测试 |
| 2（P1） | 音频弹窗优先级提示与配置卡模型「设为默认」仍无条件展示；且要求补结构测试 | 弹窗优先级提示条件化（audio 显示「仅保存配置；优先级与自动采用待音频工作流接入后生效」）；配置卡模型 chip 对 audio 只读（`cfg-model-chip-ro`，无星标/默认语义/点击）；能力总览 audio 徽标改「待接入后生效」；补结构测试 |
| 2（基线） | 分支落后 master（当时 PR #22 已合入 `cf3a301`） | 变基到 `cf3a301` 无冲突重放，重跑前后端测试通过后合入 |

## 回归测试

- 前端结构测试：修正前 78/78 → 变基 master 后 **80/80 通过**（本机 node v22 实跑）。
- 后端相关测试 3 文件 **18/18 通过**（完整依赖环境补跑，覆盖两轮评审期间临时目录缺 `tsx` 未能运行的缺口）。
- `git diff --check` 通过、无 lint 错误。

## 对后续迭代的影响

- 设置页 AI 服务现为 text/image/video/audio 四类；后端白名单结构 `officialProviders[ServiceType]` 为新增能力类型的标准收口方式。
- **音频生成链路待办**：AutoDL IndexTTS2 的生成 adapter/路由与工作台配音入口在后续工作流完成后开放（后端仍无 TTS adapter；本轮明确不引入 minimax-tts 等）。
- 前端 `settings.vue` 仍为巨型单文件（约 58KB），音频板块复用同构结构，后续 P2-B2 拆分时一并纳入。

## 注意事项

- 后端在 PR 合入前后均**无独立 TTS 生成链路**——「音频」只是配置容器；任何声称「语音生成可用」的评审结论与实现边界不符。
- 设置页「能力总览 / 默认模型解析」对 audio 刻意不展示默认模型徽标；若后续音频 adapter 落地，需同步放开该条件化分支并补充对应交互。
- 归档机制沿用：本记录随后续 docs 小 PR 进入 master（合并点 `e3c0724`）。
