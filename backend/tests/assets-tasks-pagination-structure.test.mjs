import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('GET /assets: SQL-pushed pagination with drama/episode reuse semantics preserved', () => {
  const src = read('src/routes/assets.ts')
  // 分页参数解析（page_size clamp 1-100，对齐 GET /dramas）
  assert.match(src, /const page = Math\.max\(1, Number\(c\.req\.query\('page'\) \|\| 1\)\)/)
  assert.match(src, /const pageSize = Math\.min\(100, Math\.max\(1, Number\(c\.req\.query\('page_size'\) \|\| 20\)\)\)/)
  // 过滤条件 SQL 下推：未删除 + 短剧归属（公共素材保留）+ 跨集排除 + type
  assert.match(src, /const conds = \[isNull\(schema\.assets\.deletedAt\)\]/)
  assert.match(src, /if \(dramaId\) conds\.push\(or\(isNull\(schema\.assets\.dramaId\), eq\(schema\.assets\.dramaId, dramaId\)\)\)/)
  assert.match(src, /isNotNull\(schema\.assets\.episodeId\)/)
  assert.match(src, /ne\(schema\.assets\.episodeId, episodeId\)/)
  assert.match(src, /if \(type\) conds\.push\(eq\(schema\.assets\.type, type\)\)/)
  // count + limit/offset 下推，不再全表内存过滤/内存排序
  assert.match(src, /db\.select\(\{ value: count\(\) \}\)\.from\(schema\.assets\)\.where\(where\)/)
  assert.match(src, /\.orderBy\(desc\(schema\.assets\.createdAt\)\)/)
  assert.match(src, /\.limit\(pageSize\)\s*\.offset\(\(page - 1\) \* pageSize\)/)
  // 返回 { items: snake_case, pagination }
  assert.match(src, /items: rows\.map\(toSnakeCase\)/)
  assert.match(src, /pagination: \{ page, page_size: pageSize, total, total_pages: Math\.ceil\(total \/ pageSize\) \}/)
})

test('GET /tasks: existing SQL filters gain page/page_size and { items, pagination } envelope', () => {
  const src = read('src/routes/tasks.ts')
  // 分页参数解析（clamp 与 GET /assets / GET /dramas 一致）
  assert.match(src, /const page = Math\.max\(1, Number\(c\.req\.query\('page'\) \|\| 1\)\)/)
  assert.match(src, /const pageSize = Math\.min\(100, Math\.max\(1, Number\(c\.req\.query\('page_size'\) \|\| 20\)\)\)/)
  // 既有 type/storyboard_id/drama_id 条件下推保持
  assert.match(src, /if \(type\) conds\.push\(eq\(schema\.sysTask\.type, type\)\)/)
  assert.match(src, /if \(storyboardId\) conds\.push\(eq\(schema\.sysTask\.storyboardId, Number\(storyboardId\)\)\)/)
  assert.match(src, /if \(dramaId\) conds\.push\(eq\(schema\.sysTask\.dramaId, Number\(dramaId\)\)\)/)
  // count + limit/offset 下推
  assert.match(src, /db\.select\(\{ value: count\(\) \}\)\.from\(schema\.sysTask\)/)
  assert.match(src, /\.limit\(pageSize\)\s*\.offset\(\(page - 1\) \* pageSize\)/)
  // 返回 { items: camelCase rows（与 GET /tasks/:id 一致）, pagination }
  assert.match(src, /items: rows,/)
  assert.match(src, /pagination: \{ page, page_size: pageSize, total, total_pages: Math\.ceil\(total \/ pageSize\) \}/)
})

test('generation-tasks drawer endpoint stays { tasks, merges } (grouped view, not a paged list)', () => {
  // 任务抽屉按集聚合 + 状态分组渲染，保持 { tasks, merges } 全量语义；
  // 分页化随 D1 异步任务可视化专项评估，避免破坏分组/轮询数据流
  const ep = read('src/routes/episodes.ts')
  assert.match(ep, /tasks: toSnakeCaseArray\(tasks\)/)
  assert.match(ep, /merges: toSnakeCaseArray\(merges\)/)
  assert.match(ep, /\/:id\/generation-tasks/)
})
