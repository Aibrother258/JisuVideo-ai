import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const settingsPage = readFileSync(new URL('../app/pages/settings.vue', import.meta.url), 'utf8')
const useApi = readFileSync(new URL('../app/composables/useApi.ts', import.meta.url), 'utf8')

function providerPresetBlock(serviceType) {
  const presetsStart = settingsPage.indexOf('const providerPresets = {')
  assert.notEqual(presetsStart, -1, 'missing providerPresets')
  const marker = `  ${serviceType}: {`
  const start = settingsPage.indexOf(marker, presetsStart)
  assert.notEqual(start, -1, `missing ${serviceType} provider presets`)
  const end = settingsPage.indexOf('\n  },', start)
  assert.notEqual(end, -1, `unterminated ${serviceType} provider presets`)
  return settingsPage.slice(start, end)
}

test('settings page exposes the supported official and workflow provider templates', () => {
  assert.match(settingsPage, /const providers = \['gemini', 'openai', 'volcengine', 'minimax', 'autodl'\]/)
  assert.match(settingsPage, /https:\/\/generativelanguage\.googleapis\.com/)
  assert.match(settingsPage, /https:\/\/api\.openai\.com/)
  assert.match(settingsPage, /https:\/\/ark\.cn-beijing\.volces\.com/)
  assert.match(settingsPage, /https:\/\/api\.minimaxi\.com/)
  assert.match(settingsPage, /https:\/\/autodl\.art/)
  assert.doesNotMatch(settingsPage, /火宝快捷配置/)
  assert.doesNotMatch(settingsPage, /api\.chatfire\.site/)
  assert.doesNotMatch(settingsPage, /applyHuobaoQuickConfig/)
  assert.doesNotMatch(useApi, /api\.chatfire\.site/i)
})

test('settings page offers official default model IDs', () => {
  assert.match(settingsPage, /gemini-3\.1-pro-preview/)
  assert.match(settingsPage, /gemini-3\.5-flash/)
  assert.match(settingsPage, /gemini-3-flash-preview/)
  assert.match(settingsPage, /gpt-5\.6-terra/)
  assert.doesNotMatch(settingsPage, /deepseek-v4-flash/)
  assert.match(settingsPage, /gemini-3-pro-image/)
  assert.match(settingsPage, /gemini-3\.1-flash-image/)
  assert.match(settingsPage, /gpt-image-2/)
  assert.match(settingsPage, /doubao-seedance-2-0-260128/)
  assert.match(settingsPage, /doubao-seedance-2-0-fast-260128/)
  assert.match(settingsPage, /doubao-seedance-2-0-mini-260615/)
  assert.match(settingsPage, /deepseek-v4-pro/)
  assert.match(settingsPage, /MiniMax-H3/)
  assert.match(settingsPage, /minimax_h3_image_audio_to_video_v2_15s/)
  assert.doesNotMatch(settingsPage, /gpt-5\.4/)
  assert.doesNotMatch(settingsPage, /doubao-seed-1-6/)
  assert.doesNotMatch(settingsPage, /wan2\.6-t2i/)
  assert.doesNotMatch(settingsPage, /wan2\.6-i2v-flash/)
  assert.doesNotMatch(settingsPage, /viduq3-turbo/)
  assert.doesNotMatch(settingsPage, /viduq3-pro/)
  assert.doesNotMatch(settingsPage, /gemini-2\.5-flash/)
  assert.doesNotMatch(settingsPage, /gpt-4\.1-mini/)
  assert.doesNotMatch(settingsPage, /gpt-image-1/)
  assert.doesNotMatch(settingsPage, /gemini-3-pro-image-preview/)
  assert.doesNotMatch(settingsPage, /gemini-3\.1-flash-image-preview/)
  assert.doesNotMatch(settingsPage, /doubao-seedream/)
  assert.doesNotMatch(settingsPage, /speech-2\.8-hd/)
})

test('all configured services expose the connection test button', () => {
  assert.match(settingsPage, /class="btn btn-ghost btn-sm" @click="testExistingCfg\(c\)">测试/)
})

test('provider presets are separated by service capability', () => {
  assert.match(providerPresetBlock('text'), /gemini[\s\S]*openai/)
  assert.match(providerPresetBlock('image'), /gemini[\s\S]*openai/)
  assert.match(providerPresetBlock('video'), /volcengine/)
  assert.match(providerPresetBlock('video'), /minimax[\s\S]*autodl/)
  // 音频板块：AutoDL IndexTTS2 语音合成工作流，与视频 H3 工作流互相独立
  assert.match(providerPresetBlock('audio'), /autodl[\s\S]*indextts2-v1/)
  assert.doesNotMatch(providerPresetBlock('video'), /indextts/)
  assert.doesNotMatch(providerPresetBlock('audio'), /minimax_h3|doubao-seedance|MiniMax-H3/)
})
