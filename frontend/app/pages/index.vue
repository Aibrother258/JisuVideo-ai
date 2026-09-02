<template>
  <div class="page">
    <div class="home-top">
      <h1 class="home-title">项目启动台</h1>
      <div class="home-stats" aria-label="项目统计">
        <span class="home-stat"><i class="dot is-blue"></i>{{ dramas.length }} 个项目</span>
        <span class="home-stat"><i class="dot is-green"></i>{{ statActive }} 进行中</span>
        <span class="home-stat"><i class="dot is-gray"></i>{{ statDraft }} 待开始</span>
      </div>
      <button class="btn btn-primary home-new" @click="openCreateDialog">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        新建项目
      </button>
    </div>

    <div class="ws-grid">
      <main class="ws-main">
    <div class="toolbar">
      <label class="search-box">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input v-model.trim="searchKeyword" class="input" placeholder="搜索项目" />
      </label>
      <div class="chip-row">
        <button
          v-for="f in filters"
          :key="f.value"
          type="button"
          class="filter-chip"
          :class="{ on: statusFilter === f.value }"
          @click="statusFilter = f.value"
        >
          {{ f.label }}
        </button>
      </div>
      <select v-model="sortMode" class="input sort-select" aria-label="项目排序">
        <option value="updated">最近更新</option>
        <option value="title">项目名称</option>
      </select>
    </div>

    <div v-if="loadError" class="app-state app-state-error">
      <div class="app-state-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="app-state-title">项目加载失败</div>
      <p class="app-state-desc">{{ loadError }}</p>
      <button class="btn btn-primary" @click="load()"><RefreshCw :size="13" /> 重试</button>
    </div>
    <div v-else-if="loading" class="project-grid">
      <div v-for="i in 6" :key="i" class="card skeleton-card">
        <div class="skeleton-cover"></div>
        <div class="skeleton-body">
          <div class="skeleton-line w-60"></div>
          <div class="skeleton-line w-40"></div>
        </div>
      </div>
    </div>

    <div v-else-if="filteredDramas.length" class="project-grid">
      <article
        v-for="(d, i) in filteredDramas"
        :key="d.id"
        class="card project-card"
        :style="{ animationDelay: `${i * 0.04}s` }"
        tabindex="0"
        role="button"
        :aria-label="`打开项目 ${d.title}`"
        @click="openDrama(d)"
        @keydown.enter.prevent="openDrama(d)"
        @keydown.space.prevent="openDrama(d)"
      >
        <div class="project-thumb" aria-hidden="true" :style="coverStyle(d.style)">
          <Film v-if="!coverGradient(d.style)" class="cover-film" :size="34" :stroke-width="1.4" />
          <div v-else class="cover-glyph">{{ coverGlyph(d.title) }}</div>
          <span v-if="coverGradient(d.style) && styleLabel(d.style)" class="cover-style-name">{{ styleLabel(d.style) }}</span>
          <div class="status-wrap" @click.stop>
            <button type="button" class="cover-badge tag status-badge" title="点击标记项目状态" @click="statusMenuId = statusMenuId === d.id ? null : d.id">
              <span class="status-dot" :class="statusDotClass(d)"></span>
              {{ projectStatus(d) }}
            </button>
            <div v-if="statusMenuId === d.id" class="more-menu status-menu">
              <button
                v-for="s in statusOptions"
                :key="s.value"
                type="button"
                class="menu-item"
                :class="{ on: currentStatus(d) === s.value }"
                @click="setDramaStatus(d, s.value)"
              >{{ s.label }}</button>
            </div>
          </div>
          <div class="more-wrap">
            <button class="btn btn-icon btn-sm cover-more" type="button" title="更多" @click.stop="toggleMenu(d.id)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>
              </svg>
            </button>
            <div v-if="activeMenuId === d.id" class="more-menu" @click.stop>
              <button type="button" class="menu-item" @click="openDrama(d)">打开项目</button>
              <button type="button" class="menu-item is-danger" @click="activeMenuId = null; dramaToDelete = d">删除项目</button>
            </div>
          </div>
        </div>
        <div class="project-body">
          <h2 class="project-name truncate">{{ d.title }}</h2>
          <div class="project-meta">
            <span v-if="d.style" class="tag tag-accent">{{ styleLabel(d.style) }}</span>
            <span>{{ d.character_count || 0 }} 角色 · {{ d.scene_count || 0 }} 场景 · {{ d.total_episodes || 0 }} 集</span>
          </div>
          <div class="project-foot">
            <span class="updated">
              <Clock :size="11" :stroke-width="1.8" />
              {{ fmtDate(d.updated_at || d.updatedAt) }}
            </span>
            <button
              v-if="continueEpisodeNumber(d)"
              type="button"
              class="go-episode"
              @click.stop="openEpisode(d, continueEpisodeNumber(d))"
            >继续 → 第 {{ continueEpisodeNumber(d) }} 集</button>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      </div>
      <p class="empty-title">{{ dramas.length ? '没有匹配的项目' : '新建第一个短剧项目' }}</p>
      <p class="empty-desc">{{ dramas.length ? '调整搜索词或筛选条件。' : '创建后选择集开始制作。' }}</p>
      <button v-if="!dramas.length" class="btn btn-primary" @click="openCreateDialog">新建项目</button>
    </div>
    </main>

    <!-- 侧栏：继续上次 / 制作进度 / 风格灵感 -->
    <aside v-if="showRail" class="ws-rail">
      <section class="card rail-card">
        <div class="rail-head">
          <span class="rail-title">继续上次制作</span>
          <span class="rail-hint">最近更新</span>
        </div>
        <div v-if="resumeDrama" class="rail-body">
          <div class="resume-row">
            <div class="resume-thumb" aria-hidden="true" :style="coverStyle(resumeDrama.style)">
              <Film v-if="!coverGradient(resumeDrama.style)" :size="20" :stroke-width="1.5" />
              <span v-else>{{ coverGlyph(resumeDrama.title) }}</span>
            </div>
            <div class="resume-main">
              <div class="resume-title truncate">{{ resumeDrama.title }}</div>
              <div class="resume-sub">
                {{ styleLabel(resumeDrama.style) || '未定风格' }}
                <span class="status-dot-mini" :class="statusDotClass(resumeDrama)"></span>{{ projectStatus(resumeDrama) }}
              </div>
              <button v-if="continueEpisodeNumber(resumeDrama)" class="btn btn-primary btn-sm resume-go" @click="openEpisode(resumeDrama, continueEpisodeNumber(resumeDrama))">
                继续第 {{ continueEpisodeNumber(resumeDrama) }} 集
              </button>
              <button v-else class="btn btn-primary btn-sm resume-go" @click="openDrama(resumeDrama)">打开项目</button>
            </div>
          </div>
        </div>
        <div v-else class="rail-body">
          <p class="rail-empty">还没有进行中的项目，点「新建项目」开一部。</p>
        </div>
      </section>

      <section class="card rail-card">
        <div class="rail-head">
          <span class="rail-title">制作概况</span>
          <span class="rail-hint">跨项目资产合计</span>
        </div>
        <div class="rail-body">
          <div class="stat-grid">
            <div v-for="s in railStats" :key="s.label" class="stat-cell">
              <b>{{ s.value }}</b><span>{{ s.label }}</span>
            </div>
          </div>
          <div class="rail-foot-note">进行中 {{ statActive }} · 待开始 {{ statDraft }} · 已完成 {{ statDone }}</div>
        </div>
      </section>

      <section class="card rail-card">
        <div class="rail-head">
          <span class="rail-title">风格灵感</span>
          <button type="button" class="rail-action" @click="openCreateDialog">＋ 新建</button>
        </div>
        <div class="rail-body style-rail-body">
          <div v-if="stylePresets.length" class="style-grid">
            <button
              v-for="(p, i) in stylePresets.slice(0, 6)"
              :key="p.value"
              type="button"
              class="style-swatch"
              :style="coverStyle(p.value)"
              :title="`用「${p.name}」风格新建项目`"
              @click="openCreateWithStyle(p, i)"
            >
              <span class="style-swatch-name">{{ p.name }}</span>
            </button>
          </div>
          <p v-else class="rail-empty">暂无风格预设，去设置页添加。</p>
        </div>
      </section>
    </aside>
    </div>
  </div>

  <div v-if="showCreate" class="overlay" @click.self="closeCreateDialog">
      <div class="dialog create-dialog">
        <div class="dialog-head">
          <div class="modal-icon">
            <Sparkles :size="19" :stroke-width="1.8" />
          </div>
          <div class="dialog-head-copy">
            <h2 class="dialog-title">{{ createStep === 'source' ? '从内容创建项目' : '选择项目方案' }}</h2>
            <p class="dialog-desc">{{ createStep === 'source' ? '粘贴、上传文件或读取小说链接，AI 帮你提炼项目设置' : 'AI 已给出候选，你可以自由选择和修改' }}</p>
          </div>
          <div class="step-indicator" aria-label="创建进度">
            <span :class="{ on: createStep === 'source' }">1</span>
            <i></i>
            <span :class="{ on: createStep === 'plan' }">2</span>
          </div>
        </div>
        <div v-if="createStep === 'source'" class="dialog-form">
          <div class="dialog-body source-step">
            <div class="source-intro">
              <FileText :size="19" :stroke-width="1.7" />
              <div>
                <strong>先给 AI 看原始内容</strong>
                <p>可直接粘贴，也可导入 TXT、MD 文件或公开小说链接；原文会随项目保存。</p>
              </div>
            </div>
            <div class="source-methods" aria-label="内容导入方式">
              <button
                v-for="method in sourceMethods"
                :key="method.value"
                type="button"
                :class="['source-method', { on: sourceMode === method.value }]"
                @click="sourceMode = method.value"
              >
                <component :is="method.icon" :size="14" :stroke-width="1.8" />
                {{ method.label }}
              </button>
            </div>

            <div v-if="sourceMode === 'file'" class="source-import-panel" @dragover.prevent @drop.prevent="handleFileDrop">
              <input ref="sourceFileInput" type="file" accept=".txt,.md,text/plain,text/markdown" hidden @change="handleSourceFile" />
              <Upload :size="20" :stroke-width="1.6" />
              <div>
                <strong>{{ importedSourceName || '选择 TXT 或 Markdown 文件' }}</strong>
                <span>支持 .txt、.md，正文最多 20 万字，也可以把文件拖到这里</span>
              </div>
              <button type="button" class="btn btn-sm" @click="sourceFileInput?.click()">选择文件</button>
            </div>

            <div v-else-if="sourceMode === 'url'" class="source-url-panel">
              <label class="field">
                <span class="field-label">公开小说链接</span>
                <div class="source-url-row">
                  <input v-model.trim="sourceUrl" class="input" type="url" placeholder="https://example.com/novel/chapter" @keydown.enter.prevent="importSourceUrl" />
                  <button type="button" class="btn" :disabled="!sourceUrl || importingUrl" @click="importSourceUrl">
                    <span v-if="importingUrl" class="spinner-sm"></span>
                    <Link v-else :size="14" :stroke-width="1.8" />
                    {{ importingUrl ? '读取中…' : '读取正文' }}
                  </button>
                </div>
                <span class="field-hint">仅读取公开网页正文；需要登录、动态加载或有反爬限制的页面请改用文件导入。</span>
              </label>
            </div>

            <label class="field source-field">
              <span class="field-label">
                {{ sourceMode === 'paste' ? '小说、短文或故事内容' : '导入后的全文内容（可继续修改）' }}
                <span class="required">*</span>
              </span>
              <textarea
                v-model="sourceContent"
                class="input source-textarea"
                placeholder="在这里粘贴小说章节、故事梗概、短文，或直接写下你的创意……"
                maxlength="200000"
                autofocus
              ></textarea>
              <span class="source-count" :class="{ ready: sourceContent.trim().length >= 20 }">
                {{ sourceContent.trim().length.toLocaleString() }} 字<span v-if="sourceContent.trim().length < 20"> · 至少 20 字</span>
              </span>
            </label>
            <div class="analysis-note">
              <Sparkles :size="14" :stroke-width="1.8" />
              AI 将生成 4 个名称候选、3 个全文匹配风格，并推荐适合的画面比例。
            </div>
          </div>
          <div class="dialog-foot">
            <button type="button" class="btn" @click="closeCreateDialog">取消</button>
            <button type="button" class="btn btn-primary" :disabled="sourceContent.trim().length < 20 || analyzing" @click="analyzeSource">
              <span v-if="analyzing" class="spinner-sm"></span>
              <Sparkles v-else :size="14" :stroke-width="1.9" />
              {{ analyzing ? '正在提炼方案…' : 'AI 提炼项目方案' }}
            </button>
          </div>
        </div>

        <form v-else class="dialog-form" @submit.prevent="create">
          <div class="dialog-body plan-step">
            <section v-if="analysis?.summary" class="plan-summary">
              <span class="section-kicker">内容理解</span>
              <p>{{ analysis.summary }}</p>
            </section>

            <section class="plan-section">
              <div class="section-headline">
                <div><span class="section-index">01</span><strong>项目名称</strong></div>
                <span>选择候选后仍可修改</span>
              </div>
              <div class="title-candidates">
                <button
                  v-for="item in analysis?.titles || []"
                  :key="item.title"
                  type="button"
                  class="choice-card title-choice"
                  :class="{ selected: form.title === item.title }"
                  @click="form.title = item.title"
                >
                  <Check v-if="form.title === item.title" class="choice-check" :size="15" :stroke-width="2.3" />
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.reason || '贴合原文主题' }}</span>
                </button>
              </div>
              <label class="field compact-field">
                <span class="field-label">最终项目名称</span>
                <input v-model.trim="form.title" class="input" placeholder="输入或修改项目名称" required />
              </label>
            </section>

            <section class="plan-section">
              <div class="section-headline">
                <div><span class="section-index">02</span><strong>视觉风格</strong></div>
                <button type="button" class="btn btn-sm style-ai-btn" :disabled="analyzingStyles" @click="analyzeThreeStyles">
                  <span v-if="analyzingStyles" class="spinner-sm"></span>
                  <Sparkles v-else :size="12" :stroke-width="1.8" />
                  {{ analyzingStyles ? '匹配中…' : '根据全文 AI 匹配 3 个风格' }}
                </button>
              </div>
              <div class="style-candidates">
                <button
                  v-for="item in analysis?.style_candidates || []"
                  :key="`${item.source}-${item.value}`"
                  type="button"
                  class="choice-card style-choice"
                  :class="{ selected: !customStyleActive && form.style === item.value }"
                  @click="selectStyle(item)"
                >
                  <div class="choice-topline">
                    <span :class="['source-badge', item.source === 'new' ? 'is-new' : 'is-existing']">
                      {{ item.source === 'new' ? '新风格' : '已有风格' }}
                    </span>
                    <Check v-if="form.style === item.value" :size="15" :stroke-width="2.3" />
                  </div>
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.reason || item.description }}</span>
                </button>
              </div>
              <div class="existing-style-picker">
                <span>或从全部已有风格中选择</span>
                <div class="existing-style-controls">
                  <BaseSelect v-model="existingStyleValue" :options="styleSelectOptions" placeholder="选择已有风格" searchable />
                  <button type="button" :class="['btn', 'btn-sm', { 'is-active': customStyleActive }]" @click="toggleCustomStyle">
                    <Palette :size="13" :stroke-width="1.8" />
                    自定义风格
                  </button>
                </div>
              </div>
              <div v-if="customStyleActive" class="custom-style-panel">
                <div class="custom-style-grid">
                  <label class="field">
                    <span class="field-label">自定义风格名称</span>
                    <input v-model.trim="customStyle.name" class="input" placeholder="例如：冷峻都市纪实" />
                  </label>
                  <label class="field">
                    <span class="field-label">风格描述 / 提示词</span>
                    <input v-model.trim="customStyle.prompt" class="input" placeholder="描述色彩、光线、材质、镜头与时代感" />
                  </label>
                </div>
                <span class="field-hint">创建项目时会同时保存为新的风格预设，后续项目可直接复用。</span>
              </div>
              <div v-else-if="selectedStyleCandidate?.source === 'new'" class="new-style-confirm">
                <div class="new-style-copy">
                  <Palette :size="17" :stroke-width="1.8" />
                  <div>
                    <strong>这是一种新的视觉风格</strong>
                    <p>{{ selectedStyleCandidate.description || '将按当前故事定制风格提示词，并保存到风格预设库。' }}</p>
                  </div>
                </div>
                <label class="confirm-check">
                  <input v-model="confirmNewStyle" type="checkbox" />
                  <span>确认创建“{{ selectedStyleCandidate.name }}”并加入风格预设库</span>
                </label>
              </div>
            </section>

            <section class="plan-section">
              <div class="section-headline">
                <div><span class="section-index">03</span><strong>画面比例</strong></div>
                <span>创建后项目内统一使用</span>
              </div>
              <div class="ratio-candidates">
                <button
                  v-for="item in analysis?.aspect_ratios || []"
                  :key="item.value"
                  type="button"
                  class="choice-card ratio-choice"
                  :class="{ selected: form.aspect_ratio === item.value }"
                  @click="form.aspect_ratio = item.value"
                >
                  <component :is="ratioIcon(item.value)" :size="21" :stroke-width="1.6" />
                  <div><strong>{{ item.value }} · {{ item.label }}</strong><span>{{ item.reason }}</span></div>
                  <Check v-if="form.aspect_ratio === item.value" :size="15" :stroke-width="2.3" />
                </button>
              </div>
            </section>
          </div>
          <div class="dialog-foot plan-foot">
            <button type="button" class="btn" @click="createStep = 'source'">返回修改原文</button>
            <button type="button" class="btn" :disabled="analyzing" @click="analyzeSource">
              <RefreshCw :size="13" :stroke-width="1.9" />
              重新提炼
            </button>
            <button type="submit" class="btn btn-primary" :disabled="!canCreate || creatingProject">
              <span v-if="creatingProject" class="spinner-sm"></span>
              <Check v-else :size="14" :stroke-width="2.2" />
              {{ creatingProject ? '正在创建…' : '确认并创建项目' }}
            </button>
          </div>
        </form>
      </div>
    </div>

  <ConfirmDialog
    :open="!!dramaToDelete"
    title="删除项目"
    :message="`确定删除「${dramaToDelete?.title}」？项目下的剧集、分镜与生成记录将一并删除，此操作不可恢复。`"
    :loading="deletingDrama"
    @confirm="confirmDelDrama"
    @cancel="dramaToDelete = null"
  />
