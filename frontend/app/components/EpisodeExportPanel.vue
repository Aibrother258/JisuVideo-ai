<template>
  <!-- ===== EXPORT PANEL：拼接导出（成片列表 + 镜头素材勾选） =====
       组件职责：拼接导出面板 UI + 镜头选择 + 成片列表加载三态。
       主壳保留：doMerge/轮询/mergeError 等与全局 mergeData 纠缠的状态，
       经 props/emits 通信（@merge/@retry-merge 发起，@preview-merge 打开成片大预览）。 -->
  <div class="export-split">
    <div class="export-main">
      <!-- 拼接失败内联错误（P0-C3）：发起失败或后台轮询失败均在此呈现，支持一键重试 -->
      <div v-if="mergeError" class="app-state-inline app-state-error">
        <div class="app-state-icon"><CircleAlert :size="18" /></div>
        <div class="app-state-inline-body">
          <div class="app-state-title">拼接失败</div>
          <p class="app-state-desc">{{ mergeError }}</p>
        </div>
        <div class="app-state-inline-actions">
          <button class="btn btn-primary btn-sm" @click="emit('retry-merge')"><RefreshCw :size="12" /> 重试拼接</button>
          <button class="btn btn-ghost btn-sm" @click="emit('clear-merge-error')">关闭</button>
        </div>
      </div>
      <!-- 上方:成片列表 -->
      <div class="export-section">
        <div class="export-section-head">
          <span class="export-section-title">成片列表</span>
          <span class="dim" style="font-size:11px">{{ exportMerges.length }} 个</span>
          <button class="btn btn-sm ml-auto" @click="loadExportMerges(true)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            刷新
          </button>
        </div>
        <!-- 成片列表加载失败（内联错误 + 重试） -->
        <div v-if="exportListError" class="app-state app-state-error compact-state">
          <div class="app-state-icon"><CircleAlert :size="20" /></div>
          <div class="app-state-title">成片列表加载失败</div>
          <p class="app-state-desc">{{ exportListError }}</p>
          <button class="btn btn-primary btn-sm" @click="loadExportMerges(true)"><RefreshCw :size="12" /> 重试</button>
        </div>
        <!-- 首次加载骨架 -->
        <div v-else-if="exportListLoading && !exportMerges.length" class="export-merge-strip">
          <div class="app-skeleton-line" style="width:260px;height:150px;border-radius:12px"></div>
          <div class="app-skeleton-line" style="width:260px;height:150px;border-radius:12px"></div>
        </div>
        <div v-else-if="exportMerges.length" class="export-merge-strip">
          <div
            v-for="m in exportMerges"
            :key="m.id"
            :class="['merge-card', m.status === 'completed' && m.merged_url && 'playable']"
            :role="m.status === 'completed' && m.merged_url ? 'button' : undefined"
            :tabindex="m.status === 'completed' && m.merged_url ? 0 : undefined"
            @click="m.status === 'completed' && m.merged_url && emit('preview-merge', m)"
            @keydown.enter.prevent="m.status === 'completed' && m.merged_url && emit('preview-merge', m)"
          >
            <div class="merge-card-thumb">
              <video
                v-if="m.status === 'completed' && m.merged_url"
                :src="'/' + m.merged_url"
                :poster="posterOf('/' + m.merged_url) || undefined"
                preload="none"
                muted
                playsinline
                tabindex="-1"
              />
              <div v-else :class="['merge-card-pending', m.status === 'failed' && 'is-failed']">
                {{ m.status === 'failed' ? (m.error_msg || '拼接失败') : '拼接中…' }}
              </div>
              <span v-if="m.status === 'completed' && m.merged_url" class="merge-card-play">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg>
              </span>
            </div>
            <div class="merge-card-meta">
              <span class="mono">{{ formatHistoryTime(m.created_at) }}</span>
              <span v-if="m.duration">· {{ m.duration }}s</span>
              <a
                v-if="m.status === 'completed' && m.merged_url"
                :href="'/' + m.merged_url"
                download
                class="btn btn-sm"
                @click.stop
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                下载
              </a>
            </div>
          </div>
        </div>
        <div v-else class="export-merge-empty">暂无成片，在下方勾选镜头后点击「拼接所选」</div>
      </div>

      <!-- 下方:镜头素材(可勾选) -->
      <div class="export-section export-section-grow">
        <div class="export-section-head">
          <span class="export-section-title">镜头素材</span>
          <span class="dim" style="font-size:11px">{{ shotVidCount }}/{{ sbs.length }} 已生成 · 已选 {{ exportSelectedReadyIds.length }}</span>
          <div class="ml-auto flex gap-1">
            <button class="btn btn-sm" :disabled="!exportReadyIds.length" @click="toggleSelectAllExport">
              {{ exportSelectedReadyIds.length === exportReadyIds.length && exportReadyIds.length ? '清空选择' : '全选已生成' }}
            </button>
            <button
              class="btn btn-sm btn-primary"
              :disabled="!exportSelectedReadyIds.length"
              @click="emit('merge', exportSelectedReadyIds)"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              拼接所选 ({{ exportSelectedReadyIds.length }})
            </button>
          </div>
        </div>
        <div class="export-grid">
          <div
            v-for="(sb, i) in sbs"
            :key="sb.id"
            :class="['exp-card', { selected: isExportSelected(sb.id), playable: hasVid(sb) }]"
            :role="hasVid(sb) ? 'button' : undefined"
            :tabindex="hasVid(sb) ? 0 : undefined"
            @click="toggleExportSelect(sb)"
            @keydown.enter.prevent="toggleExportSelect(sb)"
          >
            <div class="exp-thumb">
              <video
                v-if="hasVid(sb)"
                :src="'/' + getVideoUrl(sb)"
                :poster="posterOf('/' + getVideoUrl(sb)) || undefined"
                preload="none"
                muted
                playsinline
                tabindex="-1"
              />
              <div v-else class="exp-thumb-empty">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <span class="exp-thumb-index">#{{ String(i+1).padStart(2,'0') }}</span>
              <span v-if="sb.duration" class="exp-thumb-duration">{{ sb.duration }}s</span>
              <span v-if="hasVid(sb)" :class="['exp-check', isExportSelected(sb.id) && 'on']">
                <svg v-if="isExportSelected(sb.id)" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
            </div>
            <div class="exp-row-line">
              <span class="truncate" style="flex:1;font-size:11px">{{ sb.description || sb.title || '—' }}</span>
              <span :class="['dot', hasVid(sb) && 'ok']" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RefreshCw, CircleAlert } from 'lucide-vue-next'
