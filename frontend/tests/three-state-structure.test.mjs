import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('global three-state styles live in studio.css', () => {
  const css = read('app/assets/studio.css')
  assert.match(css, /@keyframes app-pulse/)
  assert.match(css, /\.app-skeleton-line \{/)
  assert.match(css, /\.app-state \{/)
  assert.match(css, /\.app-state-error/)
  assert.match(css, /\.app-page-loading/)
  // 骨架使用语义化变量而不是硬编码色值
  assert.match(css, /background: var\(--bg-2\)/)
})

test('index page shows inline list error with retry instead of a silent state', () => {
  const page = read('app/pages/index.vue')
  assert.match(page, /const loadError = ref\(''\)/)
  assert.match(page, /loadError\.value = e\.message \|\| '加载失败'/)
  assert.match(page, /v-if="loadError" class="app-state app-state-error"/)
  assert.match(page, /@click="load\(\)"/)
  // 列表加载失败在 catch 内写内联错误（不再走 toast）
  assert.match(page, /catch \(e\) \{\s*\n\s*loadError\.value = e\.message \|\| '加载失败'/)
})

test('settings page shows skeleton + inline error per list (4 lists)', () => {
  const settings = read('app/pages/settings.vue')
  // 四组 loading/error refs
  for (const name of ['cfgs', 'style', 'agents', 'skills']) {
    assert.match(settings, new RegExp(`const ${name}Loading = ref\\(false\\)`))
    assert.match(settings, new RegExp(`const ${name}Error = ref\\(''\\)`))
  }
  // 四个 tab 内容区均有骨架与错误重试分支
  assert.match(settings, /v-if="cfgsLoading" class="sections"/)
  assert.match(settings, /v-else-if="cfgsError" class="app-state app-state-error"/)
  assert.match(settings, /v-if="styleLoading" class="card svc-group"/)
  assert.match(settings, /v-else-if="styleError" class="app-state app-state-error"/)
  assert.match(settings, /v-if="agentsLoading" class="agent-list"/)
  assert.match(settings, /v-else-if="agentsError" class="app-state app-state-error"/)
  assert.match(settings, /v-if="skillsLoading" class="card skills-empty"/)
  assert.match(settings, /v-else-if="skillsError" class="app-state app-state-error"/)
  // 重试按钮直接触发对应 load(true)
  assert.match(settings, /@click="loadCfgs\(true\)"/)
  assert.match(settings, /@click="loadStylePresets\(true\)"/)
  assert.match(settings, /@click="loadAgents\(true\)"/)
  assert.match(settings, /@click="loadAgents\(true\); loadAllSkills\(true\)"/)
  // 初始加载走骨架（onMounted 传 true）
  assert.match(settings, /loadCfgs\(true\); loadAgents\(true\); loadAllSkills\(true\); loadStylePresets\(true\)/)
})

test('detail/episode top-level loading shows skeleton and inline error instead of blank screen', () => {
  for (const f of ['app/views/drama/detail.vue', 'app/views/drama/episode.vue']) {
    const view = read(f)
    assert.match(view, /const pageLoading = ref\(false\)/)
    assert.match(view, /const pageLoadError = ref\(''\)/)
    assert.match(view, /v-if="pageLoading" class="app-page-loading"/)
    assert.match(view, /v-else-if="pageLoadError" class="app-page-loading"/)
    assert.match(view, /class="app-state app-state-error"/)
    // 初始加载失败走内联错误（initial 分支），非初始仍 toast
    assert.match(view, /if \(initial\) \{ pageLoadError\.value = e\.message \|\| '加载失败'; return \}/)
  }
  // 初始加载入口传 true
  assert.match(read('app/views/drama/detail.vue'), /onMounted\(\(\) => load\(true\)\)/)
  assert.match(read('app/views/drama/episode.vue'), /await refresh\(true\)/)
})

test('export panel shows inline merge error with retry and list load states', () => {
  const ep = read('app/views/drama/episode.vue')
  // P2-B2：拼接导出面板已下沉 EpisodeExportPanel.vue；面板 UI 三态在组件内，主壳保留 doMerge/轮询
  const panel = read('app/components/EpisodeExportPanel.vue')
  // 拼接失败内联横幅（内联错误条 + 重试/关闭）随 UI 下沉组件，重试/关闭经事件回主壳
  assert.match(panel, /v-if="mergeError" class="app-state-inline app-state-error"/)
  assert.match(panel, /@click="emit\('retry-merge'\)"/)
  assert.match(panel, /@click="emit\('clear-merge-error'\)"/)
  // 发起失败与后台轮询失败都写入内联错误（仍在主壳 doMerge 内，经 mergeError prop 呈现在组件）
  assert.match(ep, /catch \(e\) \{[\s\S]*?mergeError\.value = e\.message \|\| '拼接失败'/)
  assert.match(ep, /mergeError\.value = mergeData\.value\?\.error_msg \|\| mergeData\.value\?\.errorMsg \|\| '拼接失败'/)
  // 成片列表三态：骨架 / 内联错误 / 列表（随组件下沉）
  // P1 评审修复（PR #45）：三态收敛到 useExportMergesList（“最新请求获胜”），组件解构消费，
  // 不再在组件内裸 ref 直接写（避免并发旧响应覆盖新列表/旧失败写回错误）
  assert.match(panel, /const \{ exportMerges, exportListLoading, exportListError, [\s\S]*?useExportMergesList\(/)
  assert.match(panel, /v-if="exportListError" class="app-state app-state-error compact-state"/)
  assert.match(panel, /v-else-if="exportListLoading && !exportMerges\.length"/)
  assert.match(panel, /@click="loadExportMerges\(true\)"/)
  // 段头“刷新”按钮是用户显式动作，必须走 initial=true（失败显示内联错误而非静默保留）
  assert.match(panel, /class="btn btn-sm ml-auto" @click="loadExportMerges\(true\)"/)
  // 面板挂载即走 initial 三态；主壳 refresh/拼接完成后以 listRev 令牌通知静默刷新；
  // 卸载置非激活，面板期间迟到响应不再写状态
  assert.match(panel, /onMounted\(\(\) => \{ setActive\(true\); loadExportMerges\(true\) \}\)/)
  assert.match(panel, /onUnmounted\(\(\) => setActive\(false\)\)/)
  assert.match(panel, /watch\(\(\) => props\.listRev, \(\) => loadExportMerges\(\)\)/)
  assert.match(ep, /exportListRev\.value\+\+/)
  // P2-B2 评审修复：勾选集合为页面级状态（切面板/重挂载不丢选择）——
  // 主壳持 exportSelectedIds + watch sbs 自动全选，组件受控渲染并以 update:selectedIds 上报
  assert.match(ep, /const exportSelectedIds = ref\(\[\]\)/)
  assert.match(ep, /const exportReadyIds = computed\(\(\) => sbs\.value\.filter\(s => hasVid\(s\)\)\.map\(s => s\.id\)\)/)
  assert.match(ep, /watch\(exportReadyIds, \(ids\) => \{/)
  assert.match(ep, /@update:selected-ids="onExportSelectedChange"/)
  assert.match(ep, /:selected-ids="exportSelectedIds"/)
  assert.match(panel, /selectedIds: \{ type: Array, default: \(\) => \[\] \}/)
  assert.match(panel, /emit\('update:selectedIds', next\)/)
  // 列表成功刷新后清除过时加载错误（对齐迁移前 doMerge 完成调 initial 刷新的语义）；
  // 该清理与“最新请求获胜/卸载作废”约束位于 useExportMergesList composable 内
  const hook = read('app/composables/useExportMergesList.ts')
  assert.match(hook, /if \(exportListError\.value\) exportListError\.value = ''/)
  // P1/P2 复审：分开维护「最新发起序号」与「最新成功提交序号」——只有更晚的成功才淘汰较早成功，
  // 失败的 silent 不得作废在途 initial（其成功照常落盘），错误/loading 只由最新 initial 决定者收尾
  assert.match(hook, /let issued = 0/)
  assert.match(hook, /let committed = 0/)
  assert.match(hook, /let lastInitialSeq = 0/)
  // P1/P2 复审2：最新 initial 也是决策屏障——更新的 initial 失败后，早于它的成功不得回写旧列表
  // 或清除新错误（success 与 catch 均拒绝 seq < committed 或 seq < lastInitialSeq）
  assert.match(hook, /if \(seq < committed \|\| seq < lastInitialSeq\) return/)
  assert.match(hook, /committed = seq/)
  assert.match(hook, /seq === lastInitialSeq/)
  // episodeId 以 getter 读「当前」值（P2：消除函数参数自比的恒假校验）
  assert.match(hook, /getEpisodeId: \(\) => number/)
  // P1/P2 复审2：剧集切换需清空上一集已展示数据——resetForEpisode 作废在途请求并清三态
  assert.match(hook, /function resetForEpisode\(\)/)
  assert.match(hook, /return \{ exportMerges, exportListLoading, exportListError, loadExportMerges, setActive, resetForEpisode \}/)
  // 组件传当前 episodeId getter，监听剧集切换：先 reset 清空上一集数据，id 有效再按新集 initial
  // （id=0 收敛为空闲空态），避免 ep2 响应前误显示/误操作 ep1 成片
  assert.match(panel, /useExportMergesList\([\s\S]*?, \(\) => props\.episodeId\)/)
  assert.match(panel, /watch\(\(\) => props\.episodeId, \(\) => \{[\s\S]*?resetForEpisode\(\)[\s\S]*?if \(props\.episodeId\) loadExportMerges\(true\)/)
})

test('residual silent loads get inline error + retry (drawer/picker/models/history)', () => {
  const ep = read('app/views/drama/episode.vue')
  // 任务抽屉：打开与手动刷新走 initial 三态，catch 写内联错误
  assert.match(ep, /const taskListLoading = ref\(false\)/)
  assert.match(ep, /const taskListError = ref\(''\)/)
  assert.match(ep, /openTaskDrawer\(\) \{\s*\n\s*taskDrawer\.value = true\s*\n\s*loadGenTasks\(true\)/)
  assert.match(ep, /@click="loadGenTasks\(true\)"/)
  assert.match(ep, /if \(initial\) taskListError\.value = e\.message \|\| '任务列表加载失败'/)
  assert.match(ep, /v-if="taskListError" class="task-drawer-body"/)
  assert.match(ep, /taskListLoading && !genTaskRows\.length/)
  // 参考素材选择器：失败内联错误 + 重试，不再回落误导空态
  assert.match(ep, /const refAssetLibraryError = ref\(''\)/)
  assert.match(ep, /refAssetLibraryError\.value = error\.message \|\| '素材库加载失败'/)
  assert.match(ep, /v-else-if="refAssetLibraryError" class="app-state app-state-error compact-state"/)
  assert.match(ep, /@click="loadRefAssetLibrary"/)
  // 顶栏模型配置：不再 console 静默，内联提示 + 重试
  assert.match(ep, /const configsLoading = ref\(false\)/)
  assert.match(ep, /const configsError = ref\(''\)/)
  assert.match(ep, /configsError\.value = e\.message \|\| '模型配置加载失败'/)
  assert.match(ep, /v-else-if="configsError" class="model-config-hint is-error"/)
  // 分镜历史视频：失败提示可重试，不再静默置空
  assert.match(ep, /const sbVideoHistoryError = ref\(''\)/)
  assert.match(ep, /sbVideoHistoryError\.value = e\.message \|\| '历史记录加载失败'/)
  assert.match(ep, /v-else-if="sbVideoHistoryError" class="video-player-history video-history-error"/)
  // 刷新失败保留上一份成功数据：catch 内不再清空历史（仅无分镜分支置空）
  assert.doesNotMatch(ep, /sbVideoHistory\.value = \[\][\s\S]{0,100}sbVideoHistoryError\.value = e\.message/)
  // 有数据的历史列表内也展示非破坏性错误/重试行
  assert.match(ep, /v-if="sbVideoHistory\.length" class="video-player-history"[\s\S]{0,600}v-if="sbVideoHistoryError" class="video-history-error-row"/)
  assert.match(ep, /历史记录刷新失败/)
})

test('detail plan reload surfaces failure inline instead of uncaught rejection', () => {
  const detail = read('app/views/drama/detail.vue')
  assert.match(detail, /const reloadPlanLoading = ref\(false\)/)
  assert.match(detail, /const episodePlanReloadError = ref\(''\)/)
  assert.match(detail, /catch \(error\) \{[\s\S]*?episodePlanReloadError\.value = error\.message \|\| '重新加载服务器版本失败'/)
  assert.match(detail, /v-if="episodePlanReloadError" class="episode-plan-reload-error"/)
  assert.match(detail, /:disabled="reloadPlanLoading"/)
})

test('episode assets (chars/scenes/props) load failure is inline + retry, not silent empty', () => {
  const ep = read('app/views/drama/episode.vue')
  // 统一入口 loadEpisodeAssets：分别捕获，任一失败汇总错误，保留旧数据不清空
  assert.match(ep, /const assetsLoadError = ref\(''\)/)
  assert.match(ep, /async function loadEpisodeAssets\(ep\) \{/)
  assert.match(ep, /assetsLoadError\.value = errors\.join\('；'\)/)
  // 失败且无任何资产时：显示「资产加载失败」错误态（不回落「开始提取资产」误导空态）
  assert.match(ep, /v-else-if="assetsLoadError && !chars\.length && !scenes\.length && !propItems\.length" class="app-state app-state-error compact-state"/)
  assert.match(ep, /@click="loadEpisodeAssets\(episode\)"/)
  // 有旧数据时刷新失败：非破坏性错误条 + 重试，保留已加载资产
  assert.match(ep, /v-if="assetsLoadError" class="video-history-error-row"/)
  // 旧的静默置空（catch 内 chars/scenes/props = []）已移除
  assert.doesNotMatch(ep, /catch \{\s*chars\.value = \[\]\s*\}/)
  assert.doesNotMatch(ep, /catch \{\s*scenes\.value = \[\]\s*\}/)
  assert.doesNotMatch(ep, /catch \{\s*propItems\.value = \[\]\s*\}/)
})

test('P1 token convergence: new semantic tokens exist and pages stop duplicating literals', () => {
  const css = read('app/assets/studio.css')
  const views = ['app/views/drama/episode.vue', 'app/views/drama/detail.vue', 'app/layouts/default.vue']
  for (const v of ['--success-strong', '--info-strong', '--warning-strong', '--fill-subtle', '--border-hover', '--error-outline', '--action-danger-hover-bg', '--overlay-mask', '--switch-track', '--scrollbar-thumb', '--scrollbar-thumb-hover']) {
    assert.match(css, new RegExp(`${v}:`))
  }
  // 页面引用 token，不再出现同值字面量（tag 强色 / 通用浅填充 / 遮罩）
  for (const f of views) {
    const src = read(f)
    assert.doesNotMatch(src, /#248a3d|#0b6b94|#c93400/)
    assert.doesNotMatch(src, /rgba\(0,0,0,0\.05\)|rgba\(0,0,0,0\.32\)/)
    assert.match(src, /var\(--fill-subtle\)|var\(--success-strong\)|var\(--overlay-mask\)/)
  }
  assert.match(read('app/components/MentionTextarea.vue'), /var\(--success-strong\)/)
  assert.match(read('app/components/ModelSelect.vue'), /var\(--border-hover\)/)
})
