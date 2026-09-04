import { test } from 'node:test'
import assert from 'node:assert/strict'

// 真实运行时行为测试：直接加载 usePagedList.ts（含 vue 依赖）。
// 默认命令 npm test 经 tsx 加载 TS（node --import tsx/esm，Node ≥18，与 backend
// 既有测试模式一致，不依赖 Node 22 的 --experimental-strip-types，保持项目
// Node 20 Docker 基线可运行）。运行：
//   cd frontend && npm test
// 或指定文件：node --import tsx/esm --test tests/paged-list-hook-behavior.test.mjs
// 仅当未显式启用任何 TS 加载器（老命令直接 node --test）且加载失败时整体 skip
// 并提示；默认/显式加载器下加载失败属于真实失败：打印 FATAL 并置退出码非 0。
let mod = null
let loadHint = ''
const tsLoaderEnabled = process.execArgv
  .concat(process.argv)
  .some((a) => a.includes('tsx') || a.includes('strip-types'))
try {
  mod = await import('../app/composables/usePagedList.ts')
} catch (err) {
  loadHint = String(err?.message || err)
}
const { usePagedList } = mod ?? {}
let skip = false
if (loadHint) {
  if (tsLoaderEnabled) {
    // TS 加载器已启用仍加载失败 = 源码/依赖真实错误，必须失败而非跳过
    console.error(`FATAL: usePagedList.ts 加载失败（TS 加载器已启用）：\n${loadHint}`)
    process.exitCode = 1
    skip = `usePagedList.ts 加载失败（见上方 FATAL，本组按失败计，退出码非 0）`
  } else {
    skip = `usePagedList.ts 加载失败。请用默认命令 npm test（tsx 加载 TS，Node ≥18）运行本文件；老命令直接 node --test 无法加载 .ts。原始错误：${loadHint}`
  }
}

function makeDeferredFetcher() {
  const calls = [] // { query, resolve, reject }
  const fetcher = (query) => new Promise((resolve, reject) => {
    calls.push({ query, resolve, reject })
  })
  return { fetcher, calls }
}

const pagePayload = (items, pagination) => ({ items, pagination })

test('B3 review #43 behavior: sequential reload → loadMore appends in order', { skip }, async () => {
  const { fetcher, calls } = makeDeferredFetcher()
  const paged = usePagedList(fetcher, { pageSize: 20 })

  const r1 = paged.reload()
  assert.equal(calls.length, 1)
  calls[0].resolve(pagePayload([{ id: 1 }], { page: 1, page_size: 20, total: 40, total_pages: 2 }))
  await r1
  assert.deepEqual(paged.items.value, [{ id: 1 }])
  assert.equal(paged.page.value, 1)
  assert.equal(paged.hasMore.value, true)

  const lm = paged.loadMore()
  assert.equal(calls.length, 2)
  assert.equal(calls[1].query.page, 2)
  calls[1].resolve(pagePayload([{ id: 2 }], { page: 2, page_size: 20, total: 40, total_pages: 2 }))
  await lm
  assert.deepEqual(paged.items.value, [{ id: 1 }, { id: 2 }])
  assert.equal(paged.page.value, 2)
  assert.equal(paged.loadingMore.value, false)
  assert.equal(paged.loadError.value, '')
})

test('B3 review #43 behavior: stale page-2 response is dropped when reload preempts in-flight loadMore', { skip }, async () => {
  const { fetcher, calls } = makeDeferredFetcher()
  const paged = usePagedList(fetcher, { pageSize: 20 })

  const r1 = paged.reload()
  calls[0].resolve(pagePayload([{ id: 1, gen: 'a' }], { page: 1, page_size: 20, total: 40, total_pages: 2 }))
  await r1

  // 第 2 页追加请求在途（慢响应）……
  const lm = paged.loadMore()
  assert.equal(calls.length, 2)
  // ……期间执行 reload（其第 1 页响应先返回）……
  const r2 = paged.reload()
  assert.equal(calls.length, 3)
  calls[2].resolve(pagePayload([{ id: 1, gen: 'b' }], { page: 1, page_size: 20, total: 20, total_pages: 1 }))
  await r2
  assert.deepEqual(paged.items.value, [{ id: 1, gen: 'b' }])
  assert.equal(paged.page.value, 1)
  assert.equal(paged.totalPages.value, 1)

  // ……旧第 2 页随后返回：必须被丢弃，不得追加污染新列表或覆盖 page/meta
  calls[1].resolve(pagePayload([{ id: 2, gen: 'a' }], { page: 2, page_size: 20, total: 40, total_pages: 2 }))
  await lm

  assert.deepEqual(paged.items.value, [{ id: 1, gen: 'b' }])
  assert.equal(paged.items.value.length, 1)
  assert.equal(paged.page.value, 1)
  assert.equal(paged.total.value, 20)
  assert.equal(paged.totalPages.value, 1)
  assert.equal(paged.hasMore.value, false)
  assert.equal(paged.loadingMore.value, false)
  assert.equal(paged.loadError.value, '')
})