import { mergeAPI } from '~/composables/useApi'

const props = defineProps({
  sbs: { type: Array, required: true },
  episodeId: { type: Number, default: 0 },
  mergeError: { type: String, default: '' },
  // 主壳每次 refresh/拼接完成后自增，通知本面板静默刷新成片列表
  listRev: { type: Number, default: 0 },
})
const emit = defineEmits(['merge', 'retry-merge', 'clear-merge-error', 'preview-merge'])

// ===== 镜头素材:已生成判定（纯函数，随拆分下沉到面板组件） =====
function getVideoUrl(s) { return s?.video_url || s?.videoUrl || s?.composed_video_url || s?.composedVideoUrl || null }
function hasVid(s) { return !!getVideoUrl(s) }
const shotVidCount = computed(() => props.sbs.filter(s => s.video_url || s.videoUrl).length)
function formatHistoryTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ===== 拼接导出:镜头选择 + 成片列表 =====
const exportSelectedIds = ref([]) // 勾选的镜头 id
const exportMerges = ref([])      // 成片(拼接记录)列表
// 成片列表加载三态（P0-C3）：失败内联呈现而非静默空列表
const exportListLoading = ref(false)
const exportListError = ref('')
let exportSelTouched = false      // 用户手动操作过选择后,不再自动全选

const exportReadyIds = computed(() => props.sbs.filter(s => hasVid(s)).map(s => s.id))
const exportSelectedReadyIds = computed(() => exportSelectedIds.value.filter(id => exportReadyIds.value.includes(id)))

watch(exportReadyIds, (ids) => {
  if (exportSelTouched) {
    exportSelectedIds.value = exportSelectedIds.value.filter(id => ids.includes(id))
  } else {
    exportSelectedIds.value = [...ids]
  }
})

