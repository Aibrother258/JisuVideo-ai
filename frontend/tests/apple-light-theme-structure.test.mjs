import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const studioCss = read('../app/assets/studio.css')
const layout = read('../app/layouts/default.vue')
const surfaces = [
  studioCss,
  layout,
  read('../app/pages/index.vue'),
  read('../app/views/drama/detail.vue'),
  read('../app/views/drama/episode.vue'),
  read('../app/pages/settings.vue'),
].join('\n')

test('apple light theme exposes the selected neutral and system-blue tokens', () => {
  assert.match(studioCss, /--surface-base:\s*#f5f5f7/i)
  assert.match(studioCss, /--surface-raised:\s*#ffffff/i)
  assert.match(studioCss, /--accent:\s*#0071e3/i)
  assert.match(studioCss, /--success:\s*#34c759/i)
  assert.match(studioCss, /--font-body:\s*-apple-system,\s*BlinkMacSystemFont,\s*'SF Pro Text'/)
})

test('core surfaces remove the old film-console and graphite decoration', () => {
  assert.doesNotMatch(surfaces, /#d96f27|rgba\(217\s*,\s*111\s*,\s*39/i)
  assert.doesNotMatch(surfaces, /repeating-linear-gradient/i)
  assert.doesNotMatch(surfaces, /#15171a|#1c1f23|#20242a|#30343a/i)
  assert.doesNotMatch(surfaces, /#4c8dff|rgba\(76\s*,\s*141\s*,\s*255/i)
})

test('A1 token batch4: badge/on-dark/panel whites resolve to tokens across core files', () => {
  const settings = read('../app/pages/settings.vue')
  const dialog = read('../app/components/ConfirmDialog.vue')
  const layout = read('../app/layouts/default.vue')
  const detail = read('../app/views/drama/detail.vue')
  // 徽标方形投影 token（cap-badge / style-detail-badge / provider-badge 三处同值）
  assert.match(studioCss, /--shadow-badge: 0 1px 4px rgba\(0,0,0,0\.12\);/)
  // settings：能力/风格/服务徽标白字 + 方形投影
  assert.match(settings, /\.cap-badge[\s\S]*?color: var\(--text-invert\)/)
  assert.match(settings, /box-shadow: var\(--shadow-badge\);/)
  assert.match(settings, /\.cfg-model-check \{ color: var\(--text-invert\);/)
  // ConfirmDialog：危险按钮白字（反色文字）
  assert.match(dialog, /\.confirm-danger-btn[\s\S]*?color: var\(--text-invert\)/)
  // default：品牌字标深块反色白字 + 导航激活段白底
  assert.match(layout, /\.brand-fallback[\s\S]*?color: var\(--text-invert\)/)
  assert.match(layout, /\.nav-link\.active[\s\S]*?background: var\(--surface-raised\)/)
  // detail：页内审阅卡与分集 Tab 选中态白底
  assert.match(detail, /\.episode-inline-review[\s\S]*?background: var\(--surface-raised\)/)
  assert.match(detail, /\.episode-detail-tab\.on[\s\S]*?background: var\(--surface-raised\)/)
  // 批次内 #fff 字面量清零（单文件 amber 横幅体系 #fffbeb 等留待 A2 色板统一）
  for (const src of [settings, dialog, layout, detail]) assert.doesNotMatch(src, /color: #fff/)
  assert.doesNotMatch(settings, /rgba\(0, 0, 0, 0\.12\)/)
})

test('A1 token batch5: episode player dark stage / on-media whites / status outlines resolve to tokens', () => {
  const episode = read('../app/views/drama/episode.vue')
  const statusBadge = read('../app/components/StatusBadge.vue')
  // 媒体深色台面 token（letterbox 底 #0b0d10×4：历史缩略图 / 播放舞台 / merge 卡视频 / exp 缩略图）
  assert.match(studioCss, /--media-stage-bg: #0b0d10;/)
  assert.match(episode, /\.video-history-item[\s\S]*?background: var\(--media-stage-bg\)/)
  assert.match(episode, /\.video-player-stage[\s\S]*?background: var\(--media-stage-bg\)/)
  assert.match(episode, /\.merge-card video[\s\S]*?background: var\(--media-stage-bg\)/)
  assert.match(episode, /\.exp-thumb[\s\S]*?background: var\(--media-stage-bg\)/)
  // 状态描边：0.30 步骤完成节点 / 0.32 视频任务成功·失败徽标成对描边
  assert.match(studioCss, /--success-border: rgba\(52,199,89,0\.30\);/)
  assert.match(studioCss, /--success-border-strong: rgba\(52,199,89,0\.32\);/)
  assert.match(studioCss, /--warning-border-strong: rgba\(255,159,10,0\.32\);/)
  assert.match(episode, /\.pipe-item\.done \.pipe-icon[\s\S]*?border-color: var\(--success-border\)/)
  assert.match(episode, /\.video-task-metric\.is-done,[\s\S]*?border-color: var\(--success-border-strong\)/)
  assert.match(episode, /\.video-task-status\.is-blocked[\s\S]*?border-color: var\(--warning-border-strong\)/)
  // 深底/彩底白字 → 反色文字 token（播放器叠层、勾选、角标、成功徽标等）
  assert.match(episode, /\.asset-del-btn[\s\S]*?color: var\(--text-invert\)/)
  assert.match(episode, /\.shot-check[\s\S]*?color: var\(--text-invert\)/)
  assert.match(episode, /\.video-history-time[\s\S]*?color: var\(--text-invert\)/)
  assert.match(episode, /\.prod-overlay-badge[\s\S]*?color: var\(--text-invert\)/)
  assert.match(episode, /\.exp-thumb-duration[\s\S]*?color: var\(--text-invert\)/)
  // 白底卡/激活块 → 表面 token；玻璃徽标/浮层 → 既有 glass/float token（B1 batch4 起徽标样式下沉组件）
  assert.match(episode, /\.stage-subnav-item\.active[\s\S]*?background: var\(--surface-raised\)/)
  assert.match(episode, /\.merge-card[\s\S]*?background: var\(--surface-raised\)/)
  assert.match(statusBadge, /\.sb-cover[\s\S]*?background: var\(--surface-glass\)/)
  // 批次内 #fff 白字白底与深色台面字面量清零（#000/#111/半透明白等单次低价值字面量留待 A2 色板）
  assert.doesNotMatch(episode, /color: #fff/)
  assert.doesNotMatch(episode, /background: #fff/)
  assert.doesNotMatch(episode, /#0b0d10/)
})

test('A2 batch1: detail asset-kind/status semantic colors and amber notice banner resolve to tokens', () => {
  const detail = read('../app/views/drama/detail.vue')
  const layout = read('../app/layouts/default.vue')
  const statusBadge = read('../app/components/StatusBadge.vue')
  // 资产类别语义 token（scene 绿 / prop 琥珀；character 沿用 accent）
  assert.match(studioCss, /--kind-scene:\s*#16a34a;/)
  assert.match(studioCss, /--kind-scene-strong:\s*#15803d;/)
  assert.match(studioCss, /--kind-scene-bg:\s*rgba\(34,197,94,0\.10\);/)
  assert.match(studioCss, /--kind-prop:\s*#b45309;/)
  assert.match(studioCss, /--kind-prop-bg:\s*rgba\(180,83,9,0\.10\);/)
  // amber 提示横幅 token（布局 config banner）
  assert.match(studioCss, /--notice-bg:\s*#fffbeb;/)
  assert.match(studioCss, /--notice-border:\s*#fde68a;/)
  assert.match(studioCss, /--notice-text:\s*#92400e;/)
  assert.match(studioCss, /--notice-link:\s*#b45309;/)
  assert.match(studioCss, /--notice-link-border:\s*#fcd34d;/)
  assert.match(studioCss, /--notice-link-hover-bg:\s*#fef3c7;/)
  // detail 素材分组头改引用（值不变）
  assert.match(detail, /\.asset-group-head\.is-scene[\s\S]*?border-left-color: var\(--kind-scene\)/)
  assert.match(detail, /\.asset-group-head\.is-scene[\s\S]*?background: var\(--kind-scene-bg\)[\s\S]*?color: var\(--kind-scene-strong\)/)
  assert.match(detail, /\.asset-group-head\.is-prop[\s\S]*?border-left-color: var\(--kind-prop\)[\s\S]*?background: var\(--kind-prop-bg\)[\s\S]*?color: var\(--kind-prop\)/)
  // 「制作中」状态归入 success 家族（原 scene 同值绿 #16a34a 属状态语义）
  assert.match(detail, /\.ep-status-active[\s\S]*?background: var\(--success-bg\)[\s\S]*?color: var\(--success-strong\)/)
  assert.match(detail, /\.dot-active[\s\S]*?box-shadow: 0 0 4px var\(--success-border-strong\)/)
  // 素材封面玻璃徽标 → 既有 glass/float token（同值；B1 batch4 起样式下沉 StatusBadge 组件）
  assert.match(statusBadge, /\.sb-cover[\s\S]*?background: var\(--surface-glass\)[\s\S]*?box-shadow: var\(--shadow-float\)/)
  // 布局 amber 横幅字面量清零、改引用
  assert.match(layout, /\.config-banner[\s\S]*?color: var\(--notice-text\)[\s\S]*?background: var\(--notice-bg\)[\s\S]*?border-bottom: 1px solid var\(--notice-border\)/)
  assert.match(layout, /\.config-banner-link[\s\S]*?color: var\(--notice-link\)[\s\S]*?border: 1px solid var\(--notice-link-border\)/)
  assert.match(layout, /\.config-banner-link:hover[\s\S]*?background: var\(--notice-link-hover-bg\)[\s\S]*?color: var\(--notice-text\)/)
  // 批次内字面量清零（A2 前 detail scene/prop 色与 default amber 横幅不复现）
  assert.doesNotMatch(detail, /#16a34a|#15803d|#b45309/)
  assert.doesNotMatch(detail, /rgba\(34,197,94|rgba\(180,83,9/)
  assert.doesNotMatch(layout, /#fffbeb|#fde68a|#fcd34d|#fef3c7|#92400e|#b45309/)
})

test('A2 batch2: media scrim/text layers, R5 fallback removal, settings/error and new-style tokens resolve', () => {
  const episode = read('../app/views/drama/episode.vue')
  const settings = read('../app/pages/settings.vue')
  const index = read('../app/pages/index.vue')
  const layout = read('../app/layouts/default.vue')
  const modelSelect = read('../app/components/ModelSelect.vue')
  // 新增 token 定义
  assert.match(studioCss, /--accent-soft:\s*#f0f7ff;/)
  assert.match(studioCss, /--bar-glass:\s*rgba\(251,251,253,0\.72\);/)
  assert.match(studioCss, /--media-scrim-soft:\s*rgba\(0,0,0,0\.28\);/)
  assert.match(studioCss, /--media-scrim:\s*rgba\(0,0,0,0\.50\);/)
  assert.match(studioCss, /--media-scrim-strong:\s*rgba\(0,0,0,0\.60\);/)
  assert.match(studioCss, /--media-text:\s*rgba\(255,255,255,0\.85\);/)
  assert.match(studioCss, /--media-text-dim:\s*rgba\(255,255,255,0\.45\);/)
  assert.match(studioCss, /--error-border-strong:\s*rgba\(255,59,48,0\.40\);/)
  assert.match(studioCss, /--new-style:\s*#8642a6;/)
  assert.match(studioCss, /--new-style-soft:\s*rgba\(175,82,222,0\.05\);/)
  assert.match(studioCss, /--new-style-border:\s*rgba\(175,82,222,0\.22\);/)
  // episode：on-media 深底收敛到 scrim 档、白字归 media-text、accent ring 归 glow
  assert.match(episode, /\.asset-del-btn[\s\S]*?background: var\(--media-scrim\)/)
  assert.match(episode, /\.frame-re[\s\S]*?background: var\(--media-scrim\)/)
  assert.match(episode, /\.video-task-index[\s\S]*?background: var\(--media-scrim\)/)
  assert.match(episode, /\.video-history-time[\s\S]*?background: var\(--media-scrim-strong\)/)
  assert.match(episode, /\.video-history-del[\s\S]*?background: var\(--media-scrim-strong\)/)
  assert.match(episode, /\.merge-card-play[\s\S]*?background: var\(--media-scrim-soft\)/)
  assert.match(episode, /\.exp-check[\s\S]*?background: var\(--media-scrim-soft\)/)
  assert.match(episode, /\.exp-check[\s\S]*?border: 1\.5px solid var\(--media-text\)/)
  assert.match(episode, /\.video-player-empty[\s\S]*?color: var\(--media-text-dim\)/)
  assert.match(episode, /\.video-player-empty-title \{ color: var\(--media-text\)/)
  assert.match(episode, /\.storyboard-shot-card\.active[\s\S]*?box-shadow: 0 0 0 3px var\(--accent-glow\)/)
  assert.match(episode, /\.ref-asset-card\.locked \{ border-color: var\(--success\); \}/)
  assert.match(episode, /\.ref-asset-card img,[\s\S]*?background: var\(--media-stage-bg\);/)
  assert.match(episode, /\.storyboard-shot-card\.is-selected[\s\S]*?background: var\(--accent-soft\);/)
  assert.match(episode, /\.video-ref-media-chip[\s\S]*?background: var\(--surface-muted\);/)
  // episode：R5 fallback 清零（未定义的 accent-soft/surface-2 已正式化或改已定义 token）
  assert.doesNotMatch(episode, /var\(--[\w-]+,\s*(?:#|rgba)/)
  // 静态非颜色 fallback 也清零（radius-sm/font-mono 已全局定义；运行时动态拖拽宽度 fallback 保留）
  assert.doesNotMatch(episode, /var\(--radius-sm, 6px\)/)
  assert.doesNotMatch(episode, /font-family: var\(--font-mono,/)
  // --sel 局部定义维持（裁决：单页模型选中语义，规范 §5 记录；暗色主题批次再定全局）
  // default：顶部玻璃条与导航激活段 shadow 收敛
  assert.match(layout, /background: var\(--bar-glass\);/)
  assert.match(layout, /\.nav-link\.active[\s\S]*?box-shadow: var\(--shadow-float\);/)
  // settings：R6 内联图标色转 class + error token；测试结果描边入 border token；R5 fallback 清零
  assert.doesNotMatch(settings, /color:#d9534f/)
  assert.match(settings, /\.skill-load-error-icon \{ color: var\(--error\); \}/)
  assert.match(settings, /\.test-result\.ok \{ border-color: var\(--success-border-strong\);/)
  assert.match(settings, /\.test-result\.bad \{ border-color: var\(--error-border-strong\);/)
  assert.doesNotMatch(settings, /var\(--accent-bg,/)
  assert.doesNotMatch(settings, /var\(--border-strong,/)
  // index：source-badge 归 success/new-style token
  assert.match(index, /\.source-badge\.is-existing \{ background: var\(--success-bg\); color: var\(--success-strong\); \}/)
  assert.match(index, /\.source-badge\.is-new \{ background: var\(--new-style-bg\); color: var\(--new-style\); \}/)
  assert.match(index, /\.new-style-confirm[\s\S]*?border: 1px solid var\(--new-style-border\)[\s\S]*?background: var\(--new-style-soft\)/)
  assert.match(index, /\.new-style-copy \{ display: flex; align-items: flex-start; gap: 9px; color: var\(--new-style\); \}/)
  // ModelSelect：R5 fallback 清零
  assert.doesNotMatch(modelSelect, /var\(--(?:accent|accent-bg|bg-1|bg-3|ease-out),/)
})

test('A3 motion: duration tiers/easing tokens defined, component+page animations reference tokens, raw durations cleared', () => {
  const episode = read('../app/views/drama/episode.vue')
  const detail = read('../app/views/drama/detail.vue')
  const settings = read('../app/pages/settings.vue')
  const index = read('../app/pages/index.vue')
  const layout = read('../app/layouts/default.vue')
  const appDrawer = read('../app/components/AppDrawer.vue')
  const baseSelect = read('../app/components/BaseSelect.vue')
  const modelSelect = read('../app/components/ModelSelect.vue')
  // 时长档 token 定义
  assert.match(studioCss, /--dur-instant: 0\.12s;/)
  assert.match(studioCss, /--dur-fast: 0\.16s;/)
  assert.match(studioCss, /--dur-base: 0\.18s;/)
  assert.match(studioCss, /--dur-med: 0\.22s;/)
  assert.match(studioCss, /--dur-slow: 0\.32s;/)
  assert.match(studioCss, /--dur-stagger: 0\.04s;/)
  // 组件层收敛（值不变改引用）
  assert.match(studioCss, /transition: background var\(--dur-base\) var\(--ease-out\), color var\(--dur-base\) var\(--ease-out\), box-shadow var\(--dur-base\) var\(--ease-out\), transform var\(--dur-instant\) var\(--ease-out\);/)
  assert.match(studioCss, /transition: border-color var\(--dur-fast\) var\(--ease-out\), box-shadow var\(--dur-fast\) var\(--ease-out\), background var\(--dur-fast\) var\(--ease-out\);/)
  assert.match(studioCss, /transition: box-shadow var\(--dur-med\) var\(--ease-out\), transform var\(--dur-med\) var\(--ease-out\), border-color var\(--dur-med\) var\(--ease-out\);/)
  assert.match(studioCss, /animation: scaleIn var\(--dur-med\) var\(--ease-out\);/)
  assert.match(studioCss, /animation: fadeIn var\(--dur-base\) var\(--ease-out\);/)
  assert.match(studioCss, /animation: fadeUp var\(--dur-slow\) var\(--ease-out\) both;/)
  assert.match(studioCss, /\.stagger-5 \{ animation-delay: calc\(var\(--dur-stagger\) \* 5\); \}/)
  // 进入动画按 slow 档；页面与菜单浮层引用档 token
  assert.match(episode, /animation: fadeIn var\(--dur-slow\) var\(--ease-out\);/)
  assert.match(appDrawer, /animation: appDrawerIn var\(--dur-med\) var\(--ease-out\);/)
  assert.match(detail, /animation: fadeUp var\(--dur-slow\) var\(--ease-out\) both;/)
  assert.match(modelSelect, /animation: modelMenuIn var\(--dur-fast\) var\(--ease-out\);/)
  assert.match(baseSelect, /animation: baseSelectIn var\(--dur-fast\) var\(--ease-out\);/)
  // 默认 ease 残留行已显式补缓动（选择器级抽查）
  assert.match(modelSelect, /transition: background var\(--dur-instant\) var\(--ease-out\);/)
  assert.match(settings, /transition: background var\(--dur-fast\) var\(--ease-out\);/)
  assert.match(detail, /transition: transform var\(--dur-base\) var\(--ease-out\), color var\(--dur-base\) var\(--ease-out\);/)
  // 内联 style 无效 transition('0.2s') 已修为有效属性 + token
  assert.match(settings, /transition: 'transform var\(--dur-med\) var\(--ease-out\)'/)
  // 重复 spin keyframes 收敛（studio.css 全局唯一）
  assert.match(studioCss, /@keyframes spin \{ to \{ transform: rotate\(360deg\); \} \}/)
  assert.doesNotMatch(detail, /@keyframes spin/)
  assert.doesNotMatch(index, /@keyframes spin/)
  // 归一档字面量清零（spin/skeleton/progress 等循环例外保留：0.7/0.8/0.9/1.4/1.6/0.4/0.28s）
  for (const src of [episode, detail, settings, index, layout, appDrawer, baseSelect, modelSelect]) {
    assert.doesNotMatch(src, /\b0\.(?:1[2456]|2[24]?|3[25]?)s\b/)
  }
})

test('B1 batch1: AppDialog owns overlay/dialog shell + close protocol, settings dialogs migrated', () => {
  const appDialog = read('../app/components/AppDialog.vue')
  const settings = read('../app/pages/settings.vue')
  // 组件收敛 .overlay/.dialog 骨架与 head/body/foot 三段
  assert.match(appDialog, /class="overlay"/)
  assert.match(appDialog, /class="dialog"/)
  assert.match(appDialog, /class="dialog-head"/)
  assert.match(appDialog, /class="dialog-body"/)
  assert.match(appDialog, /class="dialog-foot"/)
  // form 模式：渲染 <form> 并 prevent 默认提交；尺寸走 prop 内联样式（规避页面 scoped 类跨组件失效）
  assert.match(appDialog, /:is="form \? 'form' : 'div'"/)
  assert.match(appDialog, /@submit\.prevent="handleSubmit"/)
  assert.match(appDialog, /width \|\| undefined.*dialogStyle|:style="\[/)
  assert.match(appDialog, /dialogStyle/)
  // 关闭协议：Esc 与遮罩点击统一派发 close（与 ConfirmDialog 对齐）
  assert.match(appDialog, /Escape/)
  assert.match(appDialog, /emit\('close'\)/)
  // settings 四个手写弹窗已迁移至 <AppDialog>，不再有裸 .overlay / @click.self 关闭
  assert.match(settings, /<AppDialog v-if="cfgDialog"/)
  assert.match(settings, /<AppDialog v-if="addSkillDialog"/)
  assert.match(settings, /<AppDialog v-if="styleDialog"/)
  assert.match(settings, /<AppDialog v-if="stylePromptOpen"/)
  assert.doesNotMatch(settings, /class="overlay"/)
  assert.doesNotMatch(settings, /@click\.self/)
  // 原 scoped 弹窗宽度类（.config-dialog/.skill-dialog）已改由 width prop 提供
  assert.doesNotMatch(settings, /\.config-dialog \{/)
  assert.doesNotMatch(settings, /\.skill-dialog \{/)
})

test('B1 batch2: detail/episode standard dialogs migrate to AppDialog, body layouts stay page-scoped', () => {
  const detail = read('../app/views/drama/detail.vue')
  const episode = read('../app/views/drama/episode.vue')
  // detail 创建新集 / episode 新增资产 / 参考素材选择均已迁移
  assert.match(detail, /<AppDialog v-if="addDialog"/)
  assert.match(episode, /<AppDialog\s+v-if="assetCreate\.open"/)
  assert.match(episode, /<AppDialog\s+v-if="refAssetPicker\.open"/)
  // overlay 修饰类经组件根透传保留（ref-asset-picker-overlay 的 z-index:120 提升）
  assert.match(episode, /class="ref-asset-picker-overlay"/)
  // 宽度/最大高度经 width + dialogStyle 内联（scoped 类无法命中组件内部 .dialog）
  assert.match(detail, /<AppDialog v-if="addDialog" width="min\(480px, 100%\)"/)
  assert.match(episode, /width="440px"/)
  assert.match(episode, /maxHeight: 'min\(760px, calc\(100vh - 48px\)\)'/)
  // body 内容间距保留在页面插槽内的私有容器（原 .dialog-body 覆盖迁移为插槽容器类）
  assert.match(detail, /<div class="ep-add-fields">/)
  assert.match(episode, /<div class="asset-create-body">/)
  assert.match(episode, /<div class="ref-asset-picker-body">/)
  // 已删除不再引用的 scoped 弹窗尺寸类与骨架覆盖
  assert.doesNotMatch(detail, /\.ep-dialog \{/)
  assert.doesNotMatch(detail, /^\.dialog-body \{/)
  assert.doesNotMatch(episode, /\.asset-create-dialog \{/)
  assert.doesNotMatch(episode, /\.ref-asset-picker-dialog \{/)
  // 骨架深度定制/多步/查看类弹窗保留手写（批量评审边界：需专项设计后再迁移；
  // 任务抽屉骨架已于 batch3 收敛至 AppDrawer，此处仅核对其余手写 overlay 仍在页面）
  assert.match(detail, /mat-detail-dialog/)
  assert.match(episode, /image-viewer-overlay/)
  assert.match(episode, /asset-detail-overlay/)
})

test('B1 batch3: AppDrawer owns right-drawer shell, episode task drawer migrated', () => {
  const appDrawer = read('../app/components/AppDrawer.vue')
  const episode = read('../app/views/drama/episode.vue')
  // 组件收敛抽屉骨架：复用全局 .overlay 遮罩（面板定位右端 + z-index:118）、面板、#head 槽
  assert.match(appDrawer, /class="overlay app-drawer-overlay"/)
  assert.match(appDrawer, /class="app-drawer"/)
  assert.match(appDrawer, /class="app-drawer-head"/)
  assert.match(appDrawer, /justify-content: flex-end;/)
  assert.match(appDrawer, /z-index: 118;/)
  assert.match(appDrawer, /@click\.self="handleMaskClick"/)
  // 关闭协议与 AppDialog 对齐：Esc / 遮罩统一 emit close
  assert.match(appDrawer, /Escape/)
  assert.match(appDrawer, /emit\('close'\)/)
  // episode 任务抽屉已迁移至 <AppDrawer>（宽度 prop、#head 槽、遮罩关闭）
  assert.match(episode, /<AppDrawer\s+v-if="taskDrawer"/)
  assert.match(episode, /width="min\(560px, 100vw\)"/)
  assert.match(episode, /<template #head>/)
  assert.match(episode, /@close="closeTaskDrawer"/)
  // 手写抽屉骨架清零（.task-drawer-overlay/.task-drawer/@keyframes taskDrawerIn 已下沉组件）
  assert.doesNotMatch(episode, /class="task-drawer-overlay"/)
  assert.doesNotMatch(episode, /\.task-drawer \{/)
  assert.doesNotMatch(episode, /@keyframes taskDrawerIn/)
  // Esc 优先级协议仍在页面集中处理，组件内 Esc 关闭置否（避免上层浮层打开时误关抽屉）
  assert.match(episode, /:esc-close="false"/)
  assert.match(episode, /handleImageViewerKeydown[\s\S]{0,400}closeTaskDrawer\(\)/)
  // 抽屉内容级布局类保留页面作用域（head 操作 / metrics / 列表滚动 / 空态）
  assert.match(episode, /\.task-drawer-head-actions \{/)
  assert.match(episode, /\.task-drawer-metrics \{/)
  assert.match(episode, /\.task-drawer-body \{/)
})

test('B1 batch4: StatusBadge owns cover glass badge + state pill, detail/episode migrated', () => {
  const badge = read('../app/components/StatusBadge.vue')
  const detail = read('../app/views/drama/detail.vue')
  const episode = read('../app/views/drama/episode.vue')
  // 组件收敛两类状态徽标：variant=cover 封面玻璃角标 / pill 行内胶囊（默认）；state 三态
  assert.match(badge, /variant\?: 'cover' \| 'pill'/)
  assert.match(badge, /state\?: '' \| 'ready' \| 'pending'/)
  assert.match(badge, /class="status-badge"/)
  // 玻璃角标 / 胶囊配色随状态映射语义 token（原 .asset-cover-badge.is-* / .*-detail-state.is-ready）
  assert.match(badge, /\.sb-cover\.is-ready[\s\S]*?background: var\(--success-bg\)/)
  assert.match(badge, /\.sb-cover\.is-pending[\s\S]*?background: var\(--accent-bg\)/)
  assert.match(badge, /\.sb-pill[\s\S]*?background: var\(--fill-subtle\)/)
  assert.match(badge, /\.sb-pill\.is-ready[\s\S]*?color: var\(--success\)/)
  // detail/episode 模板迁移：cover 角标 + pill 状态均改 <StatusBadge>，状态判断/文案保留在调用页
  assert.match(detail, /<StatusBadge variant="cover"/)
  assert.match(detail, /<StatusBadge :state="matHasImage\(editTarget\)/)
  assert.match(episode, /<StatusBadge variant="cover"/)
  assert.match(episode, /<StatusBadge :state="assetImageSrc\(assetDetail\.item\)/)
  // 页面手写徽标样式清零（视觉零变化，样式下沉组件内；scoped 页面类对组件内部不可见）
  assert.doesNotMatch(detail, /\.asset-cover-badge/)
  assert.doesNotMatch(detail, /\.asset-detail-state/)
  assert.doesNotMatch(episode, /\.asset-cover-badge/)
  assert.doesNotMatch(episode, /\.asset-detail-state/)
})

test('B1 batch5: EmptyState owns dashed-card empty state, index/detail migrated', () => {
  const es = read('../app/components/EmptyState.vue')
  const index = read('../app/pages/index.vue')
  const detail = read('../app/views/drama/detail.vue')
  const episode = read('../app/views/drama/episode.vue')
  // 组件收敛「虚线圈框卡片空态」：容器 + 图标方块 + 标题 + 描述 + 默认插槽（动作）
  assert.match(es, /class="empty-state"/)
  assert.match(es, /title: string/)
  assert.match(es, /desc\?: string/)
  assert.match(es, /class="empty-icon"/)
  assert.match(es, /class="empty-title"/)
  assert.match(es, /class="empty-desc"/)
  assert.match(es, /<slot \/>/)
  // 卡片样式随组件下沉（原 index.vue / detail.vue 同名 scoped 类；desc 单行短句统一 260px 视觉零变化）
  assert.match(es, /\.empty-state \{[\s\S]*?min-height: 280px[\s\S]*?border: 1px dashed var\(--border-strong\)[\s\S]*?background: var\(--surface-raised\)/)
  assert.match(es, /\.empty-icon \{[\s\S]*?width: 56px[\s\S]*?background: var\(--bg-2\)/)
  assert.match(es, /\.empty-title \{ font-size: 14px; font-weight: 700; color: var\(--text-1\); \}/)
  assert.match(es, /\.empty-desc \{ font-size: 12px; color: var\(--text-3\); max-width: 260px; line-height: 1.6; \}/)
  // index/detail 模板迁移：空态块均改 <EmptyState>，图标经 #icon 插槽，按钮/动作留在默认插槽
  assert.match(index, /<EmptyState/)
  assert.match(index, /#icon/)
  assert.match(index, /@click="openCreateDialog"/)
  assert.match(detail, /<EmptyState/)
  assert.match(detail, /#icon/)
  assert.match(detail, /还没有任何素材/)
  assert.match(detail, /暂无\$\{tabLabel\(assetTab\)\}素材/)
  // 页面手写卡片空态样式清零（视觉零变化，样式下沉组件内）
  assert.doesNotMatch(index, /\.empty-state \{/)
  assert.doesNotMatch(index, /\.empty-icon \{/)
  assert.doesNotMatch(detail, /\.empty-state \{/)
  assert.doesNotMatch(detail, /\.empty-icon \{/)
  // 特殊形态不迁移守卫：episode 展示体空态与 detail 可点击 ep-empty CTA 卡仍手写页面作用域
  assert.match(episode, /\.step-empty \{/)
  assert.match(episode, /\.step-empty-actions \{/)
  assert.match(detail, /\.ep-empty[\s\S]*?hover/)
})
