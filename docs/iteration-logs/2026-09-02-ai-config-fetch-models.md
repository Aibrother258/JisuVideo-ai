# HB-20260902-01：AI 服务配置「拉取模型」能力

> 日期：2026-09-02
> 分支：`feat/ai-config-fetch-models`
> 覆盖：`backend/src/routes/aiConfigs.ts`、`frontend/app/composables/useApi.ts`、`frontend/app/pages/settings.vue`

## 1. 需求与原始问题

设置 → AI 服务配置 API 时，模型字段只能手动逗号分隔输入，**没有「拉取该 API 下所有模型」的按钮**。
用户填 Base URL / API Key 后无法自动获取可用模型列表，需要手抄模型名，易错且不知道厂商新出的模型。

## 2. 本次范围与不做

- ✅ 新增后端 `POST /api/v1/ai-configs/models`：按 provider 探测候选模型列表端点并解析
- ✅ 前端配置对话框：模型输入框旁「拉取模型」按钮 + 可点击选择的模型 chips（多选拼入模型字段）
- ❌ 不做模型在线搜索/模糊过滤（chips 列表已足够，选中即拼入）
- ❌ 不做保存时的自动刷新（仅对话框内拉取）

## 3. 关键设计决策

1. **端点语义与 `/test` 探针对齐**：入参 `service_type / provider / base_url / api_key`，不落库、不改表。
2. **多候选探测 + 兜底**：按 provider 生成候选端点序列，依次尝试直到解析出非空列表：
   - `gemini`：官方 `GET {base}/v1beta/models?key=`（解析 `models[].name`，去 `models/` 前缀）→ 兜底 openai 兼容 `GET {base}/v1/models`（new-api 中转站）
   - `volcengine`：`GET {base}/api/v3/models` → 兜底 `/v1/models`
   - `minimax`：`GET {base}/v2/models` → 兜底 `/v1/models`
   - `openai` 系：`GET {base}/v1/models`（Bearer）
   - `autodl`：固定 H3 工作流模型，直接返回提示不拉取
3. **401/403 短路**：认证失败立即返回「API Key 无效或未填写」，不继续尝试其它端点（避免凭据试探）。
4. **统一解析**：兼容 `data[].id`（openai/ark/minimax）与 `models[].name`（gemini）两种列表格式，非 JSON 或无列表视为该候选失败，继续下一个候选。
5. **10s 超时**：`AbortSignal.timeout`，网络错误走「无法从该 Base URL 拉取模型」兜底。

## 4. 分层改动

**后端** `backend/src/routes/aiConfigs.ts`
- 新增 `buildModelProbes()`：候选端点序列构造
- 新增 `parseModelIds()`：openai/gemini 两种格式统一解析
- 新增 `POST /models` handler（注册在 `GET /` 之前，避免被 `/:id` 等路由吞掉；POST 方法无冲突）
- 日志沿用 `logTaskProgress / logTaskSuccess / logTaskError`（`AIConfig` 域，`models-fetch-*` 事件）

**前端** `frontend/app/composables/useApi.ts`
- `aiConfigAPI.models()` → `POST /ai-configs/models`

**前端** `frontend/app/pages/settings.vue`
- 模型字段改为「输入框 + 拉取模型按钮」组合，按钮带 loading 态
- 拉取成功后渲染模型 chips 列表（虚线框，可滚动），点击选中/取消，自动拼入逗号分隔的 `modelStr`
- 打开对话框 / 切换服务商预设时清空旧 chips

## 5. 用户操作路径

1. 设置 → AI 服务 → 文本/图片/视频 → 添加或编辑配置
2. 选择服务商、填入 Base URL 与 API Key
3. 点击「拉取模型」→ 下方出现模型 chips 列表
4. 点击需要的模型（可多选，再点一次取消）→ 自动写入「模型（逗号分隔）」字段
5. 保存 / 测试配置

## 6. 验证证据

容器内实测（dev 栈，`docker compose -f docker-compose.dev.yml`）：

- `autodl` + video → `{"ok":true,"models":[],"source":"fixed","message":"AutoDL 为固定 H3 工作流模型，无需拉取"}` ✅
- `openai` + 无效 key → `{"ok":false,"models":[],"message":"API Key 无效或未填写"}`（401 短路）✅
- `openai` + 不可达 base_url → `{"ok":false,"message":"无法从该 Base URL 拉取模型：fetch failed"}` ✅
- `autodl` + 非 video 服务类型 → 400 `Unsupported service_type/provider`（沿用官方白名单校验）✅
- `tsc --noEmit` 通过 ✅
- 前端 dev HMR 无编译错误 ✅

## 7. 已知限制与风险

- **真实成功拉取未验证**：本机没有有效厂商 Key，成功路径（如火宝中转、Gemini 官方）需用户填入有效 Key 后实测；解析逻辑对 openai/gemini 标准格式做了兼容，但个别中转站返回结构特殊时可能解析为空。
- `volcengine` 官方 `/api/v3/models` 返回的可能是推理接入点（`ep-xxx`）而非模型名，若该字段意义不大仍会如实返回；火宝中转 `/v1/models` 兜底正常。
- 无回滚风险：纯新增端点与 UI 控件，不影响既有配置保存/测试流程。

## 8. 后续建议

- 若用户反馈某中转站拉取为空，可按其实际返回格式扩展 `parseModelIds`。
- 可在编辑态下拉框中预填「最近使用模型」，进一步减少手输。
