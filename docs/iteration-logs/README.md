# Huobao Drama 迭代日志

这里记录本地开发版的重要功能迭代。日志以实际代码、数据库、接口和运行验证为准，不把尚未验证的能力写成已完成。

## 2026-08-31

| 编号 | 迭代 | 状态 | 详细日志 |
|---|---|---|---|
| HB-20260831-01 | 视频生成参考素材：本地上传与资产库复用 | 已完成并在本地开发栈验证 | [查看日志](./2026-08-31-reference-media-library.md) |
| HB-20260831-02 | MiniMax H3 提示词 Skill、Agent 与生成按钮 | 已完成并用分镜 01 真实验证 | [查看日志](./2026-08-31-minimax-h3-prompt-workflow.md) |
| HB-20260831-03 | 工作台面板可拖动布局与尺寸记忆 | 已完成代码实现、构建与新增测试验证；历史测试仍有路径债务 | [查看日志](./2026-08-31-resizable-workbench.md) |
| HB-20260831-04 | 参考素材持久化、视频区职责分层与 H3 新鲜度 | 已完成代码实现与开发栈验证 | [查看日志](./2026-08-31-reference-state-and-h3-freshness.md) |
| HB-20260831-05 | H3 新鲜度修复、参考素材事务化与测试基线收紧 | 代码实现与静态审查完成；本机无 Node，typecheck/测试/构建待补跑 | [查看日志](./2026-08-31-h3-freshness-and-reference-state-sync.md) |

## 2026-09-01

| 编号 | 迭代 | 状态 | 详细日志 |
|---|---|---|---|
| HB-20260901-01 | 多来源全文导入、项目风格与 AI 分集复核 | 代码、构建、定向测试和浏览器复核完成；真实 AI 业务验收待用户执行 | [查看日志](./2026-09-01-content-import-and-episode-planning.md) |
| HB-20260901-02 | 全文导入与分集审阅二次全面复盘 | 完成功能与安全双审查；确认 5 项 P1、8 项 P2，当前为有条件不建议正式上线 | [查看复盘](./2026-09-01-content-import-second-review.md) |
| HB-20260901-03 | 全文导入与分集工作流生产加固 | 5 项 P1、8 项 P2 全部关闭；数据库迁移、全量测试、构建与本地接口联调通过 | [查看日志](./2026-09-01-content-import-hardening.md) |

## 2026-09-02

| 编号 | 迭代 | 状态 | 详细日志 |
|---|---|---|---|
| HB-20260902-01 | AI 服务配置「拉取模型」：按 provider 探测模型列表、SSRF 防护与快捷预填 | 代码、类型检查、新增回归测试与容器内接口验证完成；真实厂商 Key 成功拉取待用户实测 | [查看日志](./2026-09-02-ai-config-fetch-models.md) |
| HB-20260902-02 | UI 工作线状态排查（线 A 方案稿 vs 线 B UI 治理混淆） | 已归档排查记录与术语索引；P1 token 收敛在 `feat/ui-p1-token-spec` 推进中 | [查看记录](./2026-09-02-ui-communication-audit.md) |
| HB-20260902-03 | UI P1 Token 收敛 A1 首批 + episode 资产子资源三态补漏（R1） | 完成（PR #15，merge `12121d9`）；结构测试 72/72 通过 | [查看归档](../pr-records/2026-09-02-ui-p1-token-spec-r1-assets.md) |
| HB-20260902-04 | 首页双栏工作台 + 设置页「目录—详情」三层布局改造 | 完成（PR #16，merge `e9ca6ce`）；经两轮评审，测试 74/74 通过 | [查看归档](../pr-records/2026-09-02-ui-home-workspace-settings-three-tier.md) |
| HB-20260902-05 | UI P1 Token 收敛 A1 第二批——通用填充/警示色收敛为语义 token | 完成（PR #18，merge `b14e950`）；结构测试全量通过 | [查看归档](../pr-records/2026-09-02-ui-token-a1-batch2.md) |

## 2026-09-03

