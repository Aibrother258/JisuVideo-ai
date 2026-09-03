# PR 详细记录：B3——usePagedList 分页 hook + dramaAPI.list 分页参数扩展

> 分支：`feat/ui-b3-paged-hook`
> 基准：master（PR #43 创建于 B1 batch8 合并前的 master；最终合并无冲突）
> 日期：2026-09-03（合入）
> 变更：6 文件（+913/−4，merge `f93b287`；含 0552725 初始实现、e16db38 评审修复、2d677de 测试设施修复）
> 关联方案：`docs/ui-optimization-plan.md`（v2.5）P2-B3「列表分页能力封装」
> PR：#43（merge commit `f93b287`）

---

## 触发条件

plan 现状基线：项目/剧集/素材/任务列表全量一次拉取（`useApi.ts`、各页面），无分页/虚拟滚动；B3（分页 hook）与 C3（分页/虚拟滚动落地）属 P2 评估、P4 实施。本轮完成 **B3：`usePagedList` hook 封装 + `dramaAPI.list` 分页参数扩展**，供后续分页/虚拟滚动统一接入（不在此 PR 接入任何页面）。

## 改了什么

| 层面 | 改动 |
|---|---|
| 新增 `composables/usePagedList.ts` | 对齐后端 `GET /dramas?page=1&page_size=20 → { items, pagination: { page, page_size, total, total_pages } }`。状态：`items`/`loading`/`loadingMore`/`loadError`/`page`/`total`/`totalPages`/`hasMore`（computed：`ready && totalPages > page`）；动作：`reload()` 拉第 1 页整载（替换 items、loading 置真，可打断在途 loadMore）、`loadMore()` 追加下一页（loadingMore 置真，`hasMore` 假或在途时忽略）、`reset()` 清空回未加载态；选项：`pageSize`（默认 20）、`fixed`（每次请求固定携带的筛选参数） |
| `composables/useApi.ts` | `dramaAPI.list` 扩展 `page`/`page_size`/`keyword`/`status` 参数（URLSearchParams 拼 `/dramas?…`，无参时不带 `?`），返回类型含 `pagination` |
| 测试 | 新增结构测试 `paged-list-hook-structure.test.mjs`（组件/API 签名、契约断言）+ 行为测试 `paged-list-hook-behavior.test.mjs`（5 项：顺序 reload→loadMore 追加、loadMore 期间 reload 作废追加、reset 作废在途成功/失败响应、fixed 不覆盖 page/page_size、无 pagination 视为一次取全） |

## 评审处理（三轮：2×CHANGES_REQUESTED → APPROVED）

| 轮次 | 反馈 | 处理 |
|---|---|---|
| 1（10:55Z） | ① `buildQuery()` 返回 `{ page, page_size, ...fixed }`：调用方在 `fixed` 传 `page`/`page_size` 会覆盖 hook 计算的页码/页大小，与「由 hook 计算」契约相反；② `reload()` 只拦 `loading` 不拦在途 `loadMore`、`reset()` 不作废已发请求：第 2 页在途时 reload，旧第 2 页返回会追加污染新列表并覆盖 page/meta；要求改覆盖顺序 + 补断言，用请求代次/序号忽略过期响应（`reset` 必须递增代次），或完整串行化；增加延迟响应行为测试 | 提交 `e16db38`：`buildQuery` 改 `{ ...fixed, page: p, page_size: pageSize }`（fixed 先展开、分页参数后写覆盖）并补断言；引入递增 `requestSeq`——每次请求前 `++requestSeq`，响应返回后 `seq !== requestSeq` 则丢弃（成功/失败都不写 items/meta/page/error、不碰 flag）；`reset()` 递增 `requestSeq` 使全部在途请求过期；`reload()` 先复位 `loadingMore`（接管在途 loadMore 的 flag，其过期响应被丢弃）；新增 5 项延迟响应行为测试 |
| 2（11:12Z） | ① 默认 `npm test` 改成了 Node 22.6 才支持的 `--experimental-strip-types`，而项目 Docker 前端构建为 `node:20-slim`（三个 stage 均 Node 20）——静默抬高 Node 基线；要求恢复 Node 20 可运行默认测试，或把运行时升级拆成独立完整变更；② 行为测试把任何 `import('../app/composables/usePagedList.ts')` 失败都转 skip：源码语法错/vue 依赖解析失败也会跳过且 0 退出；实测 `npm test` 为 `pass 95 / skipped 5`，非所述 100/100；要求默认环境下导入失败直接失败，仅明确非默认旧命令可 skip，验收输出 5 项行为测试无 skipped | 提交 `2d677de`：改为复用 backend 既有 tsx 加载模式——frontend 增 devDependency `tsx@^4.21.0`（支持 Node ≥18），`test` 脚本改 `node --import tsx/esm --test`（无 glob 参数，Windows cmd 与 Node 20 均兼容）；未动 Docker/engines/CI；行为测试加载失败按「是否显式启用 TS 加载器」区分——默认/显式加载器（tsx 或 strip-types）下失败打印 `FATAL` + `process.exitCode = 1`（真实失败），仅老命令直接 `node --test`（无加载器）失败才 skip 并提示改用 npm test |
| 3（11:35Z） | 复审通过：`fixed` 不能再覆盖 hook 计算的 `page/page_size`；请求代次丢弃 reload/reset 前成功和失败响应；测试运行器改为项目 Node 20 可用且后端已采用的 tsx/esm 模式；默认加载器下模块导入失败非零退出不再静默跳过；锁文件含兼容 Node ≥18 的 tsx；差异检查无格式错误 | 批准合并（merge `f93b287` @11:38Z） |

