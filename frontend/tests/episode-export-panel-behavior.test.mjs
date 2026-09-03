import { test } from 'node:test'
import assert from 'node:assert/strict'

// P1 评审修复（PR #45）回归测试：EpisodeExportPanel 成片列表三路并发读取必须“最新请求获胜”。
// 直接加载 useExportMergesList.ts（纯逻辑 + vue ref），以受控 Promise 精确编排响应顺序。
// 运行：cd frontend && npm test
let mod = null
let loadHint = ''
const tsLoaderEnabled = process.execArgv
  .concat(process.argv)
  .some((a) => a.includes('tsx') || a.includes('strip-types'))
try {
  mod = await import('../app/composables/useExportMergesList.ts')
} catch (err) {
  loadHint = String(err?.message || err)
}
const { useExportMergesList } = mod ?? {}
let skip = false
if (loadHint) {
  if (tsLoaderEnabled) {
    console.error(`FATAL: useExportMergesList.ts 加载失败（TS 加载器已启用）：\n${loadHint}`)
    process.exitCode = 1
    skip = `useExportMergesList.ts 加载失败（见上方 FATAL，本组按失败计，退出码非 0）`
  } else {
    skip = `useExportMergesList.ts 加载失败。请用默认命令 npm test（tsx 加载 TS，Node ≥18）运行本文件；原始错误：${loadHint}`
  }
}

function makeDeferred() {
  const calls = [] // { episodeId, resolve, reject }
  const fetchMerges = (episodeId) => new Promise((resolve, reject) => {
    calls.push({ episodeId, resolve, reject })
  })
  return { fetchMerges, calls }
}

test('P1 #45 behavior: B(listRev silent) 先成功、A(挂载 initial) 后成功 -> 保持 B 列表', { skip }, async () => {
  const { fetchMerges, calls } = makeDeferred()
  const ctl = useExportMergesList(fetchMerges)

  const a = ctl.loadExportMerges(7, true) // A: 面板挂载 initial
  assert.equal(calls.length, 1)
  assert.equal(ctl.exportListLoading.value, true)

  const b = ctl.loadExportMerges(7) // B: listRev 静默刷新（后发）
  assert.equal(calls.length, 2)

  // B 先成功
  calls[1].resolve([{ id: 'B1' }])
  await b
  assert.deepEqual(ctl.exportMerges.value.map((x) => x.id), ['B1'])

  // A 后成功（旧数据）：必须被丢弃，不得覆盖 B 的最新列表
  calls[0].resolve([{ id: 'A1', stale: true }])
  await a
  assert.deepEqual(ctl.exportMerges.value.map((x) => x.id), ['B1'])
  assert.equal(ctl.exportListError.value, '')
  // 旧 A 的 finally 不得改写 loading（B 是最新请求，已统一收尾 -> false）
  assert.equal(ctl.exportListLoading.value, false)
})

test('P1 #45 behavior: A 后失败（晚于 B 成功）-> 不写错误横幅，保持 B 列表', { skip }, async () => {
  const { fetchMerges, calls } = makeDeferred()
  const ctl = useExportMergesList(fetchMerges)

  const a = ctl.loadExportMerges(7, true) // A: initial，随后将失败
  const b = ctl.loadExportMerges(7)       // B: silent，先成功
  calls[1].resolve([{ id: 'B2' }])
  await b
  assert.deepEqual(ctl.exportMerges.value.map((x) => x.id), ['B2'])

  // 旧 initial 请求的失败不得重新写入 exportListError 覆盖已成功刷新的列表
  calls[0].reject(new Error('stale boom'))
  await a
  assert.deepEqual(ctl.exportMerges.value.map((x) => x.id), ['B2'])
  assert.equal(ctl.exportListError.value, '')
  assert.equal(ctl.exportListLoading.value, false)
})

test('P1 #45 behavior: 手动刷新(initial2)先成功、旧 initial1 后完成 -> 保持新列表且 loading 由最新请求收尾', { skip }, async () => {
  const { fetchMerges, calls } = makeDeferred()
  const ctl = useExportMergesList(fetchMerges)

  const a = ctl.loadExportMerges(7, true)  // A: 挂载 initial（慢）
  assert.equal(ctl.exportListLoading.value, true)
  const c = ctl.loadExportMerges(7, true)  // C: 用户点击“刷新”（新的 initial）
  assert.equal(calls.length, 2)

  // C 先成功
  calls[1].resolve([{ id: 'C3' }])
  await c
  assert.deepEqual(ctl.exportMerges.value.map((x) => x.id), ['C3'])

  // A 后成功：旧列表不得覆盖 C；A 的 finally 也不得提前关闭 C 已管理的 loading
  calls[0].resolve([{ id: 'A1' }])
  await a
  assert.deepEqual(ctl.exportMerges.value.map((x) => x.id), ['C3'])
  assert.equal(ctl.exportListError.value, '')
  assert.equal(ctl.exportListLoading.value, false)
})

test('P1 #45 behavior: 卸载后迟到响应一律丢弃（成功与失败均不写状态）', { skip }, async () => {
  const { fetchMerges, calls } = makeDeferred()
  const ctl = useExportMergesList(fetchMerges)

  const a = ctl.loadExportMerges(7, true)
  const b = ctl.loadExportMerges(7) // silent，在途
  ctl.setActive(false)              // 模拟面板卸载（切 tab / 剧集切换）

  calls[0].resolve([{ id: 'A1' }])
  await a
  calls[1].reject(new Error('unmount boom'))
  await b

  assert.deepEqual(ctl.exportMerges.value, [])
  assert.equal(ctl.exportListError.value, '')
  assert.equal(ctl.exportListLoading.value, true) // 卸载后不写状态，loading 保持启动态（实例已销毁，无 UI 影响）
})

test('P1 #45 behavior: episodeId 变更后旧剧集迟到响应被丢弃（不污染新剧集列表）', { skip }, async () => {
  const { fetchMerges, calls } = makeDeferred()
  const ctl = useExportMergesList(fetchMerges)

  const old = ctl.loadExportMerges(1, true) // 剧集 1 initial（慢）
  const now = ctl.loadExportMerges(2, true) // 剧集 2 initial（快）
  calls[1].resolve([{ id: 'ep2-new' }])
  await now
  assert.deepEqual(ctl.exportMerges.value.map((x) => x.id), ['ep2-new'])

  // 剧集 1 的旧响应迟到：不得覆盖剧集 2 的列表或写错误
  calls[0].resolve([{ id: 'ep1-old' }])
  await old
  assert.deepEqual(ctl.exportMerges.value.map((x) => x.id), ['ep2-new'])
  assert.equal(ctl.exportListError.value, '')
  assert.equal(ctl.exportListLoading.value, false)
})

test('P1 #45 behavior: 无并发时 initial 失败仍正常呈现内联错误并可重试', { skip }, async () => {
  const { fetchMerges, calls } = makeDeferred()
  const ctl = useExportMergesList(fetchMerges)

  const a = ctl.loadExportMerges(7, true)
  calls[0].reject(new Error('boom'))
  await a
  assert.equal(ctl.exportListError.value, 'boom')
  assert.equal(ctl.exportListLoading.value, false)
  assert.deepEqual(ctl.exportMerges.value, [])

  // 重试成功 -> 清除错误并写入列表
  const r = ctl.loadExportMerges(7, true)
  calls[1].resolve([{ id: 'R1' }])
  await r
  assert.equal(ctl.exportListError.value, '')
  assert.deepEqual(ctl.exportMerges.value.map((x) => x.id), ['R1'])
  assert.equal(ctl.exportListLoading.value, false)
})
