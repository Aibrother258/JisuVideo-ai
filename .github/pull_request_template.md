## 改动类型

<!-- 勾选适用项，可多选 -->

- [ ] `feat` 新功能
- [ ] `fix` 修复缺陷
- [ ] `perf` 性能优化
- [ ] `refactor` 重构（不改变外部行为）
- [ ] `docs` 文档
- [ ] `test` 测试

## 改了什么

<!-- 一句话说清改动内容 -->

## 为什么要改

<!-- 对应的需求、缺陷现象或 Issue 链接 -->

关联 Issue：#

## 怎么自测的

<!-- 写清楚验证步骤，方便 reviewer 复现；UI 改动请附截图或录屏 -->

1.
2.
3.

## 影响范围

<!-- 哪些页面/接口/数据会受影响？有没有破坏性变更？ -->

## 自检清单

提交前请确认：

- [ ] `cd backend && npm run typecheck` 通过
- [ ] `cd frontend && npm run build` 通过
- [ ] 改动涉及的逻辑已跑测试（`npm test`）或补充了测试
- [ ] 没有提交 `data/`、`dist/`、`.output/`、`node_modules/` 等生成物
- [ ] 没有提交 API Key、密码等敏感信息（AI 配置请在界面「设置 → AI 服务」中填写）
- [ ] 涉及用法变化时，已同步更新 `README.md` 或 `docs/` 下相关文档
- [ ] 已勾选 `Allow edits by maintainers`
