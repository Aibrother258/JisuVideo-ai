import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('project analyzer uses the configured text model and active style presets', () => {
  const route = read('src/routes/dramas.ts')
  const agents = read('src/agents/index.ts')

  assert.match(route, /app\.post\('\/analyze-source'/)
  assert.match(route, /mastra\.getAgent\('project_analyzer'\)/)
  assert.match(route, /schema\.stylePresets/)
  assert.match(route, /preset\.isActive/)
  assert.match(route, /style_candidates/)
  assert.match(route, /aspect_ratios/)
  assert.match(route, /content\.length > 200_000/)
  assert.doesNotMatch(route, /当前没有启用的视觉风格/)
  assert.match(agents, /project_analyzer/)
  assert.match(agents, /项目方案提炼/)
})

test('project source content is persisted when creating the drama', () => {
  const route = read('src/routes/dramas.ts')

  assert.match(route, /description: body\.description/)
  assert.match(route, /if \(!body\.title\?\.trim\(\)\)/)
})