</template>

<script setup>
import { toast } from 'vue-sonner'
import { Film, Clock, Sparkles, FileText, Monitor, Smartphone, Square, Check, RefreshCw, Palette, Upload, Link, ClipboardPaste } from 'lucide-vue-next'
import { dramaAPI, stylePresetAPI } from '~/composables/useApi'
import BaseSelect from '~/components/BaseSelect.vue'

const dramas = ref([])
const loading = ref(false)
const loadError = ref('')
const showCreate = ref(false)
const searchKeyword = ref('')
const statusFilter = ref('all')
const sortMode = ref('updated')
const activeMenuId = ref(null)
const dramaToDelete = ref(null)
const deletingDrama = ref(false)
const form = ref({ title: '', style: '', aspect_ratio: '16:9' })
const createStep = ref('source')
const sourceContent = ref('')
const sourceMode = ref('paste')
const sourceUrl = ref('')
const sourceFileInput = ref(null)
const importedSourceName = ref('')
const importedSourceUrl = ref('')
const importingUrl = ref(false)
const analysis = ref(null)
const analyzing = ref(false)
const analyzingStyles = ref(false)
const creatingProject = ref(false)
const confirmNewStyle = ref(false)
const customStyleActive = ref(false)
const customStyle = reactive({ name: '', prompt: '' })
const stylePresets = ref([])
// 「风格灵感」点击后锁定的预设：粘贴内容完成 AI 提炼时优先采用该风格
const inspirationStyle = ref(null)
const sourceMethods = [
  { label: '粘贴内容', value: 'paste', icon: ClipboardPaste },
  { label: '上传 TXT / MD', value: 'file', icon: Upload },
  { label: '小说链接', value: 'url', icon: Link },
]
const styleSelectOptions = computed(() => stylePresets.value.map(p => ({ label: p.name, value: p.value })))
const selectedStyleCandidate = computed(() => {
  if (customStyleActive.value) {
    return { source: 'custom', name: customStyle.name, prompt: customStyle.prompt, description: customStyle.prompt, value: '__custom__' }
  }
  const suggested = analysis.value?.style_candidates?.find(item => item.value === form.value.style)
  if (suggested) return suggested
  const preset = stylePresets.value.find(item => item.value === form.value.style)
  return preset ? { ...preset, source: 'existing' } : null
})
const existingStyleValue = computed({
  get: () => selectedStyleCandidate.value?.source === 'existing' ? form.value.style : '',
  set: (value) => {
    if (!value) return
    customStyleActive.value = false
    form.value.style = value
    confirmNewStyle.value = false
  },
})
const canCreate = computed(() => {
  if (!form.value.title?.trim() || !form.value.style || !form.value.aspect_ratio) return false
  if (selectedStyleCandidate.value?.source === 'custom') return !!customStyle.name.trim() && !!customStyle.prompt.trim()
  return selectedStyleCandidate.value?.source !== 'new' || confirmNewStyle.value
})
const filters = [
  { label: '全部', value: 'all' },
  { label: '待开始', value: 'draft' },
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' },
]
// 项目状态由用户手动标记（持久化到 dramas.status），不再按内容自动推算
const statusOptions = [
  { label: '待开始', value: 'draft' },
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' },
]
const statusMenuId = ref(null)

