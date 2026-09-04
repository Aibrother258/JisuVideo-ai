# UI C4 暗色主题第二批（B2）：局部语义色/投影残留收口 + `solid-ink` 反色实心块

> 分支：`ui-c4-dark-theme-batch2` → master
> 基准：master `7c99e15`（PR #53 C4 首批合入后）
> PR：#54（merge `f959214`，2026-09-04）
> 日期：2026-09-04
> 关联方案：`docs/ui-dark-theme-spec.md`（v1.1 → v1.2，见 spec §4-B2 / §6 第二批）；A2 规范 §5.1 遗留清单
> 承接：PR #53（首批，见 `2026-09-04-ui-c4-dark-theme-b1.md`）

## 1. 触发条件

按 `docs/ui-dark-theme-spec.md` §6 第二批路线与 A2 规范 §5.1 遗留清单推进：四个残留字面量（danger hover、三档投影）token 化；页面级暗色细节走查发现反色实心块误以 `--text-0` 为底（dark 反白 → 白字白底）。

## 2. 改了什么

| 文件 | 改动 |
|---|---|
| `frontend/app/assets/studio.css` | 新增 4 token 双态：`--action-danger-hover`（light `#d70015`=原值 / dark `#cc3b32` 白字 4.95:1）、`--shadow-hover`（light 不变 / dark 加深 0.32）、`--shadow-menu`（light 不变 / dark 0.1+0.24）、`--shadow-viewer`（light 不变 / dark 0.3）；新增反色实心块独立档 `--solid-ink`：light `#1d1d1f`（=原值零变化）/ dark `#48484a`（Apple dark 中灰实心，白字 ≈ 9:1 AA） |
| `frontend/app/components/ConfirmDialog.vue` | danger hover 字面量 `#d70015` → `var(--action-danger-hover)` |
| `frontend/app/components/ModelSelect.vue` | 弹层投影字面量 → `var(--shadow-menu)` |
| `frontend/app/views/drama/episode.vue` | `.frame-thumb:hover` → `var(--shadow-hover)`；`.image-viewer-img` → `var(--shadow-viewer)` |
| `frontend/app/pages/index.vue` | `.filter-chip.on` / `.step-indicator span.on`：`background: var(--text-0)` → `background: var(--solid-ink)`（色 `var(--text-invert)` 白字不变） |
| `frontend/app/layouts/default.vue` | `.brand-mark`（logo 方块）同上改 `var(--solid-ink)` |
| `frontend/tests/dark-theme-structure.test.mjs` | 新增守卫：light 每个颜色 token 必须有 dark 档或显式豁免（媒体画布/遮罩、彩底白字、封面白字族）；B2 残留清零（四处字面量、`--text-0` 作底）；`solid-ink` 三目标控件逐条断言（经三轮评审递进，见 §4） |

light 值全部不变；`ref-asset-card-check` 深 pill 属媒体覆盖、明暗通用，保持并记录（A2 §5.1）。

## 3. 关键设计决策

| # | 决策 | 依据 |
|---|---|---|
| 1 | 实心危险钮 hover 深档并入 action 系 `--action-danger-hover`（白字双主题 AA 4.95:1） | 与 `--action-primary-*` 同族，暗色可独立覆盖 |
| 2 | 三档残留投影分别升 shadow 家族档（hover/menu/viewer），dark 同族加深 | 浅色纸面黑投影在暗色下几乎不可见；语义归属 shadow 家族 |
| 3 | 反色实心块独立 `--solid-ink`，不复用 `--text-0` | `--text-0` 在 dark 反转为白，作底即白字白底；语义上「实心反色块底」与「主文本色」须可分别覆盖（dark 中 `--solid-ink` 为亮灰中调，`--text-0` 为纯白——前者作底后者作字才有对比） |
| 4 | 全量自动守卫补 dark 覆盖完整性 | 未来新增颜色 token 忘补 dark 档会直接红，杜绝「面漂移不感知」 |
| 5 | 守卫粒度与实际修复范围一一对应（逐选择器、逐规则体、全部同名出现） | 防「文件内还有一处 solid-ink 就放行」的假绿（详见 §4 三轮递进） |

## 4. 评审处理（三轮正式 Request Changes）

| 轮次 | 意见 | 处理（对应提交） |
|---|---|---|
| 1（08:03Z） | `solid-ink` 守卫只做「文件级至少出现一次」：三个目标控件（`.filter-chip.on` / `.step-indicator span.on` / `.brand-mark`）任一被改回 `--surface-raised` 或字面量色，只要文件别处还有 solid-ink 测试仍绿 | 按具体选择器逐条断言 + 禁字面量色/浅表面 token 回退（`39f619c`） |
| 2（08:13Z） | 同规则体仍可用 `background-color: #fff` 覆盖 shorthand 颜色层（`background: var(--solid-ink)` 断言满足、禁止项不命中）；建议选择器定位收紧为规则级 | 改为规则体内所有 `background`/`background-color` 声明值必须**恰好等于** `var(--solid-ink)`；`block()` 检查 selector 前一非空白字符，跳过「更大选择器后缀」（如 `div.filter-chip.on`）再继续找独立规则起始（`12ddc20`） |
| 3（08:20Z） | ① `block()` 只查第一条同名规则，cascade 中后置同名规则的覆盖（第二条 `.filter-chip.on { background-color:#fff }`）会生效但测试不查；② `.step-indicator span.on` 后代空格按字面量匹配，换行/Tab/多空格等合法格式化会误报「找不到规则」 | ① `rules()` 收集并校验该选择器**全部**独立规则体，逐条跑背景声明断言；② 选择器按 `\s+` 拆 token 后逐段精确转义再以 `\s+` 连接，class 名保持精确（`fb4ea63`） |

三轮均附双向验证：正向 `npm test` 全绿；负面注入（`background-color` 覆盖 / cascade 第二条同名 / 相似选择器 `div.` 前缀 / 跨行格式化）分别验证「拦截」与「不误报」。

## 5. 验证

- frontend `npm test`：**145/145 通过**（原 132 基线 + dark 覆盖完整性 / danger AA / solid-ink 守卫等新增）
- 负面验证（评审场景逐一复现）：`.brand-mark` 改回 `--surface-raised` 红；`.step-indicator span.on` 注入 `background-color:#fff` 红；追加第二条同名 `.filter-chip.on` 规则红；插入 `div.filter-chip.on` 变体不误命中；跨行格式化不误报
- `npm run test:build` 与 lint 0 诊断通过；diffstat 10 文件 +102/−19

## 6. 已知记录项 / 对后续迭代的影响

1. 守卫实现范式（block/rules + 声明值白名单 + 规则级定位）可复用到后续「某组件必须消费某 token」的断言，避免文件级宽匹配的假绿。
2. 第三批（设置页「外观」三态切换控件 + 持久化）是 C4 收尾；届时 `--solid-ink` 等 dark 档已全量就位，仅剩切换 UI 接线（`useTheme.setTheme` 已暴露待接）。
3. `solid-ink` dark 值 `#48484a` 为一次定版，若第三批人工视觉验收发现与其他深面层级不足，改 studio.css dark 档单点即可，守卫只锚消费点不断言具体值。
