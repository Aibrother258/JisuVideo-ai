import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('project creation supports paste, TXT/MD file and public novel URL', () => {
  const page = read('app/pages/index.vue')
  const api = read('app/composables/useApi.ts')

  assert.match(page, /粘贴内容/)
  assert.match(page, /上传 TXT \/ MD/)
  assert.match(page, /小说链接/)
  assert.match(page, /accept="\.txt,\.md,text\/plain,text\/markdown"/)
  assert.match(page, /handleSourceFile/)
  assert.match(page, /handleFileDrop/)
  assert.match(page, /importSourceUrl/)
  assert.match(api, /importSource: \(url: string\)/)
  assert.match(api, /\/dramas\/import-source/)
})

test('project style supports existing, custom and three AI-matched candidates', () => {
  const launcher = read('app/pages/index.vue')
  const detail = read('app/views/drama/detail.vue')

  for (const source of [launcher, detail]) {
    assert.match(source, /自定义风格|自定义/)
    assert.match(source, /AI 匹配 3 个|AI 匹配 3 个风格/)
    assert.match(source, /stylePresetAPI\.create/)
  }
  assert.match(launcher, /result\.style_candidates/)
  assert.match(detail, /projectStyleCandidates/)
})

test('full-text workspace saves project settings, recommends episode count and commits review drafts', () => {
  const detail = read('app/views/drama/detail.vue')
  const api = read('app/composables/useApi.ts')

  assert.match(detail, /全文内容/)
  assert.match(detail, /projectDraft\.content/)
  assert.match(detail, /默认视频分辨率/)
  assert.match(detail, /AI 推荐集数/)
  assert.match(detail, /analyzeEpisodePlan/)
  assert.match(detail, /episodePlan\.episodes/)
  assert.match(detail, /全文拆分草稿 · 待复核/)
  assert.match(detail, /commitEpisodePlan/)
  assert.match(api, /analyzeEpisodes/)
  assert.match(api, /createEpisodesFromPlan/)
})

test('episode plan stays on the project page and requires review before commit', () => {
  const detail = read('app/views/drama/detail.vue')

  assert.match(detail, /huobao:episode-plan:/)
  assert.match(detail, /saveEpisodePlanDraftNow/)
  assert.match(detail, /reloadServerEpisodePlan/)
  assert.match(detail, /VERSION_CONFLICT|episodePlanConflict/)
  assert.match(detail, /逐集详情、二次编辑与批注/)
  assert.match(detail, /确认本集并切换下一集/)
  assert.match(detail, /一键审阅确认/)
  assert.match(detail, /allEpisodesReviewed/)
  assert.match(detail, /episodePlanStale/)
  assert.match(detail, /!allEpisodesReviewed \|\| episodePlanStale/)
})

test('episode detail tabs support notes and AI re-splitting from aggregated feedback', () => {
  const detail = read('app/views/drama/detail.vue')
  const api = read('app/composables/useApi.ts')

  assert.match(detail, /episode-detail-tabs/)
  assert.match(detail, /selectedEpisodeNumber/)
  assert.match(detail, /activeReviewEpisode/)
  assert.match(detail, /review_note/)
  assert.match(detail, /汇总 .* 条批注并重新拆分/)
  assert.match(detail, /reanalyzeFromReviewNotes/)
  assert.match(api, /review_notes/)
})

test('episode source text is editable, tabs share the row, and generated state tracks content changes', () => {
  const detail = read('app/views/drama/detail.vue')

  assert.match(detail, /v-model="activeReviewEpisode\.content"/)
  assert.match(detail, /onEpisodeContentInput/)
  assert.match(detail, /--episode-tab-count/)
  assert.match(detail, /grid-template-columns: repeat\(var\(--episode-tab-count\), minmax\(0, 1fr\)\)/)
  assert.match(detail, /planAlreadyGenerated/)
  assert.match(detail, /已生成到剧集列表/)
  assert.match(detail, /generatedPlanHash/)
  assert.match(detail, /serverPlanHash/)
})
