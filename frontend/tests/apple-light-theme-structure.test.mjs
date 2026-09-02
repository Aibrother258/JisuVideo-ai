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
  // 白底卡/激活块 → 表面 token；玻璃徽标/浮层 → 既有 glass/float token
  assert.match(episode, /\.stage-subnav-item\.active[\s\S]*?background: var\(--surface-raised\)/)
  assert.match(episode, /\.merge-card[\s\S]*?background: var\(--surface-raised\)/)
  assert.match(episode, /\.asset-cover-badge[\s\S]*?background: var\(--surface-glass\)/)
  // 批次内 #fff 白字白底与深色台面字面量清零（#000/#111/半透明白等单次低价值字面量留待 A2 色板）
  assert.doesNotMatch(episode, /color: #fff/)
  assert.doesNotMatch(episode, /background: #fff/)
  assert.doesNotMatch(episode, /#0b0d10/)
})

test('A2 batch1: detail asset-kind/status semantic colors and amber notice banner resolve to tokens', () => {
  const detail = read('../app/views/drama/detail.vue')
  const layout = read('../app/layouts/default.vue')
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
  // detail 素材封面玻璃徽标 → 既有 glass/float token（同值）
  assert.match(detail, /\.asset-cover-badge[\s\S]*?background: var\(--surface-glass\)[\s\S]*?box-shadow: var\(--shadow-float\)/)
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
  // index：source-badge 归 success/new-style token
  assert.match(index, /\.source-badge\.is-existing \{ background: var\(--success-bg\); color: var\(--success-strong\); \}/)
  assert.match(index, /\.source-badge\.is-new \{ background: var\(--new-style-bg\); color: var\(--new-style\); \}/)
  assert.match(index, /\.new-style-confirm[\s\S]*?border: 1px solid var\(--new-style-border\)[\s\S]*?background: var\(--new-style-soft\)/)
  assert.match(index, /\.new-style-copy \{ display: flex; align-items: flex-start; gap: 9px; color: var\(--new-style\); \}/)
  // ModelSelect：R5 fallback 清零
  assert.doesNotMatch(modelSelect, /var\(--(?:accent|accent-bg|bg-1|bg-3|ease-out),/)
})
