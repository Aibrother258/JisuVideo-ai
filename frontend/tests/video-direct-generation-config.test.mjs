import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const settingsPage = readFileSync(new URL('../app/pages/settings.vue', import.meta.url), 'utf8')
const aiConfigRoute = readFileSync(new URL('../../backend/src/routes/aiConfigs.ts', import.meta.url), 'utf8')
const volcengineAdapter = readFileSync(new URL('../../backend/src/services/adapters/volcengine-video.ts', import.meta.url), 'utf8')

test('video presets default to direct Seedance 2.0 generation', () => {
  const combined = `${settingsPage}\n${aiConfigRoute}\n${volcengineAdapter}`
  assert.doesNotMatch(combined, /doubao-seedance-1-5-pro-251215/)
  assert.match(settingsPage, /Seedance 2\.0/)
  assert.match(settingsPage, /doubao-seedance-2-0-260128/)
  assert.match(settingsPage, /doubao-seedance-2-0-fast-260128/)
  assert.match(settingsPage, /doubao-seedance-2-0-mini-260615/)
})

test('video presets use official provider endpoints', () => {
  assert.doesNotMatch(settingsPage, /api\.chatfire\.site/)
  assert.match(settingsPage, /https:\/\/ark\.cn-beijing\.volces\.com/)
  assert.doesNotMatch(settingsPage, /https:\/\/dashscope\.aliyuncs\.com/)
  assert.doesNotMatch(settingsPage, /https:\/\/api\.vidu\.com/)
})
