import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('style_enhancer agent is registered as a pure JSON single-step agent', () => {
  const agents = read('src/agents/index.ts')

  assert.match(agents, /style_enhancer: \{/)
  assert.match(agents, /视觉风格完善/)
  assert.match(agents, /style_enhancer: \{\},/)
})

test('style presets expose an AI expand endpoint reusing the text agent and request guard', () => {
  const route = read('src/routes/stylePresets.ts')

  assert.match(route, /app\.post\('\/expand'/)
  assert.match(route, /mastra\.getAgent\('style_enhancer'\)/)
  assert.match(route, /acquireAiRequest\('style-enhancer', 6, 1\)/)
  // 一次完善全部：中文名 + 一句中文说明 + 英文提示词片段（key 仅作建议）
  assert.match(route, /name: String\(raw\?\.name/)
  assert.match(route, /description: String\(raw\?\.description/)
  assert.match(route, /prompt: String\(raw\?\.prompt/)
})

test('JSON parsing and source sampling helpers are shared for future content types', () => {
  const json = read('src/utils/json.ts')
  const sample = read('src/utils/source-sample.ts')
  const dramas = read('src/routes/dramas.ts')

  assert.match(json, /export function parseJsonObject/)
  assert.match(sample, /export function sampleSourceContent/)
  assert.match(dramas, /import \{\s*parseJsonObject \} from '\.\.\/utils\/json\.js'/)
  assert.match(dramas, /import \{\s*sampleSourceContent \} from '\.\.\/utils\/source-sample\.js'/)
})

test('episode analysis accepts an optional creative requirement injected into the prompt', () => {
  const route = read('src/routes/dramas.ts')

  assert.match(route, /const requirement = String\(body\.requirement/)
  assert.match(route, /创作要求最多 500 字/)
  assert.match(route, /<requirement>/)
  assert.match(route, /\$\{requirementContext\}\$\{reviewContext\}/)
})
