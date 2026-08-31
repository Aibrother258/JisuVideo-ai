import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('../app/views/drama/episode.vue', import.meta.url), 'utf8')

test('resizable workbench exposes all required resize handles', () => {
  for (const key of [
    'sidebarWidth', 'sidebarHeight', 'videoTaskListWidth',
    'videoPreviewHeight', 'videoWorkbenchHeight', 'storyboardListWidth',
    'storyboardReferenceWidth', 'storyboardDescriptionWidth',
    'storyboardVideoPromptHeight', 'storyboardWorkbenchHeight',
  ]) assert.match(source, new RegExp(`resetPanelSize\\('${key}'\\)`))
  assert.match(source, /pointerdown/)
  assert.match(source, /role="separator"/)
})

test('resizable workbench persists layout and supports keyboard reset', () => {
  assert.match(source, /PANEL_LAYOUT_STORE_KEY/)
  assert.match(source, /localStorage\.setItem\(PANEL_LAYOUT_STORE_KEY/)
  assert.match(source, /event\.key === 'Home'/)
  assert.match(source, /event\.shiftKey \? 48 : 16/)
})

test('resizable workbench cleans pointer handlers on unmount', () => {
  assert.match(source, /pointercancel/)
  assert.match(source, /activePanelResizeCleanup\?\.\(\)/)
  assert.match(source, /onBeforeUnmount\(\(\) => \{/)
})

test('resizable workbench keeps narrow layouts in a single column', () => {
  assert.match(source, /@media \(max-width: 900px\)/)
  assert.match(source, /@media \(max-width: 860px\)/)
  assert.match(source, /grid-template-columns: 1fr/)
})
