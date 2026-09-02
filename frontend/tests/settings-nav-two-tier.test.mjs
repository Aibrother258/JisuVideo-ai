import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('settings nav is a two-tier structure without the advanced toggle', () => {
  const settings = read('app/pages/settings.vue')

  // 「Agent 高级配置」开关整体移除
  assert.doesNotMatch(settings, /showAdvanced/)
  assert.doesNotMatch(settings, /advanced-toggle/)
  assert.doesNotMatch(settings, /nav-advanced/)
  assert.doesNotMatch(settings, /v-if="showAdvanced"/)

  // 两级导航数据：一组 + 若干二级目录，四个目录全部常驻
  assert.match(settings, /const navGroups = \[/)
  assert.match(settings, /id: 'basic'/)
  assert.match(settings, /id: 'advanced'/)
  assert.match(settings, /\{ id: 'ai', label: 'AI 服务', icon: Cpu \}/)
  assert.match(settings, /\{ id: 'styles', label: '风格预设', icon: Palette \}/)
  assert.match(settings, /\{ id: 'agents', label: 'Agent 配置', icon: Bot \}/)
  assert.match(settings, /\{ id: 'skills', label: 'Skills', icon: FileText \}/)

  // 模板以双层 v-for 渲染分组与目录，不再按 base/advanced 分开写死
  assert.match(settings, /v-for="g in navGroups"/)
  assert.match(settings, /v-for="t in g\.items"/)
  assert.doesNotMatch(settings, /v-for="t in baseTabs"/)
  assert.doesNotMatch(settings, /v-for="t in advancedTabs"/)

  // 默认目录仍是 AI 服务，且不再有 showAdvanced 关闭时的回退 watch
  assert.match(settings, /const tab = ref\('ai'\)/)
  assert.doesNotMatch(settings, /watch\(showAdvanced/)
  assert.doesNotMatch(settings, /advancedTabs\.some/)
})
