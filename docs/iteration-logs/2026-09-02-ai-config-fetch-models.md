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

---

# 复核处理（2026-09-02，PR #7 CHANGES_REQUESTED）

## 评审意见 1：SSRF 出站请求防护 ✅

新增 `backend/src/utils/endpoint-guard.ts`，统一收口 `/ai-configs/test` 与 `/ai-configs/models` 的出站请求：

- **协议限制**：仅 `http/https`，`file://`、`ftp://` 等拒绝
- **地址校验**：DNS 解析后拒绝私网/回环/链路本地/CGNAT/组播等保留地址
  （IPv4：0/8、10/8、127/8、100.64/10、169.254/16、172.16/12、192.168/16、198.18/15、224+；
  IPv6：`::1`、`fc00::/7`、`fe80::/10`、组播）；IP 字面量直接判断不查 DNS
- **受控开关**：`ALLOW_PRIVATE_AI_ENDPOINTS=true` 显式放行本地/私网 AI 网关（默认拒绝），dev compose 已加注释说明
- **地址固定与逐跳重定向校验**：DNS 解析时检查全部地址；请求仅连接本次校验后的 IP，
  每一跳重新校验目标地址，避免 DNS rebinding；跨 origin 跳转丢弃 Authorization /
  x-goog-api-key 与请求体，防 Key 随跳转泄漏
- **IPv4-mapped IPv6 拒绝**：`::ffff:127.0.0.1`、`::ffff:7f00:1` 与 IPv4-compatible
  IPv6 会归一化为 IPv4 后复用私网规则，不能绕过回环/私网拦截
- **受限读取**：响应体上限 2MiB（`readBodyLimited`），防异常服务拖垮内存
- 被拒时前端/接口返回明确提示：`该地址被安全策略拒绝（不支持私网/本机地址）…`

## 评审意见 2：响应加固与回归测试 ✅

- 模型 ID **去重**（`new Set`）+ **数量上限**（`MAX_MODELS = 200`）
- 新增 `backend/tests/ai-config-models.test.mjs`，实际包含 5 条可执行回归：
  1. IPv4、IPv4-mapped IPv6 与 IPv4-compatible IPv6 的私网/回环拒绝 ✅
  2. 公网 IPv4 / IPv6 不误判 ✅
  3. DNS 多地址中任一私网地址时整体拒绝 ✅
  4. DNS 解析结果作为受校验、固定连接的目标地址 ✅
  5. 非 HTTP(S) 协议与空/非法 DNS 结果拒绝 ✅

## 产品交互补充 ✅

1. **复选框选择 + 「加入当前配置」**：拉取结果改为明确勾选语义（checkbox 样式 chips），
   勾选多个后点「加入当前配置」去重写入当前配置模型列表；未勾选不写入；手工输入保留
2. **「配置为生图模型」快捷入口**（当前配置为 text/video 时显示）：
   - 勾选模型后点击 → 校验 provider 是否在图片服务白名单（gemini / openai），
     不兼容则明确提示「该服务商不在图片服务白名单，无法配置为生图模型」
   - 兼容则**预填图片服务配置草稿**（Base URL / API Key / Provider / 勾选模型），
     由用户确认后保存；取消/关闭不落库，不静默新建或覆盖现有图片配置
   - 保存与测试沿用既有图片服务商白名单与连通性校验（后端 `isOfficialProvider` + `/test`）

## 验证

- `tsc --noEmit` 通过
- `backend/tests/ai-config-models.test.mjs` 5 条回归测试全部通过（容器内，文件级 suite pass）
- 接口实测（容器内 node 请求）：
  - `autodl` + video → `ok:true, source:"fixed"` 固定提示 ✅
  - `openai` + 无效 key → `API Key 无效或未填写`（401 短路）✅
  - `openai` + 不可达地址 → `无法从该 Base URL 拉取模型` 兜底 ✅
  - `autodl` + 非 video 服务类型 → 400 `Unsupported service_type/provider` ✅
  - `/models` + 私网 base_url（`http://127.0.0.1:9999`）→ `该地址被安全策略拒绝…ALLOW_PRIVATE_AI_ENDPOINTS=true` ✅
  - `/test` + 私网 base_url（`http://192.168.1.10`）→ 同样被拒 ✅
- 前端 dev HMR 无编译错误 ✅
