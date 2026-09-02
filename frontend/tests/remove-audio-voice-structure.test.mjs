import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const appRoot = new URL('../app/', import.meta.url)
const readApp = (path) => readFileSync(new URL(path, appRoot), 'utf8')

const episodePage = readApp('views/drama/episode.vue')
const dramaPage = readApp('views/drama/detail.vue')
const settingsPage = readApp('pages/settings.vue')
const useApi = readApp('composables/useApi.ts')

test('frontend API client no longer exposes TTS or voice endpoints', () => {
  assert.doesNotMatch(useApi, /generateTTS/)
  assert.doesNotMatch(useApi, /voiceSample/)
  assert.doesNotMatch(useApi, /voicesAPI/)
  assert.doesNotMatch(useApi, /ai-voices/)
  assert.doesNotMatch(useApi, /generate-voice-sample/)
  assert.doesNotMatch(useApi, /generate-tts/)
})

test('episode workbench removes all role voice assignment controls', () => {
  assert.doesNotMatch(episodePage, /voice_assigner/)
  assert.doesNotMatch(episodePage, /AI 匹配声音/)
  assert.doesNotMatch(episodePage, /批量试听/)
  assert.doesNotMatch(episodePage, /角色音色/)
  assert.doesNotMatch(episodePage, /已配音色/)
  assert.doesNotMatch(episodePage, /待音色/)
  assert.doesNotMatch(episodePage, /asset-detail-voice-panel/)
  assert.doesNotMatch(episodePage, /updateCharVoice/)
  assert.doesNotMatch(episodePage, /previewVoiceSample/)
  assert.doesNotMatch(episodePage, /voiceProfiles/)
  assert.doesNotMatch(episodePage, /audioConfigs/)
  assert.doesNotMatch(episodePage, /voicesAPI/)
})

test('project pages remove audio config consumption while settings exposes an audio service board', () => {
  // 工作台项目/成片页不消费音频配置（角色音色分配结构保持移除）
  assert.doesNotMatch(dramaPage, /audio_config_id/)
  assert.doesNotMatch(dramaPage, /audioConfigs/)
  assert.doesNotMatch(dramaPage, /音频/)
  // 设置页不再有旧的角色音色分配结构
  assert.doesNotMatch(settingsPage, /voice_assigner/)
  assert.doesNotMatch(settingsPage, /音色分配/)
  assert.doesNotMatch(settingsPage, /speech-2\.8-hd/)
  // 但新增了「音频」服务配置板块（AutoDL IndexTTS2），供后续配音/旁白合成使用
  const serviceTypeLine = settingsPage.match(/const serviceTypes = \[[^\n]+/)?.[0] || ''
  assert.match(serviceTypeLine, /\{ type: 'audio', label: '音频' \}/)
  assert.match(settingsPage, /audio:\s*\{[\s\S]*autodl[\s\S]*indextts2-v1/)
})