| 编号 | 迭代 | 状态 | 详细日志 |
|---|---|---|---|
| HB-20260903-01 | UI P1 Token 收敛 A1 第三批——封面占位/反色白字/毛玻璃浮层语义 token | 完成（PR #19，merge `d58e570`）；结构测试 76/76 通过 | [查看归档](../pr-records/2026-09-03-ui-token-a1-batch3.md) |
| HB-20260903-02 | UI P1 Token 收敛 A1 第四批——白字白底语义化与徽标投影 token | 完成（PR #20，merge `e2f6f42`）；结构测试 77/77 通过 | [查看归档](../pr-records/2026-09-03-ui-token-a1-batch4.md) |
| HB-20260903-03 | UI P1 Token 收敛 A1 第五批——episode 播放器深色与状态色 token | 完成（PR #22，merge `cf3a301`）；结构测试 78/78 通过 | [查看归档](../pr-records/2026-09-03-ui-token-a1-batch5.md) |
| HB-20260903-04 | 设置页「音频服务」配置板块与 AutoDL IndexTTS2 预设（配音/旁白前置配置层） | 完成（PR #21，merge `e3c0724`）；经两轮评审边界收敛，前端结构测试 80/80、后端相关 18/18 通过 | [查看归档](../pr-records/2026-09-03-audio-service-config-settings-board.md) |
| HB-20260903-05 | UI A2 语义色板规范批次一——资产类别/状态语义色与 amber 提示横幅 token 化 | 完成（PR #25，merge `1c090e1`）；结构测试 81/81 通过 | [查看归档](../pr-records/2026-09-03-ui-semantic-a2-batch1.md) |
| HB-20260903-06 | UI A2 语义色板规范批次二——episode 媒体遮罩/白字、R5/R6 全仓清理、new-style 家族 | 完成（PR #26，merge `5b9ae75`）；经两轮 R5 补漏评审，结构测试 82/82 通过 | [查看归档](../pr-records/2026-09-03-ui-semantic-a2-batch2.md) |
| HB-20260903-07 | UI A3 动效体系化——时长档 token、缓动统一、keyframes 收敛与进入动画规范 | 完成（PR #28，merge `72edeac`）；经一轮 dur-slow 偏差评审修正，结构测试 83/83 通过 | [查看归档](../pr-records/2026-09-03-ui-motion-a3.md) |
| HB-20260903-08 | UI P2-B1 批次一——AppDialog 通用弹窗组件 + settings 四个配置弹窗迁移 | 完成（PR #30，merge `c9be4df`）；结构测试 84/84 通过 | [查看归档](../pr-records/2026-09-03-ui-b1-dialog-batch1.md) |
| HB-20260903-09 | UI P2-B1 批次二——detail/episode 标准弹窗迁移至 AppDialog + dialogStyle | 完成（PR #31，merge `04b128a`）；结构测试 85/85 通过 | [查看归档](../pr-records/2026-09-03-ui-b1-dialog-batch2.md) |
| HB-20260903-10 | UI P2-B1 批次三——AppDrawer 右侧抽屉组件 + episode 任务抽屉迁移（Esc 交还页面优先级） | 完成（PR #32，merge `e23ec12`）；结构测试 86/86 通过 | [查看归档](../pr-records/2026-09-03-ui-b1-dialog-batch3.md) |
| HB-20260903-11 | UI P2-B1 批次四——StatusBadge 状态徽标组件 + detail/episode 封面角标/胶囊迁移 | 完成（PR #34，merge `d61683f`）；结构测试 87/87 通过 | [查看归档](../pr-records/2026-09-03-ui-b1-badge-batch4.md) |
| HB-20260903-12 | UI P2-B1 批次五——EmptyState 通用空态组件 + index/detail 卡片空态迁移 | 完成（PR #36，merge `c4cf9eb`）；结构测试 88/88 通过 | [查看归档](../pr-records/2026-09-03-ui-b1-empty-batch5.md) |
| HB-20260903-13 | UI P2-B1 批次六——LoadingButton 通用加载按钮组件 + settings Loader2 图标族按钮迁移 | 完成（PR #38，merge `bec885a`）；经一轮复核修正（Loader2 组件内自包含 import），结构测试 89/89 通过 | [查看归档](../pr-records/2026-09-03-ui-b1-loading-batch6.md) |
| HB-20260903-14 | UI P2-B1 批次七——episode Loader2 图标族 23 处按钮迁移至 LoadingButton（loading/disabled 语义拆分） | 完成（PR #40，merge `2b8b6c4`）；一轮复核通过，结构测试 90/90 通过 | [查看归档](../pr-records/2026-09-03-ui-b1-loading-batch7.md) |
| HB-20260903-15 | UI P2-B1 批次八——Field 表单字段组件抽取 + settings/index `.field` 骨架迁移 | 完成（PR #42，merge `43ee3e2`）；一轮复核通过，结构测试 91/91 通过 | [查看归档](../pr-records/2026-09-03-ui-b1-field-batch8.md) |
| HB-20260903-16 | UI P2-B3 分页 hook——`usePagedList` + `dramaAPI.list` 分页参数扩展 | 完成（PR #43，merge `f93b287`）；经三轮评审（参数覆盖顺序/过期响应代次/Node 20 测试基线 tsx 化），测试 100/100 通过 | [查看归档](../pr-records/2026-09-03-ui-b3-paged-hook.md) |

