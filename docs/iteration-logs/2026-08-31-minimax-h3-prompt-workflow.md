# HB-20260831-02：MiniMax H3 提示词 Skill、Agent 与生成按钮

## 1. 迭代概况

- 日期：2026-08-31
- 状态：已完成，并使用分镜 01 真实生成 H3 提示词
- 前置条件：分镜已有中文版 `video_prompt`
- 目标工作流：AutoDL `minimax_h3_image_audio_to_video_v2_15s`
- 影响模块：分镜工作台、Agent 注册、Skill 加载、分镜数据库、视频任务参数

本次迭代把“给普通人阅读和编辑的中文版视频提示词”与“直接提交给 MiniMax H3 的结构化大模型提示词”分开。用户可以先确认中文镜头内容，再点击独立按钮按 H3 Skill 改写，不再手工拼接 `integrated_multimodal_description`、`subject_definitions`、`<Picture N>` 等结构。

## 2. 原始问题

分镜已经有按 3 秒分段的中文视频提示词，但 MiniMax H3 在不同输入模式下需要不同结构：

- 无参考素材：T2VA。
- 唯一首帧：I2VA。
- 角色、场景、道具、多张图片或音频参考：Ref2VA。

如果继续直接把中文版提示词提交给 H3，模型虽然可能生成视频，但无法稳定利用 H3 的镜头、说话人、声音场和参考标签能力；如果人工改写，又容易出现 `<Picture N>` 与实际素材槽位不一致、模式选择错误、时间点超出分镜时长等问题。

## 3. 本次目标

1. 新增“MiniMax H3 提示词”按钮。
2. 从现有 H3 Prompt Writing Skill 提取并接入项目规范。
3. 让系统根据当前分镜实际参考素材自动判定模式。
4. H3 提示词单独保存，绝不覆盖中文版 `video_prompt`。
5. AutoDL 或 MiniMax 生成视频时，有 H3 提示词就优先使用；没有时兼容旧中文版流程。
6. Agent 只能写 H3 字段，不能修改分镜其他内容。

## 4. Skill 来源与项目化处理

参考源：

```text
C:\Users\csx-i\Desktop\DuanJu\_archive\legacy-20260830\skills\h3-prompt-writing
```

源 Skill 包含基础模式指南与 Ref2VA 完整参考指南。本次没有在运行时依赖外部归档路径，而是把与 Huobao 当前工作流直接相关的规则整理成自包含 Skill：

```text
backend/workspace/skills/minimax-h3-prompt-generator/SKILL.md
```

项目化后的 Skill 保留以下关键规则：

- T2VA、I2VA、Ref2VA 模式边界。
- 英文结构字段与固定顺序。
- `[Shot N] At MM:SS.mmm` 切镜时间格式。
- `<Picture N>`、`<Subject N>`、`<Video N>`、`<Audio N>` 引用规则。
- 对白、歌词、旁白和画面文字保持原语言。
- 有声角色使用稳定 `(Sx)`；不发声角色禁止分配说话人编号。
- `overall_soundscape` 与 `non_diegetic_music` 分离。
- 只保存 `minimax_h3_prompt`，不覆盖中文版提示词。

Skill 元数据名称按 Mastra 要求与目录名保持一致：`minimax-h3-prompt-generator`。启动时通过 Skills API 验证已被工作区发现。

## 5. 自动模式判定

前端按“实际会提交给视频工作流的素材数组”判定，而不是只看数据库中有没有角色或场景：

```text
没有图片、视频、音频                    -> T2VA
只有一张图片，且它明确等于 first_frame -> I2VA
其他任何带参考素材的情况                -> Ref2VA
```

这样可以避免把普通角色设定图或场景设定图误当成 0.00 秒首帧。

参考标签严格按任务数组顺序生成：

- 第一张实际图片对应 `<Picture 1>`。
- 第二张实际图片对应 `<Picture 2>`。
- 第一段参考音频对应 `<Audio 1>`。
- 第一段参考视频对应 `<Video 1>`。

图片角色说明尽可能从当前分镜绑定资产恢复：场景图标记为场景设定图，角色图标记为角色设定图，道具图标记为道具设定图；无法识别来源的图片标记为用户从本地或资产库选择的补充参考图。