function currentStatus(d) { return d.status || 'draft' }
function projectStatus(d) { return statusOptions.find(s => s.value === currentStatus(d))?.label || '待开始' }
function statusDotClass(d) { return currentStatus(d) === 'active' ? 'on' : currentStatus(d) === 'completed' ? 'done' : '' }

async function setDramaStatus(d, status) {
  statusMenuId.value = null
  if (currentStatus(d) === status) return
  const prev = d.status
  d.status = status
  try {
    await dramaAPI.update(d.id, { status })
  } catch (e) {
    d.status = prev
    toast.error(e.message)
  }
}

// —— 工作台统计：全部来自真实列表数据 ——
const statActive = computed(() => dramas.value.filter(d => currentStatus(d) === 'active').length)
const statDraft = computed(() => dramas.value.filter(d => currentStatus(d) === 'draft').length)
const statDone = computed(() => dramas.value.filter(d => currentStatus(d) === 'completed').length)

function dramaUpdatedAt(d) {
  return new Date(d.updated_at || d.updatedAt || 0).getTime() || 0
}

// 侧栏「继续上次制作」：最近更新且未完成的项目（全部完成时才退回最近更新的项目）
const resumeDrama = computed(() => {
  if (!dramas.value.length) return null
  const sorted = [...dramas.value].sort((a, b) => dramaUpdatedAt(b) - dramaUpdatedAt(a))
  return sorted.find(d => currentStatus(d) !== 'completed') || sorted[0]
})

