---
name: minimax-h3-prompt-generator
description: 将单个分镜的中文视频提示词改写为可直接提交给 MiniMax H3 的 T2VA、I2VA 或 Ref2VA 英文多模态提示词。
---

# MiniMax H3 Prompt Writing

## 任务边界

只改写用户指定的一个分镜。`description`、`atmosphere`、`duration` 和已有 `video_prompt` 是事实来源；不得新增剧情、角色、台词、地点或不可见的心理活动。最终必须调用 `save_minimax_h3_prompt`，且只保存 `storyboard_id` 与 `minimax_h3_prompt`。

## 模式判定

用户消息会给出实际提交给视频工作流的参考素材顺序和建议模式，严格按该顺序使用标签：

- T2VA：没有参考图片、视频或音频。
- I2VA：唯一的参考图片明确作为 0.00 秒首帧。
- Ref2VA：角色、场景、道具或风格图片仅用于身份/外观参考，或存在多张参考图、参考音频、参考视频。

不得把普通角色设定图、场景设定图误写成首帧。`<Picture 1>` 对应前端提交的第一张图片，标签从 1 开始且不得跳号；`<Audio 1>`、`<Video 1>` 同理。

## 通用写作规则

- 说明字段和画面描写用英文；对白、旁白、歌词和画面可见文字保持原语言原文，不翻译、不改写。
- 严格匹配分镜总时长。第一镜头不写时间；后续切镜用 `[Shot N] At MM:SS.mmm, ...`，时间必须递增且小于总时长。
- 每个镜头写清构图、主体位置、环境、具体动作、表情、镜头运动、同步声音和参考素材生效位置。
- 运镜使用自然英文表达，例如 `pushes in with small amplitude at slow speed`、`pans right`、`holds a static shot`，不要把参数堆成标签。
- 只有实际说话、唱歌或发出画外音的人物才使用稳定编号 `(S1)`、`(S2)`；全程没有发声的人物绝对不能分配 `(Sx)`。对白格式为 `<d>[Chinese] 原文</d>`；旁白必须写 `says in an off-screen voiceover`，并明确画面内角色嘴唇保持闭合。
- 不得输出剧情摘要式提示词，不得遗留未定义的 `<Picture N>`、`<Subject N>`、`<Audio N>` 或 `<Video N>`。
- 无非叙事配乐时写 `non_diegetic_music: N/A`；不要擅自添加音乐。

## T2VA / I2VA 格式

I2VA 第一行固定为：

`For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.`

其后空一行。T2VA 不写该行。正文严格按以下顺序：

`integrated_multimodal_description: [Shot 1] ...`

`overall_soundscape: ...`

`non_diegetic_music: ...`

I2VA 必须从 `<Picture 1>` 已有构图、身份、服装、颜色、物体和空间关系起步，再描述连续发展。

## Ref2VA 格式

严格按以下六个字段顺序输出，字段名不得翻译：

1. `subject_definitions:`
2. `summary:`
3. `retention_analysis:`
4. `detailed_description:`
5. `overall_soundscape:`
6. `non_diegetic_music:`

### subject_definitions

- 角色、场景、道具等可复用可见内容定义为 `<Subject N>`，并注明来自哪个 `<Picture N>`。
- 仅当图片本身是具体首帧、关键帧、尾帧或构图锚点时，才单独定义 `<Picture N>`；普通设定图只作为 Subject 来源。
- 参考音频定义为 `<Audio N>`，说明是音频复用还是音色、节奏、声音质感参考。若对应说话人，沿用该说话人的 `(Sx)`。

### summary

用一个短英文段落，以实际任务类型开头，例如 `[reference generation]`、`[reference generation + audio reference]` 或 `[reference generation + audio reuse]`。

### retention_analysis

每个引用标签单独一行。可见内容只使用 `fully_preserved`、`partially_preserved`、`attribute_transfer`、`weak_reference`；音频只使用 `fully_copy`、`partially_copy`、`reference`、`weak_reference`。

### detailed_description

先用一至两句英文确定整体写实/电影风格与光线，再按 `[Shot 1]`、`[Shot 2] At ...` 顺序描述。参考主体第一次出现时要写明其外观、画面位置和动作，后续继续使用同一 `<Subject N>`。

### 声音字段

`overall_soundscape` 用 1 至 4 句英文概括环境声、动作声与非语言人声，不重复对白。`non_diegetic_music` 只写角色听不到的配乐，描述乐器、速度、节奏和动态；没有就写 `N/A`。

## 保存要求

最终提示词本身不要包在 Markdown 代码块内。调用 `save_minimax_h3_prompt` 时只传：

- `storyboard_id`
- `minimax_h3_prompt`

不要覆盖中文 `video_prompt`，不要修改分镜其他字段。
