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
  // 查询参数拼装：fixed 先展开、page/page_size 后写覆盖（固定筛选不能覆盖分页参数）
  assert.match(hook, /function buildQuery\(p: number\): PagedFetchQuery \{/)
  assert.match(hook, /return \{ \.\.\.fixed, page: p, page_size: pageSize \}/)
  // 整载替换 vs 追加合并两态
  assert.match(hook, /items\.value = append \? \[\.\.\.items\.value, \.\.\.incoming\] : incoming/)
  // 分页元信息吸收 total/total_pages，缺省视为一次取全（hasMore 由 total_pages 判定）
  assert.match(hook, /total\.value = meta\?\.total \?\? 0/)
  assert.match(hook, /hasMore = computed\(\(\) => ready\.value && totalPages\.value > page\.value\)/)
  // 行为入口：reload→第 1 页整载 / loadMore→下一页追加 / reset→回未加载态
  assert.match(hook, /async function reload\(\) \{/)
  assert.match(hook, /await fetchPage\(1, false, loading\)/)
  assert.match(hook, /async function loadMore\(\) \{/)
  assert.match(hook, /await fetchPage\(page\.value \+ 1, true, loadingMore\)/)
  assert.match(hook, /function reset\(\) \{/)
  assert.match(hook, /page\.value = 0/)
})

test('B3 batch2 (review #43): stale-response guard — request seq, reset invalidation, reload preempts in-flight loadMore', () => {
  // 请求代次：每次发起请求递增；reset 再递增作废全部在途请求
  assert.match(hook, /let requestSeq = 0/)
  assert.match(hook, /function reset\(\) \{/)
  assert.match(hook, /requestSeq\+\+ \/\/ 使所有在途请求过期/)
  // 发起请求即绑定代次，响应回来先校验是否仍为最新
  assert.match(hook, /async function fetchPage\(p: number, append: boolean, flag: Ref<boolean>\) \{/)
  assert.match(hook, /const seq = \+\+requestSeq/)
  // 过期成功响应丢弃（不写 items/meta/page）；过期失败同样丢弃（不覆盖新错误态）
  assert.match(hook, /if \(seq !== requestSeq\) return \/\/ 过期响应/)
  assert.match(hook, /if \(seq !== requestSeq\) return \/\/ 过期失败同样丢弃/)
  // flag 复位仅限自身仍是最新请求时；过期请求的 flag 由接管方（reload/reset）复位
  assert.match(hook, /if \(seq === requestSeq\) flag\.value = false/)
  // reload 接管在途 loadMore：先复位其 flag 再整载
  assert.match(hook, /loadingMore\.value = false \/\/ 接管在途 loadMore/)
  // loadMore 在整载/追加在途时忽略
  assert.match(hook, /if \(loading\.value \|\| loadingMore\.value\) return/)
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
