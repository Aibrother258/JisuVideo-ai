/**
 * MiniMax 厂商面收敛后的当前契约。
 *
 * 该文件由 remove-minimax-media-structure.test.mjs 改名而来：
 * 旧断言要求「MiniMax 全部移除」，但后续迭代为了支持 MiniMax H3 视频工作流，
 * 有意恢复了 MiniMax 视频适配器。这里改为断言当前真实且期望的边界：
 * 视频保留 MiniMax / AutoDL，图片与 TTS 保持移除，其它已下线厂商不得回来。
 */
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('../..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const exists = (path) => existsSync(new URL(path, root))

test('MiniMax video provider is supported while image and TTS adapters stay removed', () => {
  const ai = read('backend/src/services/ai.ts')
  const registry = read('backend/src/services/adapters/registry.ts')

  // 视频：保留 MiniMax（H3 工作流）与 AutoDL，并已登记进官方厂商白名单
  assert.match(ai, /video:\s*\[\s*'volcengine',\s*'minimax',\s*'autodl'\s*\]/)
  assert.match(registry, /minimax: new MiniMaxVideoAdapter\(\)/)
  assert.match(registry, /autodl: new AutoDLVideoAdapter\(\)/)
  assert.equal(exists('backend/src/services/adapters/minimax-video.ts'), true)
  assert.equal(exists('backend/src/services/adapters/autodl-video.ts'), true)

  // 图片与语音：MiniMax 图片/TTS 适配器仍保持移除
  assert.doesNotMatch(registry, /minimax:\s*new MiniMaxImageAdapter\(\)/)
  assert.doesNotMatch(registry, /minimax-tts/)
  assert.equal(exists('backend/src/services/adapters/minimax-image.ts'), false)
  assert.equal(exists('backend/src/services/adapters/minimax-tts.ts'), false)

  // 其它已下线厂商不得回来
  assert.doesNotMatch(registry, /AliImageAdapter|AliVideoAdapter|ViduVideoAdapter/)
  assert.doesNotMatch(ai, /'vidu'/)
  assert.doesNotMatch(ai, /'ali'/)
  // 音频服务配置仅允许 AutoDL（IndexTTS2 等工作流），不借道 MiniMax 引入 TTS
  assert.match(ai, /audio:\s*\[\s*'autodl'\s*\]/)
  assert.doesNotMatch(ai, /audio:\s*\[\s*[^\]]*minimax/)
})

test('startup schema migration keeps MiniMax H3 metadata columns idempotent', () => {
  const mysqlSchema = read('backend/src/db/mysql-schema.ts')

  assert.match(mysqlSchema, /minimax_h3_prompt TEXT/)
  assert.match(mysqlSchema, /minimax_h3_source_hash/)
  assert.match(mysqlSchema, /minimax_h3_generated_at/)
  // 幂等补齐：先查 information_schema，缺列才 ALTER，重复启动不会报错
  assert.match(mysqlSchema, /information_schema\.COLUMNS/)
  assert.match(mysqlSchema, /ALTER TABLE storyboards ADD COLUMN minimax_h3_source_hash/)
  assert.match(mysqlSchema, /ALTER TABLE storyboards ADD COLUMN minimax_h3_generated_at/)
})
