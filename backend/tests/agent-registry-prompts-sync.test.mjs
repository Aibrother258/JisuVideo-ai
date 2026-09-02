import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const agents = read('src/agents/index.ts')
const promptsRoute = read('src/routes/prompts.ts')

function block(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker)
  assert.notEqual(start, -1, `missing marker: ${startMarker}`)
  const end = text.indexOf(endMarker, start)
  assert.notEqual(end, -1, `unterminated block after: ${startMarker}`)
  return text.slice(start, end)
}

// DEFAULT_PROMPTS：顶层键形如 `  type: {`
const braceKeys = (text) =>
  text.split(/\r?\n/).filter(line => /^ {2}[a-z][a-z0-9_]*: \{/.test(line)).map(line => line.trim().split(':')[0])
// AGENT_TOOLS：顶层键值形如 `{}`、`scriptTools` 或 `{` 多行对象，只按缩进收集键名
const anyKeys = (text) =>
  text.split(/\r?\n/).map(line => line.match(/^ {2}([a-z][a-z0-9_]*): /)).filter(Boolean).map(m => m[1])

test('every registered agent type has default prompt, tools and registry entry (single source of truth)', () => {
  const defaultPrompts = block(agents, 'export const DEFAULT_PROMPTS', 'export const validAgentTypes')
  const agentTools = block(agents, 'const AGENT_TOOLS: Record<string, Record<string, any>> = {', '/** instructions 按请求解析')

  const promptKeys = braceKeys(defaultPrompts)
  const toolKeys = anyKeys(agentTools)

  // 注册表由 validAgentTypes 派生，validAgentTypes 又来自 DEFAULT_PROMPTS，
  // 因此新增 Agent 只需补 DEFAULT_PROMPTS + AGENT_TOOLS 两处
  assert.ok(promptKeys.length >= 8, `expected >=8 agents, got ${promptKeys.length}`)
  assert.deepEqual(toolKeys.sort(), promptKeys.sort(), 'AGENT_TOOLS must cover every DEFAULT_PROMPTS key')
  assert.match(agents, /export const validAgentTypes = Object\.keys\(DEFAULT_PROMPTS\)/)
  assert.match(agents, /Object\.fromEntries\(\s*validAgentTypes\.map\(type => \[/)
  // 新 Agent 的三处都必须出现（DEFAULT_PROMPTS 内容 + AGENT_TOOLS 工具键）
  for (const type of ['style_enhancer', 'project_analyzer', 'episode_planner']) {
    assert.ok(promptKeys.includes(type), `${type} missing from DEFAULT_PROMPTS`)
    assert.ok(toolKeys.includes(type), `${type} missing from AGENT_TOOLS`)
  }
})

test('/prompts routes list, validate and persist using the same validAgentTypes source', () => {
  // 列表：遍历 validAgentTypes —— 新增 Agent 自动出现在设置中心
  assert.match(promptsRoute, /validAgentTypes\.map\(async \(type\) =>/)
  // 类型校验（GET/PUT/RESET 白名单）同源
  assert.match(promptsRoute, /const checkType = \(type: string\) => validAgentTypes\.includes\(type\)/)
  // 保存/重置都落到 workspace/prompts/<type>.md，运行时按文件加载
  assert.match(promptsRoute, /promptFilePath\(type\)/)
  assert.match(promptsRoute, /serializePromptFile\(\{ name, model, instructions \}\)/)
})

test('runtime loading resolves from prompt file first, then in-code default', () => {
  // buildInstructions/buildModel 都先读 prompt 文件，缺失回退 DEFAULT_PROMPTS —— 与 /prompts 一致
  assert.match(agents, /const promptFile = await loadAgentPromptFile\(type\)/)
  assert.match(agents, /promptFile\?\.instructions \|\| defaults\.instructions/)
  assert.match(agents, /promptFile\?\.model \|\| undefined/)
})