test('B3 review #43 behavior: reset invalidates in-flight loadMore response', { skip }, async () => {
  const { fetcher, calls } = makeDeferredFetcher()
  const paged = usePagedList(fetcher, { pageSize: 20 })

  const r1 = paged.reload()
  calls[0].resolve(pagePayload([{ id: 1 }], { page: 1, page_size: 20, total: 40, total_pages: 2 }))
  await r1

  const lm = paged.loadMore() // 第 2 页在途
  paged.reset()
  assert.deepEqual(paged.items.value, [])
  assert.equal(paged.page.value, 0)
  assert.equal(paged.hasMore.value, false)
  assert.equal(paged.loadingMore.value, false)

  // 在途第 2 页返回：过期丢弃，状态保持未加载
  calls[1].resolve(pagePayload([{ id: 2 }], { page: 2, page_size: 20, total: 40, total_pages: 2 }))
  await lm
  assert.deepEqual(paged.items.value, [])
  assert.equal(paged.page.value, 0)
  assert.equal(paged.loadError.value, '')

  // 作废后 reload 仍可用（新代次）
  const r2 = paged.reload()
  calls[2].resolve(pagePayload([{ id: 3 }], { page: 1, page_size: 20, total: 20, total_pages: 1 }))
  await r2
  assert.deepEqual(paged.items.value, [{ id: 3 }])
})

test('B3 review #43 behavior: fixed cannot override hook-computed page/page_size', { skip }, async () => {
  const { fetcher, calls } = makeDeferredFetcher()
  const paged = usePagedList(fetcher, { pageSize: 5, fixed: { status: 'draft', page: 99, page_size: 999 } })

  const r1 = paged.reload()
  assert.deepEqual(calls[0].query, { status: 'draft', page: 1, page_size: 5 })
  calls[0].resolve(pagePayload([{ id: 1 }], { page: 1, page_size: 5, total: 25, total_pages: 5 }))
  await r1

  const lm = paged.loadMore()
  assert.deepEqual(calls[1].query, { status: 'draft', page: 2, page_size: 5 })
  calls[1].resolve(pagePayload([{ id: 2 }], { page: 2, page_size: 5, total: 25, total_pages: 5 }))
  await lm
  assert.equal(paged.page.value, 2)
})

test('review: loadMore failure keeps loaded items, sets loadMoreError only, and retry reloads just the failed page', { skip }, async () => {
  const { fetcher, calls } = makeDeferredFetcher()
  const paged = usePagedList(fetcher, { pageSize: 60 })

  const r1 = paged.reload()
  calls[0].resolve(pagePayload([{ id: 1 }], { page: 1, page_size: 60, total: 120, total_pages: 2 }))
  await r1
  assert.deepEqual(paged.items.value, [{ id: 1 }])
  assert.equal(paged.loadError.value, '')

  // 第 2 页追加失败：已加载的第 1 页原样保留、loadError 不被污染，错误只落在 loadMoreError
  const lm = paged.loadMore()
  calls[1].reject(new Error('network boom'))
  await lm
  assert.deepEqual(paged.items.value, [{ id: 1 }])
  assert.equal(paged.page.value, 1)
  assert.equal(paged.loadError.value, '')
  assert.equal(paged.loadMoreError.value, 'network boom')
  assert.equal(paged.hasMore.value, true) // 失败不推进页码，仍可重试

  // 重试只重拉失败那一页（page 2），成功后追加并清空 loadMoreError
  const retry = paged.loadMore()
  assert.equal(calls.length, 3)
  assert.equal(calls[2].query.page, 2)
  calls[2].resolve(pagePayload([{ id: 2 }], { page: 2, page_size: 60, total: 120, total_pages: 2 }))
  await retry
  assert.deepEqual(paged.items.value, [{ id: 1 }, { id: 2 }])
  assert.equal(paged.loadMoreError.value, '')
  assert.equal(paged.loadError.value, '')
})

test('review: picker fetcher carries kind as type so server filters before pagination (mixed first page cannot starve target kind)', { skip }, async () => {
  const { fetcher, calls } = makeDeferredFetcher()
  const paged = usePagedList((q) => fetcher({ ...q, type: 'video' }), { pageSize: 60 })

  // 场景：素材库最新 60 条全是图片、视频排在后续页。请求必须携带 type=video，
  // 服务端先按媒体类型过滤再分页——否则第 1 页视频为空且「加载更多」入口消失。
  const r1 = paged.reload()
  assert.equal(calls[0].query.type, 'video')
  assert.equal(calls[0].query.page, 1)
  calls[0].resolve(pagePayload(
    Array.from({ length: 60 }, (_, i) => ({ id: i + 1, type: 'video' })),
    { page: 1, page_size: 60, total: 61, total_pages: 2 },
  ))
  await r1
  assert.equal(paged.items.value.length, 60)
  assert.equal(paged.items.value.every((a) => a.type === 'video'), true)

  // 第 2 页仍带 type，追加取到后续页视频（前端按 kind 过滤时不再出现「暂无视频」假空态）
  const lm = paged.loadMore()
  assert.equal(calls[1].query.type, 'video')
  assert.equal(calls[1].query.page, 2)
  calls[1].resolve(pagePayload([{ id: 999, type: 'video' }], { page: 2, page_size: 60, total: 61, total_pages: 2 }))
  await lm
  assert.equal(paged.items.value.length, 61)
  assert.equal(paged.hasMore.value, false)
})

test('B3 review #43 behavior: stale failure is dropped and does not overwrite fresh error state', { skip }, async () => {
  const { fetcher, calls } = makeDeferredFetcher()
  const paged = usePagedList(fetcher, { pageSize: 20 })

  const r1 = paged.reload()
  calls[0].resolve(pagePayload([{ id: 1 }], { page: 1, page_size: 20, total: 40, total_pages: 2 }))
  await r1

  const lm = paged.loadMore() // 在途，随后将失败
  const r2 = paged.reload() // 新整载先返回并清空错误态
  calls[2].resolve(pagePayload([{ id: 9 }], { page: 1, page_size: 20, total: 20, total_pages: 1 }))
  await r2

  calls[1].reject(new Error('stale boom'))
  await lm

  assert.deepEqual(paged.items.value, [{ id: 9 }])
  assert.equal(paged.loadError.value, '')
  assert.equal(paged.loadingMore.value, false)
})
