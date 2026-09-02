import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('project custom style supports one-shot AI expansion seeded with full-text samples', () => {
  const detail = read('app/views/drama/detail.vue')
  const api = read('app/composables/useApi.ts')

  assert.match(detail, /expandProjectCustomStyle/)
  assert.match(detail, /AI 完善/)
  assert.match(detail, /stylePresetAPI\.expand/)
  assert.match(detail, /sampleContentForStyleExpand\(projectDraft\.content\)/)
  assert.match(api, /expand: \(d: \{ name\?/)
  assert.match(api, /\/style-presets\/expand/)
})

test('settings style dialog can ask AI to complete name/description/prompt at once', () => {
  const settings = read('app/pages/settings.vue')

  assert.match(settings, /style-ai-bar/)
  assert.match(settings, /expandStyle/)
  assert.match(settings, /styleExpanding/)
  assert.match(settings, /stylePresetAPI\.expand/)
  assert.match(settings, /AI 已完善风格信息/)
})

test('episode planner sends an optional creative requirement alongside the full text', () => {
  const detail = read('app/views/drama/detail.vue')
  const api = read('app/composables/useApi.ts')

  assert.match(detail, /episodeRequirement/)
  assert.match(detail, /创作要求（可选）/)
  assert.match(detail, /requirement: episodeRequirement\.value \|\| undefined/)
  assert.match(api, /requirement\?: string/)
})