const showRail = computed(() => !loading.value && !loadError.value && (dramas.value.length > 0 || stylePresets.value.length > 0))

// 侧栏「制作概况」：跨项目资产合计（集 / 角色 / 场景）
const railStats = computed(() => {
  const sum = (key) => dramas.value.reduce((acc, d) => acc + (Number(d[key]) || 0), 0)
  return [
    { label: '剧集总数', value: sum('total_episodes') },
    { label: '角色合计', value: sum('character_count') },
    { label: '场景合计', value: sum('scene_count') },
  ]
})

function styleLabel(key) {
  return stylePresets.value.find(p => p.value === key)?.name || key || ''
}

// —— 封面色卡：按风格 key 映射渐变；未知/自定义 key 用哈希取兜底色，不依赖任何假数据 ——
const COVER_GRADIENTS = {
  '3d': 'linear-gradient(135deg, #4f46e5 0%, #0ea5e9 55%, #22d3ee 100%)',
  'anime': 'linear-gradient(135deg, #a855f7 0%, #ec4899 60%, #f43f5e 100%)',
  'ghibli': 'linear-gradient(135deg, #16a34a 0%, #22c55e 55%, #84cc16 100%)',
  'watercolor': 'linear-gradient(135deg, #f472b6 0%, #e879f9 55%, #818cf8 100%)',
  'comic': 'linear-gradient(135deg, #f97316 0%, #ef4444 55%, #e11d48 100%)',
}
const COVER_FALLBACK = [
  'linear-gradient(135deg, #0f2027 0%, #203a43 55%, #2c5364 100%)',
  'linear-gradient(135deg, #42275a 0%, #734b6d 100%)',
  'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)',
  'linear-gradient(135deg, #355c7d 0%, #6c5b7b 55%, #c06c84 100%)',
  'linear-gradient(135deg, #1f4037 0%, #377d63 100%)',
  'linear-gradient(135deg, #283c86 0%, #3f6ed8 100%)',
  'linear-gradient(135deg, #5f2c82 0%, #49a09d 100%)',
  'linear-gradient(135deg, #141e30 0%, #35577d 100%)',
]
function hashStyleKey(key) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h
}
function coverGradient(style) {
  return !!String(style || '').trim()
}
function coverStyle(style) {
  const key = String(style || '').trim()
  if (!key) return {}
  const named = COVER_GRADIENTS[key]
  return { background: named || COVER_FALLBACK[hashStyleKey(key) % COVER_FALLBACK.length] }
}
function coverGlyph(title) {
  const text = String(title || '').trim()
  if (!text) return '剧'
  return Array.from(text)[0]
}