## 关键设计决策

| 决策 | 背后逻辑 |
|---|---|
| **`{ ...fixed, page, page_size }`：fixed 先展开、分页参数后写覆盖** | hook 的契约是「页码/页大小由 hook 计算」，调用方 fixed 传同名键属意外传入；后写覆盖保证固定筛选永远无法篡改分页参数（评审第一轮核心修正） |
| **递增请求代次（requestSeq）统一作废过期响应** | 相比「完整串行化」，代次让 reload/reset/后续请求都能使更早在途请求过期；过期响应无论成功/失败一律丢弃，不写 items/meta/page/error、也不复位 flag（flag 由接管方 reset）——根治「第 2 页在途时 reload，旧响应返回后追加污染新列表」竞态 |
| **`reset()` 必须递增代次** | reset 清空回未加载态但不发请求；若不递增代次，reset 前发出的在途请求仍算「最新」，返回后会写入已重置列表 |
| **`reload()` 接管在途 loadMore** | reload 前把 `loadingMore` 复位：在途 loadMore 的响应已因代次过期被丢弃，其 `finally` 不会复位 flag，须由接管方显式复位，否则 loadingMore 卡真 |
| **测试走 tsx/esm（backend 同款）而非 strip-types** | 不抬高 Node 基线：项目 Docker 三个 stage 均为 `node:20-slim`；backend 早已用 `node --import tsx/esm --test` + tsx devDep 跑 TS 测试，frontend 照抄即保持 Node 20 可运行，是「兼容既有基线的平台事实」而非新引入依赖 |
| **导入失败按加载器区分 skip/fail** | 行为测试的价值在真实运行时行为；静默 skip 会掩盖源码错误与依赖解析失败。仅「无任何 TS 加载器的老命令」（非默认、非验收路径）失败才 skip；默认/显式加载器失败即真实失败（FATAL + 退出码 1） |
| **不接入任何页面** | 本轮只做能力封装与 API 参数扩展；分页接入涉及各页数据流裁决（统计侧栏等依赖全量数据的场景需另行决策），留 C3/P4 |

## 回归测试

- **Node v20.20.2**（`npx node@20`，与 Docker `node:20-slim` 同主版本）默认测试命令（等价 `npm test`）：`tests 100 / pass 100 / fail 0 / skipped 0`——5 项行为测试实际执行、无 skipped。
- **Node v22.16.0** 本机 `npm test`：同样 `pass 100 / fail 0 / skipped 0`；`npm run build` 通过。
- Node v20.20.2 执行 Docker frontend 同款 `nuxt generate`：构建成功输出 `.output/public`。
- skip 语义探针：默认 tsx 加载器 + 坏 import → `# fail 1`、退出码 1；老命令 `node --test`（无加载器）→ `# skipped 5`、退出码 0。

## 对后续迭代的影响

- B3（分页 hook 封装）收口：`usePagedList` 与 `dramaAPI.list` 分页参数就绪，后续分页/虚拟滚动接入（C3/P4）无需再动 API 契约。
- hook 接入边界：分页主列表可直接消费；页面若另有「依赖全量数据」的统计侧栏，需先裁决数据流（沿用全量接口或改聚合口径），hook 不承担该决策。
- 测试设施基线：frontend 默认 `npm test` 现为 `node --import tsx/esm --test`（Node ≥18 可跑，Windows/Linux 通用）；行为测试文件 import `.ts` 失败时默认环境会 fail 而非 skip——后续加 TS 行为测试沿用同一模式，勿退回 `--experimental-strip-types`。
- B2（巨型页面拆分）待排期；新列表拉取一律优先考虑 `usePagedList`，禁止新增全量一次拉取模式（除已裁决的统计类数据）。

## 注意事项

- 行为测试文件顶部按 `process.execArgv.concat(process.argv)` 是否含 `tsx`/`strip-types` 判定加载器：老命令 `node --test` 会整体 skip 并提示改用 `npm test`，属预期（非默认路径）。
- `usePagedList` 的 `fixed` 改动后需调用方自行 `reset()` + `reload()`（hook 不监听 fixed 变化）。
- 后端 `GET /dramas` 未返回 `pagination` 的整表场景：首载后 `hasMore` 恒 false，调用方无需特殊分支（`total_pages` 缺省按 `total/pageSize` 向上取整兜底）。
