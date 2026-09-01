import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contentFingerprint, normalizeReviewablePlan, sourceHash } from '../src/services/episode-plan-draft.ts'

const plan = normalizeReviewablePlan({
  reason: '两集更适合节奏',
  episodes: [
    { title: '开始', summary: '建立目标', content: '第一段原文。', reviewed: true, review_note: '保留' },
    { title: '推进', summary: '完成作品', content: '第二段原文。', reviewed: false },
  ],
})

test('plan normalization preserves editable fields and derives character counts', () => {
  assert.equal(plan.recommended_count, 2)
  assert.equal(plan.episodes[0].review_note, '保留')
  assert.equal(plan.episodes[1].character_count, plan.episodes[1].content.length)
})

test('generated content fingerprint ignores review-only changes but covers resolution and source content', () => {
  const first = contentFingerprint(plan, '720p')
  const reviewOnly = structuredClone(plan)
  reviewOnly.episodes[0].reviewed = false
  reviewOnly.episodes[0].review_note = '新的批注'
  assert.equal(contentFingerprint(reviewOnly, '720p'), first)
  assert.notEqual(contentFingerprint(reviewOnly, '480p'), first)
  reviewOnly.episodes[0].content += '修改'
  assert.notEqual(contentFingerprint(reviewOnly, '720p'), first)
  assert.notEqual(sourceHash('原文甲'), sourceHash('原文乙'))
})

test('plan validation rejects oversize fields instead of truncating them', () => {
  assert.throws(() => normalizeReviewablePlan({
    episodes: [{ title: '题'.repeat(201), content: '正文' }],
  }), /标题超过 200 字/)
  assert.throws(() => normalizeReviewablePlan({
    episodes: [{ title: '标题', content: '正文', review_note: '批'.repeat(2001) }],
  }), /批注超过 2000 字/)
})