const filteredDramas = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const items = dramas.value.filter((d) => {
    const text = [d.title, d.style, styleLabel(d.style), projectStatus(d)].filter(Boolean).join(' ').toLowerCase()
    const matchesSearch = !keyword || text.includes(keyword)
    const matchesStatus = statusFilter.value === 'all' || currentStatus(d) === statusFilter.value
    return matchesSearch && matchesStatus
  })

  return [...items].sort((a, b) => {
    if (sortMode.value === 'title') return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN')
    return new Date(b.updated_at || b.updatedAt || 0).getTime() - new Date(a.updated_at || a.updatedAt || 0).getTime()
  })
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [res, presets] = await Promise.all([dramaAPI.list(), stylePresetAPI.list()])
    dramas.value = res.items || []
    stylePresets.value = presets || []
  } catch (e) {
    loadError.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  form.value = { title: '', style: '', aspect_ratio: '16:9' }
  createStep.value = 'source'
  sourceContent.value = ''
  sourceMode.value = 'paste'
  sourceUrl.value = ''
  importedSourceName.value = ''
  importedSourceUrl.value = ''
  analysis.value = null
  inspirationStyle.value = null
  confirmNewStyle.value = false
  customStyleActive.value = false
  customStyle.name = ''
  customStyle.prompt = ''
  showCreate.value = true
}

// 点击「风格灵感」色板：预选该预设，粘贴原文完成 AI 提炼后默认采用它
function openCreateWithStyle(preset) {
  if (!preset?.value) return
  openCreateDialog()
  inspirationStyle.value = preset
  toast.success(`已预选风格「${preset.name}」，提炼方案后默认采用，仍可手动修改`)
}

function closeCreateDialog() {
  if (analyzing.value || analyzingStyles.value || importingUrl.value || creatingProject.value) return
  showCreate.value = false
}

async function importLocalSourceFile(file) {
  const ext = String(file?.name || '').toLowerCase().match(/\.[^.]+$/)?.[0]
  if (!['.txt', '.md'].includes(ext)) {
    toast.error('仅支持 TXT 或 Markdown 文件')
    return
  }
  if (file.size > 6 * 1024 * 1024) {
    toast.error('文件不能超过 6MB')
    return
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    let content = new TextDecoder('utf-8').decode(bytes)
    const invalidRatio = (content.match(/�/g)?.length || 0) / Math.max(1, content.length)
    if (invalidRatio > 0.001) {
      try { content = new TextDecoder('gb18030').decode(bytes) } catch { /* 保留 UTF-8 解码结果 */ }
    }
    content = content.replace(/^\uFEFF/, '').trim()
    if (content.length < 20) throw new Error('文件正文太短，请至少提供 20 个字')
    if (content.length > 200_000) throw new Error('文件正文超过 20 万字，请先分段或精简')
    sourceContent.value = content
    importedSourceName.value = file.name
    importedSourceUrl.value = ''
    sourceMode.value = 'file'
    toast.success(`已导入 ${file.name}`)
  } catch (e) {
    toast.error(e.message || '文件读取失败')
  }
}

function handleSourceFile(event) {
  const file = event.target?.files?.[0]
  if (file) importLocalSourceFile(file)
  if (event.target) event.target.value = ''
}

function handleFileDrop(event) {
  const file = event.dataTransfer?.files?.[0]
  if (file) importLocalSourceFile(file)
}

async function importSourceUrl() {
  if (!sourceUrl.value || importingUrl.value) return
  try {
    importingUrl.value = true
    const result = await dramaAPI.importSource(sourceUrl.value)
    sourceContent.value = result.content || ''
    importedSourceName.value = result.title || '已读取小说网页'
    importedSourceUrl.value = result.source_url || sourceUrl.value
    toast.success('小说正文读取成功，可继续修改后交给 AI 分析')
  } catch (e) {
    toast.error(e.message)
  } finally {
    importingUrl.value = false
  }
}

function ratioIcon(value) {
  if (value === '9:16') return Smartphone
  if (value === '1:1') return Square
  return Monitor
}

function selectStyle(item) {
  customStyleActive.value = false
  form.value.style = item.value
  confirmNewStyle.value = false
}

function toggleCustomStyle() {
  customStyleActive.value = !customStyleActive.value
  if (customStyleActive.value) {
    form.value.style = '__custom__'
    confirmNewStyle.value = false
  } else {
    form.value.style = analysis.value?.style_candidates?.[0]?.value || stylePresets.value[0]?.value || ''
  }
}

async function analyzeSource() {
  if (sourceContent.value.trim().length < 20 || analyzing.value) return
  try {
    analyzing.value = true
    const result = await dramaAPI.analyzeSource(sourceContent.value.trim())
    form.value.title = result.titles?.[0]?.title || ''
    // 「风格灵感」锁定的风格优先采用；否则跟随 AI 推荐
    const locked = inspirationStyle.value
    if (locked && stylePresets.value.some(s => s.value === locked.value)) {
      const alreadySuggested = (result.style_candidates || []).some(item => item.value === locked.value)
      analysis.value = alreadySuggested
        ? result
        : {
            ...result,
            style_candidates: [
              { value: locked.value, name: locked.name, description: locked.description, reason: '你选择的灵感风格，已默认采用', source: 'existing' },
              ...(result.style_candidates || []),
            ],
          }
      form.value.style = locked.value
    } else {
      analysis.value = result
      const recommendedStyle = result.style_candidates?.find(item => item.recommended) || result.style_candidates?.[0]
      form.value.style = recommendedStyle?.value || stylePresets.value[0]?.value || ''
    }
    const recommendedRatio = result.aspect_ratios?.find(item => item.recommended) || result.aspect_ratios?.[0]
    form.value.aspect_ratio = recommendedRatio?.value || '9:16'
    confirmNewStyle.value = false
    customStyleActive.value = false
    createStep.value = 'plan'
  } catch (e) {
    toast.error(e.message)
  } finally {
    analyzing.value = false
  }
}

