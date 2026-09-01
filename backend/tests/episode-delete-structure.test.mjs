import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('episodes route exposes soft delete', () => {
  const route = read('src/routes/episodes.ts')

  assert.match(route, /app\.delete\('\/:id'/)
  assert.match(route, /set\(\{ deletedAt: now\(\)/)
  assert.match(route, /剧集不存在/)
  // 无硬删
  assert.doesNotMatch(route, /db\.delete\(schema\.episodes\)/)
})

test('drama queries exclude soft-deleted episodes', () => {
  const dramas = read('src/routes/dramas.ts')

  // 列表聚合与详情都过滤 deletedAt
  const matches = dramas.match(/isNull\(schema\.episodes\.deletedAt\)/g) || []
  assert.ok(matches.length >= 2, `expected >=2 deletedAt filters, got ${matches.length}`)
  // 新建集计算集号时保留软删记录，满足同项目集号永久唯一约束
  const episodes = read('src/routes/episodes.ts')
  assert.match(episodes, /where\(eq\(schema\.episodes\.dramaId, body\.drama_id\)\)/)
})
