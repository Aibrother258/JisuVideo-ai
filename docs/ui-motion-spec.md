# UI 动效规范（A3）

> 版本：v1.0（2026-09-03，随 A3 批次合入）
> 关联：`docs/ui-optimization-plan.md` P1-A3；`docs/ui-semantic-color-spec.md`（同族规范）
> 载体：token 定义于 `frontend/app/assets/studio.css` `:root`（A3 动效体系注释段）；结构测试断言于 `frontend/tests/apple-light-theme-structure.test.mjs`（A3 motion 组）

## 1. 目标

统一前端动效的**缓动曲线**与**进入/切换动画用法**，收敛散落的时长字面量，为组件化（P2-B1）与暗色主题批次提供单一调节面。

## 2. 缓动体系

| token | 值 | 用途 |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | **唯一推荐缓动**：交互态、进入/切换、浮层、面板（Apple Light 出加速） |

**循环/装饰例外**（允许不使用 `--ease-out`，见 §5）：
- `linear`：旋转 spinner / 加载环（spin 0.7–0.9s）
- `ease-in-out`：骨架屏闪烁（app-pulse / skeleton-pulse）

**默认 ease 清理**：本批已把此前「transition 未写缓动（走 CSS 默认 ease）」的行全部显式补 `var(--ease-out)`（约 30 处，含 detail 审阅卡/ep-arrow、settings chip/agent/skill 卡片头、ModelSelect 菜单项、studio input 等）。新代码禁止裸 transition（必须带 `var(--ease-out)`）。

## 3. 时长档（token 与归一记录）

| token | 值 | 语义 | 归并来源（值漂移≤0.03s） |
|---|---|---|---|
| `--dur-instant` | 0.12s | 按压/瞬时反馈 | 0.12s（btn press、chip/option 瞬时 hover） |
| `--dur-fast` | 0.16s | hover/描边等轻交互 | 0.14s / 0.15s / 0.16s |
| `--dur-base` | 0.18s | 通用交互动画（悬停提拉/升格） | 0.18s |
| `--dur-med` | 0.22s | 浮层/面板/开关进入 | 0.2s / 0.22s / 0.24s |
| `--dur-slow` | 0.32s | 页面/段落 fadeUp/fadeIn 进入 | 0.3s / 0.32s / 0.35s 取中值 0.32（最大偏差≤0.03s，0.35 原值偏差恰在边界） |
| `--dur-stagger` | 0.04s | stagger 级联步进 | `.stagger-N { animation-delay: calc(var(--dur-stagger) * N) }` |

> 归一原则与色板 R3 一致：**值不变改引用优先**；档内合并的旧值均为相邻档（绝对差 ≤0.03s），肉眼不可分，记录于此供复核。

## 4. 应用面约定

- **交互微动效**（hover/active/选中描边）：`var(--dur-fast)` 或 `var(--dur-instant)` + `var(--ease-out)`
- **卡片/浮层/面板进入**（switch、dialog scaleIn、下拉菜单、任务抽屉）：`var(--dur-med)`
- **页面/区块首帧进入**：`animation: fadeUp var(--dur-slow) var(--ease-out) both`；多元素级联用 `.page-enter` + `.stagger-N`（N≤5）
- **进度/追踪类**（宽度跟随）：保留较慢档（见 §5 例外）
- `page-enter`/`stagger-N` 当前无模板应用（梳理结论：作为「区块/页面首帧进入」工具类保留，供 P2 页面拆分与整页切换接入）

## 5. 例外清单（允许的裸时长，均带缓动且语义固定）

| 位置 | 时长 | 用途 |
|---|---|---|
| studio.css `.progress` | `0.4s var(--ease-out)` | 进度条宽度追踪 |
| detail.vue `.review-progress` | `0.28s var(--ease-out)` | 审阅进度条宽度追踪 |
| spin 旋转（全局/组件） | `0.7s / 0.8s / 0.9s linear` | 加载环（线性旋转） |
| 骨架闪烁 | `1.4s / 1.6s ease-in-out` | app-pulse / skeleton-pulse |
| episode `.pipe-section-pulse` | `1.6s var(--ease-out)` | 处理段呼吸光晕（装饰循环） |

**keyframes 单一来源**：`spin`/`fadeIn`/`fadeUp`/`scaleIn` 仅定义于 studio.css；组件/页面不得重复定义同名关键帧（detail/index 原局部 `spin` 已删除改引全局）。

## 6. 维护规约

1. 新动效一律引用 `var(--dur-*)` + `var(--ease-out)`；新增时长值先归入最近档或更新本规范 §3。
2. 新 keyframes 命名空间避免与全局（spin/fadeIn/fadeUp/scaleIn）冲突。
3. 结构测试（apple-light-theme A3 组）守卫：归一档字面量（0.14–0.32s）不得出现在 vue 文件中；spin 仅 studio.css 定义。
4. 暗色主题 / 动效偏好（reduce-motion）批次：以本规范 token 为调节面，禁止继续散落字面量。