async function analyzeThreeStyles() {
  if (sourceContent.value.trim().length < 20 || analyzingStyles.value) return
  try {
    analyzingStyles.value = true
    const result = await dramaAPI.analyzeSource(sourceContent.value.trim())
    analysis.value = { ...analysis.value, style_candidates: result.style_candidates || [] }
    const first = result.style_candidates?.[0]
    if (first) {
      inspirationStyle.value = null // 用户主动要求 AI 重匹配，放弃灵感锁定的默认风格
      selectStyle(first)
    }
    toast.success('已根据全文重新匹配 3 个视觉风格')
  } catch (e) {
    toast.error(e.message)
  } finally {
    analyzingStyles.value = false
  }
}

async function create() {
  if (!canCreate.value || creatingProject.value) return
  try {
    creatingProject.value = true
    const selected = selectedStyleCandidate.value
    if (selected?.source === 'new' || selected?.source === 'custom') {
      const createdStyle = await stylePresetAPI.create({
        name: selected.name,
        value: selected.source === 'custom' ? `custom-${Date.now().toString(36)}` : selected.value,
        prompt: selected.prompt,
        description: selected.description || selected.reason,
        sort_order: stylePresets.value.length + 1,
      })
      stylePresets.value.push(createdStyle)
      form.value.style = createdStyle.value
      customStyleActive.value = false
      // 风格已成功写入后立即视为“已有”，即使后续项目创建失败，重试也不会重复建同名预设。
      selected.source = 'existing'
      selected.preset_id = createdStyle.id
      confirmNewStyle.value = false
    }
    const d = await dramaAPI.create({
      ...form.value,
      title: form.value.title.trim(),
      description: sourceContent.value.trim(),
      metadata: JSON.stringify({
        source_type: sourceMode.value,
        source_name: importedSourceName.value || undefined,
        source_url: importedSourceUrl.value || undefined,
        created_via: 'ai_project_planner',
      }),
    })
    showCreate.value = false
    navigateTo(`/drama/${d.id}`)
  } catch (e) {
    toast.error(e.message)
  } finally {
    creatingProject.value = false
  }
}

async function confirmDelDrama() {
  const d = dramaToDelete.value
  if (!d) return
  try {
    deletingDrama.value = true
    await dramaAPI.del(d.id)
    toast.success('已删除')
    dramaToDelete.value = null
    load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    deletingDrama.value = false
  }
}

function toggleMenu(id) {
  activeMenuId.value = activeMenuId.value === id ? null : id
}

function getDramaPath(d) {
  return `/drama/${d.id}`
}

function openDrama(d) {
  activeMenuId.value = null
  statusMenuId.value = null
  navigateTo(getDramaPath(d))
}

// 最近可继续的集号：项目已建剧集的最高集号；未建集时返回 null（按钮隐藏/改为打开项目）
function continueEpisodeNumber(d) {
  const numbers = (d.episodes || [])
    .map(e => Number(e.episode_number || e.episodeNumber || 0))
    .filter(n => n > 0)
  if (!numbers.length) return null
  return Math.max(...numbers)
}

// 直达剧集工作台：/drama/:id/episode/:集号
function openEpisode(d, episodeNumber) {
  if (!d || !episodeNumber) return
  activeMenuId.value = null
  statusMenuId.value = null
  navigateTo(`/drama/${d.id}/episode/${episodeNumber}`)
}

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.page {
  padding: 40px 48px 64px;
  overflow-y: auto;
  height: 100%;
  animation: fadeUp 0.35s var(--ease-out) both;
  background: var(--surface-base);
}

.home-top {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
  padding: var(--sp-2) 0 var(--sp-6);
}
.home-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text-0);
}
.home-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
}
.home-stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  white-space: nowrap;
}
.home-stat .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bg-3);
  flex-shrink: 0;
}
.home-stat .dot.is-blue { background: var(--accent); }
.home-stat .dot.is-green { background: var(--success); }
.home-stat .dot.is-gray { background: var(--text-3); }
.home-new { margin-left: auto; }

