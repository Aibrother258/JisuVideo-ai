import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('GET /assets: SQL-pushed pagination with drama/episode reuse semantics preserved', () => {
  const src = read('src/routes/assets.ts')
  // 分页参数解析：parseInt + `|| 默认值` 兜底 NaN（page_size clamp 1-100，对齐 GET /dramas）
  assert.match(src, /const page = Math\.max\(1, Number\.parseInt\(c\.req\.query\('page'\) \|\| '1', 10\) \|\| 1\)/)
  assert.match(src, /const pageSize = Math\.min\(100, Math\.max\(1, Number\.parseInt\(c\.req\.query\('page_size'\) \|\| '20', 10\) \|\| 20\)\)/)
  // 数字过滤参数经 parseRecordId 收敛（NaN/非正数视为未传，不进入 SQL）
  assert.match(src, /const dramaId = parseRecordId\(c\.req\.query\('drama_id'\)\)/)
  assert.match(src, /const episodeId = parseRecordId\(c\.req\.query\('episode_id'\)\)/)
  // 过滤条件 SQL 下推：未删除 + 短剧归属（公共素材保留）+ 跨集排除 + type
  // （conds 带 `: SQL[]` 类型注解为类型收窄所需，用可选组匹配避免类型标注改动使测试误挂）
  assert.match(src, /const conds(?:: SQL\[\])? = \[isNull\(schema\.assets\.deletedAt\)\]/)
  // `!` 为非空断言（drizzle or/and 入参空时返回 undefined，dramaId 分支恒定非空）；可选组匹配容忍类型收窄写法变化
  assert.match(src, /if \(dramaId\) conds\.push\(or\(isNull\(schema\.assets\.dramaId\), eq\(schema\.assets\.dramaId, dramaId\)\)!?\)/)
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
  // 分页参数解析：parseInt + `|| 默认值` 兜底 NaN（clamp 与 GET /assets / GET /dramas 一致）
  assert.match(src, /const page = Math\.max\(1, Number\.parseInt\(c\.req\.query\('page'\) \|\| '1', 10\) \|\| 1\)/)
  assert.match(src, /const pageSize = Math\.min\(100, Math\.max\(1, Number\.parseInt\(c\.req\.query\('page_size'\) \|\| '20', 10\) \|\| 20\)\)/)
  // 数字过滤参数经 parseRecordId 收敛（NaN/非正数视为未传，不进入 SQL）
  assert.match(src, /const storyboardId = parseRecordId\(c\.req\.query\('storyboard_id'\)\)/)
  assert.match(src, /const dramaId = parseRecordId\(c\.req\.query\('drama_id'\)\)/)
  // 既有 type/storyboard_id/drama_id 条件下推保持
  assert.match(src, /if \(type\) conds\.push\(eq\(schema\.sysTask\.type, type\)\)/)
  assert.match(src, /if \(storyboardId\) conds\.push\(eq\(schema\.sysTask\.storyboardId, storyboardId\)\)/)
  assert.match(src, /if \(dramaId\) conds\.push\(eq\(schema\.sysTask\.dramaId, dramaId\)\)/)
  // count + limit/offset 下推：count 与 rows 共用同一 where（条件为空时 .where(undefined) 合法）
  assert.match(src, /const where = conds\.length \? and\(\.\.\.conds\) : undefined/)
  assert.match(src, /db\.select\(\{ value: count\(\) \}\)\.from\(schema\.sysTask\)\.where\(where\)/)
  assert.match(src, /\.limit\(pageSize\)\s*\.offset\(\(page - 1\) \* pageSize\)/)
  // 返回 { items: camelCase rows（与 GET /tasks/:id 一致）, pagination }
  assert.match(src, /items: rows,/)
  assert.match(src, /pagination: \{ page, page_size: pageSize, total, total_pages: Math\.ceil\(total \/ pageSize\) \}/)
})

test('GET /assets & GET /tasks keep legacy contract: no page/page_size -> full array (no silent truncation)', () => {
  const assets = read('src/routes/assets.ts')
  const tasks = read('src/routes/tasks.ts')
  // 兼容开关：只有显式传入 page / page_size 任一参数才启用分页
  for (const src of [assets, tasks]) {
    assert.match(src, /const paginated = c\.req\.query\('page'\) != null \|\| c\.req\.query\('page_size'\) != null/)
  }
  // 未分页分支：返回过滤/排序后的全量数组（无 limit/offset、无 pagination 元信息）
  assert.match(assets, /if \(!paginated\) \{[\s\S]*?return success\(c, rows\.map\(toSnakeCase\)\)/)
  assert.match(tasks, /if \(!paginated\) \{[\s\S]*?return success\(c, rows\)/)
  // 分页分支契约不变：仍返回 { items, pagination }
  assert.match(assets, /items: rows\.map\(toSnakeCase\),\s*pagination:/)
  assert.match(tasks, /items: rows,\s*pagination:/)
})

test('generation-tasks drawer endpoint stays { tasks, merges } (grouped view, not a paged list)', () => {
  // 任务抽屉按集聚合 + 状态分组渲染，保持 { tasks, merges } 全量语义；
  // 分页化随 D1 异步任务可视化专项评估，避免破坏分组/轮询数据流
  const ep = read('src/routes/episodes.ts')
  assert.match(ep, /tasks: toSnakeCaseArray\(tasks\)/)
  assert.match(ep, /merges: toSnakeCaseArray\(merges\)/)
  assert.match(ep, /\/:id\/generation-tasks/)
})
