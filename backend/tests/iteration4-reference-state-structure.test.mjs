import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const schema = readFileSync(new URL('../src/db/schema.ts', import.meta.url), 'utf8')
const mysql = readFileSync(new URL('../src/db/mysql-schema.ts', import.meta.url), 'utf8')
const routes = readFileSync(new URL('../src/routes/storyboards.ts', import.meta.url), 'utf8')
const h3Tools = readFileSync(new URL('../src/agents/tools/storyboard-tools.ts', import.meta.url), 'utf8')
const frontend = readFileSync(new URL('../../frontend/app/views/drama/episode.vue', import.meta.url), 'utf8')

test('storyboard reference assets have a durable database relation', () => {
  assert.match(schema, /export const storyboardReferenceAssets/)
  assert.match(schema, /storyboard_reference_assets/)
  assert.match(mysql, /CREATE TABLE IF NOT EXISTS storyboard_reference_assets/)
  assert.match(mysql, /idx_storyboard_reference_assets_storyboard_id/)
})

test('storyboard reference assets expose replaceable API operations', () => {
  assert.match(routes, /reference-assets/)
  assert.match(routes, /storyboardReferenceAssets/)
  assert.match(routes, /media_role/)
})

test('H3 prompt persistence records source freshness metadata', () => {
  assert.match(schema, /minimaxH3SourceHash/)
  assert.match(schema, /minimaxH3GeneratedAt/)
  assert.match(mysql, /minimax_h3_source_hash/)
  assert.match(mysql, /minimax_h3_generated_at/)
  assert.match(h3Tools, /minimaxH3SourceHash/)
})

test('video UI separates inherited storyboard assets from extra production references', () => {
  assert.match(frontend, /已继承的分镜素材/)
  assert.match(frontend, /管理分镜绑定/)
  assert.match(frontend, /额外投产参考/)
  assert.match(frontend, /reference_snapshot/)
})