## 6. 数据库改动

`storyboards` 表新增独立字段：

```sql
minimax_h3_prompt TEXT
```

Drizzle 映射名称：

```text
minimaxH3Prompt <-> minimax_h3_prompt
```

新建数据库会直接从建表语句获得该字段。已有数据库启动时查询 `information_schema.COLUMNS`；只有在字段不存在时才执行：

```sql
ALTER TABLE storyboards
ADD COLUMN minimax_h3_prompt TEXT AFTER video_prompt;
```

因此迁移是幂等的，重复启动不会反复执行 ALTER，也不会覆盖已有提示词。

分镜更新接口允许单独编辑 `minimax_h3_prompt`，前端失焦保存只提交该字段。

## 7. 独立 Agent 与最小权限工具

新增 Agent 类型：

```text
minimax_h3_prompt_generator
```

Agent 工作流：

1. 调用 `read_storyboard_context`。
2. 找到用户指定分镜。
3. 以现有中文 `video_prompt` 为优先事实源。
4. 参考 `description`、`atmosphere` 和 `duration` 补足结构。
5. 按前端传来的模式与素材编号生成 H3 提示词。
6. 调用 `save_minimax_h3_prompt` 保存。

专用保存工具的输入只有：

```text
storyboard_id
minimax_h3_prompt
```

工具还会验证目标分镜是否属于当前剧集。Agent 没有通用 `update_storyboard` 权限，因此即使模型试图回传标题、描述、场景、角色或中文版提示词，也没有工具能够写入这些字段。

Skill 映射在 `backend/src/agents/skills.ts` 注册，设置页同时新增“MiniMax H3 提示词”Agent，可查看和维护其提示词与 Skill。

## 8. 前端交互

工作台两个位置都提供 H3 能力：

- 分镜编辑详情中的“MiniMax H3 大模型提示词”。
- 视频生成右侧检查器中的“MiniMax H3 大模型提示词”。

按钮文字统一为“MiniMax H3 提示词”。点击前要求当前分镜已有中文版 `video_prompt`；如果没有，提示用户先生成或填写中文版。

生成成功后，H3 文本显示在独立多行编辑框中，允许人工复核和修改。编辑框保存到 `minimax_h3_prompt`，不会触碰中文字段。

当剧集锁定的视频配置是 `autodl` 或 `minimax`，并且 H3 字段非空时，视频任务参数使用 H3 提示词；否则仍使用旧的中文版提示词和 `@名字` 映射逻辑。

厂商判断优先读取剧集锁定的视频配置，而不是只看前端模型下拉框，保证“界面显示的使用规则”和“后端实际使用的配置”一致。

## 9. 真实验证：分镜 01

验证对象：

- 短剧 ID：2
- 剧集 ID：1
- 分镜 ID：1
- 分镜序号：01
- 标题：工位迟滞
- 时长：10 秒
- 已有中文版提示词：是
- 本次参考图片：0
- 本次参考视频：0
- 本次参考音频：0
- 自动判定模式：T2VA

### 9.1 文本服务调用

第一次使用默认文本配置调用时，服务返回“余额不足，请充值后重试”。该错误来自文本模型服务，与已经保存并可生成视频的 AutoDL Token 无关。

随后显式使用已有“商汤日月-文本”配置 `sensenova-6.8-flash-lite` 完成验证。Agent 实际执行了：

1. 加载 `minimax-h3-prompt-generator` Skill。
2. 调用 `read_storyboard_context`。
3. 生成 T2VA 英文提示词。
4. 保存到分镜 01 的 `minimax_h3_prompt`。

### 9.2 生成结果校验

- H3 提示词长度：2,996 字符。
- 首字段：`integrated_multimodal_description:`。
- 包含：`overall_soundscape:`。
- 包含：`non_diegetic_music:`。
- 切镜点：00:03.000、00:06.000、00:09.000，均小于 10 秒。
- 原分镜没有对白，最终提示词没有遗留无效 `(S1)`、`(S2)` 说话人编号。
- 中文 `video_prompt` 仍然存在且以 `0-3秒：` 开头。
- 已生成视频仍然存在：`static/videos/ee1d7b83-5553-4299-a2b3-6941eee61628.mp4`。

