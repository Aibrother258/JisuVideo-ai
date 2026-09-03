import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveScriptPanelState } from '../app/utils/episode-script-state.mjs'

// PR #47 P2 评审回归守卫：SCRIPT 面板 Step1 分支状态矩阵。
// 语义基线 = 拆分前 master：无剧本且全部空闲显示改写引导空态；script_rewriter 运行中显示整块加载态；
// 其余情况（含「空内容 + 其他 Agent 运行」）仍显示剧本文本编辑器（可手工编辑）。

const state = (over = {}) => resolveScriptPanelState({
  step: 1, hasContent: false, running: false, taskType: '',
  ...over,
})

test('step0 -> editor（原始内容编辑器）', () => {
  assert.equal(state({ step: 0, hasContent: false }), 'editor')
})

test('step1 无已保存剧本且全部空闲 -> empty-guide（改写引导空态）', () => {
  assert.equal(state({ hasContent: false, running: false }), 'empty-guide')
})

test('step1 无已保存剧本且 script_rewriter 运行中 -> rewriting（整块加载态）', () => {
  assert.equal(state({ hasContent: false, running: true, taskType: 'script_rewriter' }), 'rewriting')
})

test('step1 无已保存剧本但其他 Agent 运行 -> editor（回归守卫：仍可手工编辑）', () => {
  // P2 评审指出：旧条件 !(rn && rt === 'script_rewriter') 令本组合落入空态、无法手工编辑，
  // 且空态「开始改写」会被 useAgent 运行中守卫拦截 -> 同时造成不可编辑与误导按钮。
  assert.equal(state({ hasContent: false, running: true, taskType: 'character_writer' }), 'editor')
})

test('step1 已有剧本且全部空闲 -> editor', () => {
  assert.equal(state({ hasContent: true, running: false }), 'editor')
})

test('step1 已有剧本且 script_rewriter 运行中 -> rewriting', () => {
  assert.equal(state({ hasContent: true, running: true, taskType: 'script_rewriter' }), 'rewriting')
})

test('step1 已有剧本但其他 Agent 运行 -> editor（改写按钮在组件内经 running/taskType disabled）', () => {
  assert.equal(state({ hasContent: true, running: true, taskType: 'storyboard_breaker' }), 'editor')
})

test('step2 等未知步骤 -> editor（组件内由 step 渲染各自编辑器）', () => {
  assert.equal(state({ step: 2, hasContent: false, running: true, taskType: 'script_rewriter' }), 'editor')
})