.ws-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 336px;
  gap: var(--sp-6);
  align-items: start;
}
.ws-main { min-width: 0; }
.ws-rail {
  display: grid;
  gap: var(--sp-4);
  align-content: start;
  position: sticky;
  top: 0;
}
.rail-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-4) var(--sp-5);
}
.rail-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
}
.rail-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-0);
}
.rail-hint { font-size: 10.5px; color: var(--text-3); }
.rail-action {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  font: 600 11.5px var(--font-body);
  color: var(--accent-text);
  cursor: pointer;
}
.rail-action:hover { text-decoration: underline; }
.resume-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.resume-thumb {
  position: relative;
  width: 92px;
  height: 54px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  color: var(--cover-text);
  font-size: 19px;
  font-weight: 800;
  overflow: hidden;
  background: var(--cover-fallback);
  box-shadow: var(--shadow-xs);
}
.resume-thumb svg { color: var(--cover-fallback-fg); opacity: 0.85; }
.resume-main { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.resume-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-0);
}
.resume-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
}
.resume-sub .truncate { min-width: 0; }
.status-dot-mini {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bg-3);
  flex-shrink: 0;
}
.status-dot-mini.on { background: var(--success); }
.status-dot-mini.done { background: var(--accent); }
.resume-go { margin-top: 4px; align-self: flex-start; }
.rail-empty { font-size: 12px; color: var(--text-3); line-height: 1.65; }

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 9px 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-1);
}
.stat-cell b {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-0);
  line-height: 1.2;
}
.stat-cell span { font-size: 10px; color: var(--text-3); }
.rail-foot-note {
  margin-top: 2px;
  text-align: center;
  font-size: 10.5px;
  color: var(--text-3);
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.style-swatch {
  appearance: none;
  position: relative;
  aspect-ratio: 4 / 3;
  display: block;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  color: var(--text-invert);
  box-shadow: var(--shadow-xs);
  transition: transform 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out);
}
.style-swatch:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
.style-swatch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--button-focus);
}
.style-swatch-name {
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 5px;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.25;
  color: var(--text-invert);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-5);
}
.search-box { position: relative; width: 260px; flex: 0 0 auto; }
.search-box svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-3);
  pointer-events: none;
}
.search-box .input {
  padding-left: 34px;
  border-radius: var(--radius-pill);
  border-color: var(--border);
  background: var(--bg-hover);
}
.search-box .input:focus { background: var(--surface-raised); }
.chip-row { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 1px; }
.filter-chip {
  appearance: none;
  cursor: pointer;
  padding: 6px 14px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--fill-subtle);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.16s var(--ease-out);
}
.filter-chip:hover { color: var(--text-0); background: var(--fill-hover); }
.filter-chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3.5px var(--button-focus);
}
.filter-chip.on { background: var(--text-0); color: var(--text-invert); }
.sort-select {
  margin-left: auto;
  width: auto;
  min-width: 132px;
  min-height: 36px;
  border-radius: var(--radius-pill);
  border-color: var(--border);
  background: var(--bg-hover);
  color: var(--text-1);
}
.sort-select:focus { background: var(--surface-raised); }

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(258px, 1fr));
  gap: var(--sp-5);
}
.project-card {
  position: relative;
  overflow: hidden;
  cursor: pointer;
  animation: fadeUp 0.32s var(--ease-out) both;
}
.project-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lift); }
.project-card:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3.5px var(--button-focus);
}
.project-thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cover-fallback);
  color: var(--cover-fallback-fg);
}
.cover-film { opacity: 0.75; }
.cover-glyph {
  font-size: 38px;
  font-weight: 800;
  line-height: 1;
  color: var(--cover-text);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.24);
  user-select: none;
}
.cover-style-name {
  position: absolute;
  left: 10px;
  bottom: 9px;
  max-width: calc(100% - 20px);
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--text-invert);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cover-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  gap: 6px;
  background: var(--surface-glass);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: var(--shadow-float);
  color: var(--text-1);
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-3);
}
.status-dot.on { background: var(--success); }
.status-dot.done { background: var(--accent); }
.status-wrap { position: absolute; top: 10px; left: 10px; }
.status-wrap .cover-badge { position: static; }
.status-badge { cursor: pointer; border: none; font: inherit; }
.status-menu {
  top: calc(100% + 6px);
  left: 0;
  right: auto;
  width: 108px;
}
.status-menu .menu-item.on { color: var(--accent); background: var(--accent-bg); }
.more-wrap {
  position: absolute;
  top: 8px;
  right: 8px;
}
.cover-more {
  width: 30px;
  min-width: 30px;
  height: 30px;
  min-height: 30px;
  background: var(--surface-glass);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--text-1);
  box-shadow: var(--shadow-float);
  opacity: 0;
  transition: opacity 0.15s var(--ease-out), background 0.15s var(--ease-out);
}
.cover-more:hover { background: var(--surface-raised); }
.project-card:hover .cover-more,
.more-wrap:focus-within .cover-more { opacity: 1; }
.more-menu {
  position: absolute;
  top: 36px;
  right: 0;
  width: 138px;
  display: grid;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
  box-shadow: var(--shadow-lg);
  z-index: 5;
}
.menu-item {
  min-height: var(--button-height-sm);
  display: flex;
  align-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-1);
  padding: 0 9px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.14s var(--ease-out);
}
.menu-item:hover { background: var(--bg-hover); color: var(--text-0); }
.menu-item:focus-visible {
  outline: none;
  background: var(--bg-hover);
  box-shadow: 0 0 0 2px var(--button-focus);
}
.menu-item.is-danger { color: var(--action-danger); }
.menu-item.is-danger:hover { background: var(--action-danger-bg); color: var(--action-danger); }

.project-body { padding: var(--sp-4); }
.project-name {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-0);
}
.project-meta {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-2);
  flex-wrap: wrap;
}
.project-foot {
  margin-top: var(--sp-3);
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.project-foot .updated {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
}
.go-episode {
  appearance: none;
  border: none;
  background: transparent;
  margin-left: auto;
  padding: 0;
  flex: 0 0 auto;
  font: 600 11px/1 var(--font-body);
  color: var(--accent-text);
  cursor: pointer;
  white-space: nowrap;
}
.go-episode:hover { text-decoration: underline; }
.go-episode:focus-visible {
  outline: none;
  border-radius: 4px;
  box-shadow: 0 0 0 2px var(--button-focus);
}

.skeleton-card { overflow: hidden; }
.skeleton-cover {
  aspect-ratio: 16 / 9;
  background: var(--bg-2);
  animation: skeleton-pulse 1.4s ease-in-out infinite alternate;
}
.skeleton-body { padding: var(--sp-4); display: grid; gap: 10px; }
.skeleton-line {
  height: 12px;
  border-radius: 99px;
  background: var(--bg-2);
  animation: skeleton-pulse 1.4s ease-in-out infinite alternate;
}
.skeleton-line.w-60 { width: 60%; }
.skeleton-line.w-40 { width: 40%; }
@keyframes skeleton-pulse { to { opacity: 0.55; } }

.empty-state {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  text-align: center;
}
.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  margin-bottom: 4px;
}
.empty-title { font-size: 14px; font-weight: 700; color: var(--text-1); }
.empty-desc { font-size: 12px; color: var(--text-3); max-width: 240px; line-height: 1.6; }

