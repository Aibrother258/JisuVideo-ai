import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('project creation starts from source content and offers AI-generated choices', () => {
  const page = read('app/pages/index.vue')

  assert.match(page, /从内容创建项目/)
  assert.match(page, /小说、短文或故事内容/)
  assert.match(page, /AI 提炼项目方案/)
  assert.match(page, /dramaAPI\.analyzeSource/)
  assert.match(page, /analysis\?\.titles/)
  assert.match(page, /视觉风格/)
  assert.match(page, /已有风格/)
  assert.match(page, /新风格/)
  assert.match(page, /确认创建.*并加入风格预设库/)
  assert.match(page, /stylePresetAPI\.create/)
  assert.match(page, /description: sourceContent\.value\.trim\(\)/)
  // 创建时不再按 total_episodes 预建剧集（服务端已改为按实际剧集计数动态返回，页面仅作列表展示）
  assert.doesNotMatch(page, /计划集数/)
  // 硬编码风格列表已移除，预设来自 API
  assert.doesNotMatch(page, /\['realistic', 'anime'/)
  assert.match(page, /stylePresetAPI/)
  assert.match(page, /stylePresetAPI\.list\(\)/)
  assert.match(page, /styleLabel\(d\.style\)/)
  // 原「N 种视觉风格」统计已随首页双栏改造移除；侧栏「风格灵感」色板直接使用风格预设列表（API 数据），
  // 点击色板可预选该风格并进入新建流程（风格灵感锁定 → AI 提炼时优先采用）
  assert.match(page, /风格灵感/)
  assert.match(page, /stylePresets\.length/)
  assert.match(page, /stylePresets\.slice\(0, 6\)/)
  assert.match(page, /openCreateWithStyle\(/)
  assert.match(page, /inspirationStyle/)
})

test('useApi exposes style preset endpoints', () => {
  const useApi = read('app/composables/useApi.ts')

  assert.match(useApi, /analyzeSource/)
  assert.match(useApi, /\/dramas\/analyze-source/)
  assert.match(useApi, /stylePresetAPI/)
  assert.match(useApi, /\/style-presets/)
  assert.match(useApi, /\?all=1/)
})

test('settings page manages style presets in a base tab', () => {
  const settings = read('app/pages/settings.vue')

  assert.match(settings, /风格预设/)
  assert.match(settings, /Palette/)
  assert.match(settings, /stylePresetAPI/)
  assert.match(settings, /\{ id: 'styles', label: '风格预设'/)
  assert.match(settings, /startAddStyle/)
  assert.match(settings, /startEditStyle/)
  assert.match(settings, /toggleStyle/)
  assert.match(settings, /confirmDelStyle/)
  assert.match(settings, /styleToDelete/)
  assert.match(settings, /<ConfirmDialog/)
  assert.match(settings, /loadStylePresets/)
  // 设置页为常驻两级目录（原「Agent 高级配置」开关已移除），风格预设始终可达
  assert.doesNotMatch(settings, /advancedTabs\.some/)
  assert.doesNotMatch(settings, /showAdvanced/)
  assert.doesNotMatch(settings, /advanced-toggle/)
  // 风格 key 编辑时不可修改
  assert.match(settings, /:disabled="!!styleEditId"/)
  // image_prompt_generator 默认提示词副本同步更新
  assert.doesNotMatch(settings, /必须包含 "consistent art style"/)
})

test('adding a style reuses the unsaved-draft guard instead of dropping current edits', () => {
  const settings = read('app/pages/settings.vue')

  // 「添加风格」入口与「切换风格」一致：详情卡存在未保存修改时先弹三选确认，不直接重置草稿
  assert.match(settings, /function startAddStyle\(\) {/)
  assert.match(settings, /if \(styleDirty\.value && styleEditId\.value\) {/)
  assert.match(settings, /stylePromptSwitchId\.value = STYLE_ADD_FLAG/)
  assert.match(settings, /stylePromptOpen\.value = true/)
  // 新建目标标记与真正的弹窗新建流程
  assert.match(settings, /STYLE_ADD_FLAG = '__add_style__'/)
  assert.match(settings, /function openAddStyleDialog\(\) {/)
  // 「保存并新建 / 放弃新建」确认后都进入 openAddStyleDialog；取消则停留原地
  assert.match(settings, /if \(target === STYLE_ADD_FLAG\) openAddStyleDialog\(\)/)
  assert.match(settings, /stylePromptIsNew/)
  assert.match(settings, /stylePromptIsNew \? '新建风格会丢弃当前风格的未保存修改。'/)
})
