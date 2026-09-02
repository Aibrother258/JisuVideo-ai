import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const settings = readFileSync(new URL('../app/pages/settings.vue', import.meta.url), 'utf8')

const count = (haystack, needle) => haystack.split(needle).length - 1

test('settings agent/skills lists are driven by /prompts instead of a hardcoded array', () => {
  // 旧的写死 5 个 Agent 数组必须消失：后端新增 Agent（style_enhancer 等）无需再改前端
  assert.doesNotMatch(settings, /const agentDefs\s*=\s*\[/)
  // 列表由接口返回（agentCfgs <- promptAPI.list() 即 /prompts）动态合成
  assert.match(settings, /agentCfgs\.value\.map\(c =>/)
  assert.match(settings, /label: c\.name \|\| c\.agent_type/)
  // Agent 配置卡片与 Skills 左侧列表都渲染同一动态列表
  assert.equal(count(settings, 'v-for="a in agentList"'), 2)
})

test('every registered agent gets an icon, unknown ones fall back to a generic one', () => {
  assert.match(settings, /style_enhancer: '🎨'/)
  assert.match(settings, /episode_planner: '📚'/)
  assert.match(settings, /project_analyzer: '💡'/)
  assert.match(settings, /script_rewriter: '📝'/)
  assert.match(settings, /AGENT_ICONS\[type\] \|\| '🤖'/)
})

test('saving an agent prompt keeps the display name from the /prompts payload', () => {
  assert.match(settings, /name: agentList\.value\.find\(a => a\.type === type\)\?\.label \|\| type/)
  assert.match(settings, /promptAPI\.update\(type,/)
  assert.match(settings, /await loadAgents\(\)/)
})

test('skills page keeps a valid selection once the agent list arrives', () => {
  assert.match(settings, /watch\(agentCfgs/)
  assert.match(settings, /!list\.some\(a => a\.agent_type === selectedAgent\.value\)/)
  assert.match(settings, /selectedAgent\.value = list\[0\]\.agent_type/)
})
