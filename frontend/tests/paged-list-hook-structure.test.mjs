import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const hook = read('../app/composables/usePagedList.ts')
const api = read('../app/composables/useApi.ts')
const index = read('../app/pages/index.vue')

test('B3 batch1: usePagedList hook self-contained + exposes paged-list contract', () => {
  // 组件/工具自包含 import（沿用 LoadingButton batch6/7 复核结论：不依赖全局自动注入）
  assert.match(hook, /import \{ computed, ref \} from 'vue'/)
  // 泛型 hook 签名 + 返回契约
  assert.match(hook, /export function usePagedList<T>\(fetcher: PagedFetcher<T>, options: UsePagedListOptions = \{\}\): UsePagedListReturn<T> \{/)
  assert.match(hook, /return \{ items, loading, loadingMore, loadError, page, pageSize, total, totalPages, hasMore, reload, loadMore, reset \}/)
  // 默认 page_size 对齐后端 GET /dramas 默认 20
  assert.match(hook, /const pageSize = options\.pageSize \?\? 20/)
  // 查询参数拼装：page/page_size 由 hook 计算 + fixed 固定参数随附
  assert.match(hook, /function buildQuery\(p: number\): PagedFetchQuery \{/)
  assert.match(hook, /return \{ page: p, page_size: pageSize, \.\.\.fixed \}/)
  // 整载替换 vs 追加合并两态
  assert.match(hook, /items\.value = append \? \[\.\.\.items\.value, \.\.\.incoming\] : incoming/)
  // 分页元信息吸收 total/total_pages，缺省视为一次取全（hasMore 由 total_pages 判定）
  assert.match(hook, /total\.value = meta\?\.total \?\? 0/)
  assert.match(hook, /hasMore = computed\(\(\) => ready\.value && totalPages\.value > page\.value\)/)
  // 行为入口：reload→第 1 页整载 / loadMore→下一页追加 / reset→回未加载态
  assert.match(hook, /async function reload\(\) \{/)
  assert.match(hook, /await fetchPage\(1, false\)/)
  assert.match(hook, /async function loadMore\(\) \{/)
  assert.match(hook, /await fetchPage\(page\.value \+ 1, true\)/)
  assert.match(hook, /function reset\(\) \{/)
  assert.match(hook, /page\.value = 0/)
})

test('B3 batch1: dramaAPI.list accepts page/page_size/keyword/status and keeps no-arg backward compat', () => {
  // list 签名扩展分页/过滤参数（后端 GET /dramas 已支持）
  assert.match(api, /list: \(params\?: \{ page\?: number; page_size\?: number; keyword\?: string; status\?: string \}\) => \{/)
  assert.match(api, /if \(params\?\.page\) query\.set\('page', String\(params\.page\)\)/)
  assert.match(api, /if \(params\?\.page_size\) query\.set\('page_size', String\(params\.page_size\)\)/)
  assert.match(api, /if \(params\?\.keyword\) query\.set\('keyword', params\.keyword\)/)
  assert.match(api, /if \(params\?\.status\) query\.set\('status', params\.status\)/)
  // 返回结构带 pagination 元信息
  assert.match(api, /pagination\?: \{ page: number; page_size: number; total: number; total_pages: number \}/)
  // 无参调用仍走 /dramas（空 query 不加 ?，兼容现有 index/detail 调用）
  assert.match(api, /\/dramas\$\{query\.size \? `\?\$\{query\.toString\(\)\}` : ''\}/)
  assert.match(api, /list: \(params\?:/)
  // 注释说明缺省等价 page=1&page_size=20（后端默认）
  assert.match(api, /缺省等价 page=1&page_size=20/)
})

test('B3 batch1: pure new-line — usePagedList not yet wired into pages (integration awaits stats-sidebar decision)', () => {
  // hook 本体纯新增；分页主列表接入需先裁决「统计侧栏依赖全量 dramas」数据流
  assert.doesNotMatch(index, /usePagedList/)
  assert.doesNotMatch(index, /page_size/)
})