function isExportSelected(id) { return exportSelectedIds.value.includes(id) }
function toggleExportSelect(sb) {
  if (!hasVid(sb)) return
  exportSelTouched = true
  exportSelectedIds.value = isExportSelected(sb.id)
    ? exportSelectedIds.value.filter(x => x !== sb.id)
    : [...exportSelectedIds.value, sb.id]
}
function toggleSelectAllExport() {
  exportSelTouched = true
  exportSelectedIds.value = exportSelectedReadyIds.value.length === exportReadyIds.value.length ? [] : [...exportReadyIds.value]
}

async function loadExportMerges(initial = false) {
  if (!props.episodeId) return
  if (initial) { exportListLoading.value = true; exportListError.value = '' }
  try { exportMerges.value = await mergeAPI.list(props.episodeId) || [] }
  catch (e) {
    // 初始加载失败 -> 内联错误 + 重试；后台刷新失败保持旧列表不打扰
    if (initial) { exportListError.value = e.message || '成片列表加载失败'; return }
  } finally {
    if (initial) exportListLoading.value = false
  }
}

// 主壳 refresh / 拼接完成 -> 静默刷新（初始三态由 onMounted 承担，避免面板未挂载时空转）
watch(() => props.listRev, () => loadExportMerges())
onMounted(() => loadExportMerges(true))
</script>

<style scoped>
/* Export */
.export-split { flex: 1; display: flex; min-height: 0; }
.export-main { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; align-items: stretch; gap: 18px; padding: 16px 20px 24px; }
.export-section { display: flex; flex-direction: column; min-height: 0; }
.export-section-grow { flex: 1; }
.export-section-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.export-section-title { font-size: 13px; font-weight: 800; color: var(--text-0); }
.export-merge-strip { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; }
.merge-card {
  flex: 0 0 auto;
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: var(--radius);
  background: var(--surface-raised);
  border: 1px solid var(--border);
}
.merge-card video {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  background: var(--media-stage-bg);
  display: block;
}
.merge-card-pending {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border-radius: 6px;
  background: var(--surface-muted);
  color: var(--text-3);
  font-size: 11px;
  text-align: center;
}
.merge-card-pending.is-failed { color: var(--error); background: var(--error-bg); }
.merge-card-meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-3); min-width: 0; }
.merge-card-meta .btn { margin-left: auto; }
.merge-card.playable { cursor: pointer; }
.merge-card.playable:hover { border-color: var(--border-strong); box-shadow: var(--shadow-card); }
.merge-card-thumb { position: relative; }
.merge-card-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--media-scrim-soft);
  color: var(--text-invert);
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-out);
  pointer-events: none;
}
.merge-card.playable:hover .merge-card-play { opacity: 1; }
.export-merge-empty {
  padding: 14px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  color: var(--text-3);
  font-size: 12px;
  text-align: center;
}
.export-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.exp-card { display: flex; flex-direction: column; align-items: stretch; gap: 6px; padding: 8px; border-radius: var(--radius); background: var(--surface-raised); border: 1px solid var(--border); }
.exp-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-card); }
.exp-card.playable { cursor: pointer; }
.exp-card.selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
.exp-check {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1.5px solid var(--media-text);
  background: var(--media-scrim-soft);
  color: var(--text-invert);
}
.exp-check.on { background: var(--accent); border-color: var(--accent); }
.exp-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--surface-outline);
  border-radius: 6px;
  background: var(--media-stage-bg);
}
.exp-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
.exp-thumb-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-3); }
.exp-thumb-index {
  position: absolute;
  left: 5px;
  top: 5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--media-scrim);
  color: var(--text-invert);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
}
.exp-thumb-duration {
  position: absolute;
  right: 5px;
  bottom: 5px;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--media-scrim-strong);
  color: var(--text-invert);
  font-family: var(--font-mono);
  font-size: 9px;
}
.exp-row-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.exp-row-line .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--bg-3); flex-shrink: 0; }
.exp-row-line .dot.ok { background: var(--success); }

@media (max-width: 1080px) {
  .export-split {
    flex-direction: column;
  }
}
</style>