.create-dialog { width: 880px; max-width: calc(100vw - 32px); }
.dialog-head-copy { display: flex; flex-direction: column; gap: 2px; }
.dialog-desc { font-size: 12.5px; color: var(--text-3); }
.modal-icon {
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: var(--radius);
  background: var(--accent-bg);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
}
.step-indicator {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
}
.step-indicator span {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--bg-2);
  color: var(--text-3);
  font-size: 11px;
  font-weight: 700;
}
.step-indicator span.on { background: var(--text-0); color: var(--text-invert); }
.step-indicator i { width: 24px; height: 1px; background: var(--border-strong); }
.dialog-form {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.dialog-body { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-1); }
.required { color: var(--error); }
.field-hint { font-size: 11px; color: var(--text-3); line-height: 1.5; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.source-step { min-height: 430px; }
.source-intro {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 14px 15px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-1);
  color: var(--accent);
}
.source-intro strong { display: block; color: var(--text-0); font-size: 13px; }
.source-intro p { margin: 3px 0 0; color: var(--text-2); font-size: 12px; line-height: 1.55; }
.source-methods {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 4px;
  border-radius: var(--radius);
  background: rgba(0, 0, 0, 0.045);
}
.source-method {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-2);
  font-size: 11.5px;
  font-weight: 650;
  cursor: pointer;
}
.source-method:hover { color: var(--text-0); }
.source-method.on { background: var(--surface-raised); color: var(--text-0); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.09); }
.source-import-panel {
  min-height: 72px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
  background: var(--bg-1);
  color: var(--accent);
}
.source-import-panel > div { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; }
.source-import-panel strong { color: var(--text-0); font-size: 12px; }
.source-import-panel span { color: var(--text-3); font-size: 10.5px; }
.source-url-panel { padding: 12px 13px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-1); }
.source-url-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.source-field { position: relative; flex: 1; }
.source-textarea {
  min-height: 260px;
  height: 100%;
  resize: vertical;
  padding: 15px 16px 36px;
  line-height: 1.75;
  font-size: 13px;
}
.source-count {
  position: absolute;
  right: 12px;
  bottom: 10px;
  padding: 3px 7px;
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  color: var(--text-3);
  font-size: 10.5px;
}
.source-count.ready { color: var(--success); }
.analysis-note {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-3);
  font-size: 11.5px;
}
.spinner-sm {
  width: 13px;
  height: 13px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.plan-step { gap: 22px; }
.plan-summary {
  padding: 14px 16px;
  border-left: 3px solid var(--accent);
  border-radius: 0 var(--radius) var(--radius) 0;
  background: var(--accent-bg);
}
.section-kicker {
  display: block;
  margin-bottom: 5px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.plan-summary p { margin: 0; color: var(--text-1); font-size: 12px; line-height: 1.65; }
.plan-section { display: flex; flex-direction: column; gap: 11px; }
.section-headline { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-headline > div { display: flex; align-items: center; gap: 8px; color: var(--text-0); font-size: 13px; }
.section-headline > span { color: var(--text-3); font-size: 10.5px; }
.section-index { color: var(--accent); font-size: 10px; font-weight: 800; letter-spacing: 0.06em; }
.title-candidates, .style-candidates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.choice-card {
  appearance: none;
  position: relative;
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
  color: var(--text-1);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s var(--ease-out), background 0.15s var(--ease-out), box-shadow 0.15s var(--ease-out);
}
.choice-card:hover { border-color: var(--border-strong); background: var(--bg-1); }
.choice-card:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--button-focus); }
.choice-card.selected { border-color: var(--accent); background: var(--accent-bg); box-shadow: inset 0 0 0 1px var(--accent); }
.title-choice { min-height: 72px; flex-direction: column; gap: 4px; padding: 12px 38px 11px 13px; }
.choice-card strong { color: var(--text-0); font-size: 12.5px; }
.choice-card > span:not(.source-badge) { color: var(--text-3); font-size: 10.5px; line-height: 1.4; }
.choice-check { position: absolute; top: 11px; right: 11px; color: var(--accent); }
.compact-field { margin-top: 1px; }
.style-choice { min-height: 100px; flex-direction: column; gap: 6px; padding: 11px 13px; }
.choice-topline { display: flex; align-items: center; justify-content: space-between; color: var(--accent); }
.source-badge { padding: 3px 7px; border-radius: var(--radius-pill); font-size: 9.5px; font-weight: 700; }
.source-badge.is-existing { background: rgba(52, 199, 89, 0.11); color: #238a42; }
.source-badge.is-new { background: rgba(175, 82, 222, 0.11); color: #8642a6; }
.existing-style-picker {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  color: var(--text-2);
  font-size: 11.5px;
}
.existing-style-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.existing-style-controls .btn.is-active { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
.style-ai-btn { color: var(--accent); }
.custom-style-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 13px 14px;
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  background: var(--accent-bg);
}
.custom-style-grid { display: grid; grid-template-columns: minmax(150px, 0.7fr) minmax(220px, 1.3fr); gap: 10px; }
.new-style-confirm {
  display: flex;
  flex-direction: column;
  gap: 11px;
  padding: 13px 14px;
  border: 1px solid rgba(175, 82, 222, 0.22);
  border-radius: var(--radius);
  background: rgba(175, 82, 222, 0.05);
}
.new-style-copy { display: flex; align-items: flex-start; gap: 9px; color: #8642a6; }
.new-style-copy strong { display: block; color: var(--text-0); font-size: 12px; }
.new-style-copy p { margin: 3px 0 0; color: var(--text-2); font-size: 10.5px; line-height: 1.5; }
.confirm-check { display: flex; align-items: center; gap: 8px; color: var(--text-1); font-size: 11.5px; cursor: pointer; }
.confirm-check input { accent-color: var(--accent); }
.ratio-candidates { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.ratio-choice { min-height: 78px; align-items: center; gap: 10px; padding: 11px 12px; color: var(--text-3); }
.ratio-choice > div { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ratio-choice > div span { color: var(--text-3); font-size: 9.5px; line-height: 1.35; }
.ratio-choice > svg:last-child { margin-left: auto; flex: 0 0 auto; color: var(--accent); }
.plan-foot .btn:first-child { margin-right: auto; }

@media (max-width: 1100px) {
  .ws-grid { grid-template-columns: minmax(0, 1fr) 300px; gap: var(--sp-4); }
}
@media (max-width: 940px) {
  .ws-grid { grid-template-columns: minmax(0, 1fr); }
  .ws-rail { display: none; }
}
@media (max-width: 760px) {
  .page { padding: 24px 16px 40px; }
  .home-top { flex-wrap: wrap; gap: var(--sp-2) var(--sp-4); }
  .home-stats { order: 3; width: 100%; justify-content: center; }
  .home-new { margin-left: auto; }
  .toolbar { flex-wrap: wrap; }
  .search-box { width: 100%; flex: 1 1 100%; }
  .sort-select { margin-left: 0; flex: 1; }
  .field-row { grid-template-columns: 1fr; }
  .create-dialog { max-height: calc(100vh - 24px); }
  .dialog-head { align-items: flex-start; }
  .step-indicator { display: none; }
  .title-candidates, .style-candidates, .ratio-candidates { grid-template-columns: 1fr; }
  .existing-style-picker { grid-template-columns: 1fr; gap: 6px; }
  .existing-style-controls, .custom-style-grid, .source-url-row { grid-template-columns: 1fr; }
  .source-methods { grid-template-columns: 1fr; }
  .source-import-panel { align-items: flex-start; flex-wrap: wrap; }
  .dialog-foot { flex-direction: column-reverse; }
  .dialog-foot .btn { width: 100%; }
  .plan-foot .btn:first-child { margin-right: 0; }
}
</style>
