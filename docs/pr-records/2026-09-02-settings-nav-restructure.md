# PR 详细记录：设置页导航两级重构（P0-F）——Agent 配置/Skills 常驻可见

> 分支：`feat/ui-settings-nav-restructure`
> 基准：`437026b Merge pull request #11 from csx12588/feat/style-ai-expansion`（origin/master）
> 日期：2026-09-02
> 变更：4 个文件（3 改/新 + 方案文档随入），不含 `data/`
> 关联方案：`docs/ui-optimization-plan.md`（v1.1）P0-F「设置页两级导航重构」
> PR：#13

---

## 触发条件

`docs/ui-optimization-plan.md` 第 8 章为 P0-F 定的启动条件是「等 style 相关提交（PR #11）合入 master 后再实施，冲突面最小」。PR #11 已合入（`437026b`），Agent 列表已由 `/prompts` 动态驱动、8 个 Agent 全量展示——折叠式「Agent 高级配置」开关的意义因此减弱，本 PR 按方案完成导航重构。

## 改了什么

| 层面 | 改动 |
|---|---|
| 数据 | `baseTabs`/`advancedTabs` + `showAdvanced` 合并为 `navGroups`（基础/高级两组，每组 2 个二级目录常驻） |
| 模板 | 侧栏 nav 区改为双层 `v-for="g in navGroups"` / `v-for="t in g.items"`；删除整块开关 UI、说明文案与 `v-if="showAdvanced"` |
| 逻辑 | 删除 `showAdvanced` 与「关闭开关时回退到 ai tab」的 `watch`（`watch` 仍保留给 Agent 列表回退逻辑） |
| 样式 | 清理 `.nav-advanced`/`.advanced-toggle`/`.advanced-note` |
| 默认态 | `tab` 仍默认 `'ai'`，各内容面板（AI 服务/风格预设/Agent 配置/Skills）零改动 |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **两级目录常驻，而不是「一级目录 + 开关展开」** | ① Agent 配置/Skills 是动态增长的完整管理区（8 个 Agent + 每 Agent 一组 Skills），不再是低频隐藏入口；② 开关的隐藏/回退逻辑在 tab 状态机里引入额外心智（关闭时回退 ai），常驻后 tab 集合恒定，无需复位规则；③ 为后续更多二级目录（如导入管理等）预留稳定骨架。 |
| **数据收敛为单一 `navGroups`，模板双循环** | 旧结构把「组标签/按钮列表」按基础/高级拆成两段写死模板；新结构下增删一个目录只需改一处数据，模板不感知分组。与方案「骨架可扩展」取向一致。 |
| **不引入路由/URL 深链（方案中的可选选项 6）** | 首期聚焦导航心智收敛；深链属增强项，等后续页面拆分（P2-B2）时一并评估，避免为临时 tab 状态增加路由耦合。 |
| **保留 `Agent 配置` 中文注释说明原开关已移除** | 防止后人误以为开关被误删而回填旧模式。 |

## 回归测试

- **新增** `frontend/tests/settings-nav-two-tier.test.mjs`：断言开关体系整体移除、`navGroups` 两组合计 4 目录、模板双层 `v-for`、默认 tab、无开关回退 watch。
- **更新** `frontend/tests/style-preset-structure.test.mjs`：原「关闭开关只重置高级 tab、不伤基础 tab」（`advancedTabs.some`）断言随开关移除失去意义，改为断言旧数组名与开关体系不再存在，风格预设 tab 始终可达。
- 全量 `frontend/tests`：63/63 通过；`nuxt build` 成功；lint 无新增诊断。

## 对后续迭代的影响

- master 自此含 `docs/ui-optimization-plan.md`（本 PR 随入），UI 优化路线图与 P0 专项在仓库内可追溯。
- 设置页导航稳定为「分组 + 目录」两级数据驱动结构；后续 P0 各专项（播放/细节收敛等）与 P2-B2 页面拆分均在方案文档中按序展开，不再依赖本页面的临时开关状态。
