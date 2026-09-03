import { test } from 'node:test'
import assert from 'node:assert/strict'

// 真实运行时行为测试：直接加载 usePagedList.ts（含 vue 依赖）。
// 需 Node ≥22.6 并启用类型剥离运行（npm test 脚本已带 --experimental-strip-types）：
//   node --experimental-strip-types --test tests/paged-list-hook-behavior.test.mjs
// 未启用类型剥离时（老命令直接 node --test）无法加载 .ts，此处整体 skip 而非报错。
let mod = null
let loadHint = ''
try {
  mod = await import('../app/composables/usePagedList.ts')
} catch (err) {
  loadHint = String(err?.message || err)
}
const { usePagedList } = mod ?? {}
const skip = loadHint ? `usePagedList.ts 加载失败（需 node --experimental-strip-types）：${loadHint}` : false

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