## 2026-09-04

| 编号 | 迭代 | 状态 | 详细日志 |
|---|---|---|---|
| HB-20260904-01 | UI P2-B2 试点——episode 拼接导出面板下沉 `EpisodeExportPanel` + `useExportMergesList` 并发令牌 | 完成（PR #45，merge `b11be06`）；共 7 文件 5 提交，经 4 次正式 review（3 Request changes + 1 Approved）；episode.vue 非空行 7069→6802（物理 7422→7150），EpisodeExportPanel 354 非空行/365 物理行；测试 116/116 通过 | [查看归档](../pr-records/2026-09-03-ui-b2-episode-export-panel.md) |
| HB-20260904-02 | UI P2-B2 script 面板下沉——episode 剧本面板拆 `EpisodeScriptPanel` + 状态矩阵纯函数化 | 完成（PR #47，merge `58c1e96`）；共 3 提交，经 2 次正式 review（1 Request changes + 1 Approved）；episode.vue 非空行 6802→6763（物理 7150→7108，净 −39/−42）；测试 124/124、build/generate 通过 | [查看归档](../pr-records/2026-09-04-ui-b2-episode-script-panel.md) |
| HB-20260904-03 | UI C3/P4 首轮落地——素材库/任务列表分页化（后端 `GET /assets` 与 `GET /tasks` SQL 下推分页 + episode 参考素材选择器接入 `usePagedList`） | 完成（PR #48，merge `0ca0e0e0`）；共 3 轮评审（结构断言宽松化 / 契约兼容 / 视频历史截断修复），最终分镜历史回归无参全量契约；frontend 130/130、backend 结构子集 42/42、build 通过 | [查看归档](../pr-records/2026-09-04-ui-c3-pagination-assets-tasks.md) |
| HB-20260904-04 | UI C4 暗色主题首批（B1）——dark token 覆盖块 + `data-theme` 切换 + 首帧 FOUC + B1 字面量 token 化 | 完成（PR #53，merge `7c99e15`）；经三轮评审收口（静态 head bootstrap / 真构建产物集成测试 + CI 强制 / 子进程兜底清理）；frontend 142/142、test:build 通过 | [查看归档](../pr-records/2026-09-04-ui-c4-dark-theme-b1.md) |
| HB-20260904-05 | UI C4 暗色主题第二批（B2）——局部语义色/投影残留收口 + `solid-ink` 反色实心块 | 完成（PR #54，merge `f959214`）；经三轮 Request Changes 守卫逐级收紧（逐选择器断言 / bg shorthand 只许 solid-ink / 全部同名规则 + 空白规范化），145/145、test:build 通过 | [查看归档](../pr-records/2026-09-04-ui-c4-b2-solid-ink-token.md) |
| HB-20260904-06 | UI C4 暗色主题第三批——设置页「外观」三态切换面板 + 持久化（C4 完结批） | 完成（PR #56，merge `c58323e`）；评审 P2 跟进：说明文字改 `--text-2`（dark AA）+ 双主题守卫锚定；面板抽 `ThemeAppearanceCard` + vitest 挂载级交互套件（真实 useTheme/controller，`npm run test:ui` 4/4，CI/verify 强制）；frontend 148/148、test:build 通过 | [查看归档](../pr-records/2026-09-04-ui-c4-batch3-appearance-switcher.md) |
| HB-20260904-07 | 产品定位收敛与 PR #58 改造为「战略定位与范围裁决 PR」（2026-09-04 定位裁决）——产品定位收敛为「AI 短剧生产工作台」、登记阶段路线图/暂停清单/北极星指标、UI 治理转维护、「原文整理与智能分集」定为下一专项（v0.4 另开 PR）、净化稿 v0.3 移出 PR、shuohao 报告降级参考资料 | 随 PR #58 待合入（纯文档：定位文档新增 + 相关文档口径同步）；README 定位口径已同步 | [定位文档](../product-positioning-roadmap.md) |

## 记录规范

每篇日志至少包含：

1. 需求与原始问题。
2. 本次范围和明确不做的内容。
3. 关键设计决策与原因。
4. 前端、后端、数据库、Agent/Skill 等分层改动。
5. 用户实际操作路径。
6. 验证证据和未通过项。
7. 已知限制、风险与回滚方式。
8. 后续迭代建议。

除非日志明确写明“真实生成已验证”，否则模型调用和付费生成能力只视为结构接通。