本次只生成文本提示词，没有再次向 AutoDL 提交视频任务，因此没有产生第二次视频生成费用。

## 10. 验证中发现的问题与修正

### 10.1 Skill 目录名与元数据不一致

第一次加载时，Mastra 报告 Skill 名称必须与目录名一致。将 frontmatter 中的名称修正为 `minimax-h3-prompt-generator` 后，`GET /api/v1/skills` 正确返回 Skill 元数据。

### 10.2 模型试图回传多余分镜字段

首次真实生成时，文本模型先尝试使用通用更新工具，并回传标题、镜头类型、场景、角色、中文版提示词等大量字段。部分字段类型不符合校验，调用被拒绝，没有写入数据库；模型随后只提交 H3 字段并成功保存。

为了避免以后依赖模型自觉，随后进行了权限收紧：H3 Agent 不再获得通用更新工具，只获得 `save_minimax_h3_prompt`。这把“不覆盖其他字段”从提示词约束升级为工具层硬约束。

### 10.3 无对白人物被错误分配说话人编号

首次生成文本给不发声的林远和小唐标记了 `(S1)`、`(S2)`。根据 H3 规则，不发声人物不应分配说话人 ID。处理方式：

- 修正分镜 01 已保存的 H3 提示词，删除无效编号。
- 在 Skill 中增加明确规则：只有实际说话、唱歌或发出画外音的主体才分配 `(Sx)`。

## 11. 构建与运行验证

- 前端 `npm run build`：通过。
- 后端健康检查：通过。
- H3 Agent 调试接口：返回有效 Agent。
- Skills API：能够发现 `minimax-h3-prompt-generator`。
- 数据库迁移：字段存在，分镜 API 能正常读取和写入。
- 工作台页面：HTTP 200。
- `git diff --check`：无空白错误，只有 Windows 行尾提醒。

后端 `npm run typecheck` 仍有 4 处原有 `storyboard-tools.ts` 类型错误，位置会因本次新增代码发生行号偏移，但错误内容与新增 H3 字段和专用保存工具无关。本次新增代码没有带来额外类型错误。

## 12. 兼容性与行为说明

1. 已有分镜的 `minimax_h3_prompt` 默认为空，旧流程继续使用中文版提示词。
2. 用户可逐分镜生成 H3 提示词，不强制一次性重做整集。
3. 修改中文版提示词后，H3 提示词不会自动刷新，需要用户重新点击按钮，以避免未经确认覆盖。
4. 参考素材变化后，应重新生成 H3 提示词，确保 `<Picture N>`、`<Audio N>` 与实际槽位一致。
5. 当前 AutoDL 工作流不接受参考视频；即使 H3 Skill 支持 `<Video N>`，该工作流提交前仍会阻止参考视频。
6. H3 生成消耗的是文本模型服务额度，AutoDL Token 只负责视频生成，两者余额和错误相互独立。

## 13. 回滚建议

如只回滚界面入口：

- 移除 H3 按钮和独立编辑框。
- 将视频任务 `prompt` 恢复为始终使用中文版映射结果。

如回滚 Agent：

- 移除 `minimax_h3_prompt_generator` 注册和 Skill 映射。
- 保留 `minimax_h3_prompt` 数据库列，避免丢失已生成提示词。

不建议直接删除数据库列；该列是可选字段，保留不会影响旧版本运行。

## 14. 后续建议

- 增加“H3 提示词已过期”检测：中文版提示词或参考素材变化后提示重新生成。
- 增加批量 H3 提示词生成，同时保留逐分镜确认和失败重试。
- 在提交视频前显示本次使用的是中文版还是 H3 版提示词。
- 增加 H3 结构校验器，自动检查字段顺序、时长、切镜点、引用标签和说话人编号。
- 将参考素材选择关系持久化到数据库后，让 H3 模式判定完全由服务端可重放。
- 为 T2VA、I2VA、Ref2VA 各增加至少一条自动化回归样例。
