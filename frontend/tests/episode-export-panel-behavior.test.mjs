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

// P2 复审：composable 以 getter 读「当前」episodeId。测试内用 setEp 模拟剧集切换
// （含“已切换但尚未发出第二次请求”与“置 0”场景，旧实现无法覆盖）。
function makeCtl(fetchMerges, initialEp = 7) {
  let currentEp = initialEp
  const ctl = useExportMergesList(fetchMerges, () => currentEp)
  return { ctl, setEp: (v) => { currentEp = v } }
}

test('P1 #45 behavior: B(listRev silent) 先成功、A(挂载 initial) 后成功 -> 保持 B 列表', { skip }, async () => {
  const { fetchMerges, calls } = makeDeferred()
  const { ctl } = makeCtl(fetchMerges)

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
  const { ctl } = makeCtl(fetchMerges)

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
  const { ctl } = makeCtl(fetchMerges)

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
  const { ctl } = makeCtl(fetchMerges)

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
  const { ctl, setEp } = makeCtl(fetchMerges, 1) // 初始当前剧集 = 1

  const old = ctl.loadExportMerges(1, true) // 剧集 1 initial（慢）
  setEp(2)                                  // 当前剧集切到 2
  const now = ctl.loadExportMerges(2, true) // 剧集 2 initial（快）
  calls[1].resolve([{ id: 'ep2-new' }])
  await now
  assert.deepEqual(ctl.exportMerges.value.map((x) => x.id), ['ep2-new'])

  // 剧集 1 的旧响应迟到：经 getter 校验当前剧集已是 2，不得覆盖剧集 2 的列表或写错误
  calls[0].resolve([{ id: 'ep1-old' }])
  await old
  assert.deepEqual(ctl.exportMerges.value.map((x) => x.id), ['ep2-new'])
  assert.equal(ctl.exportListError.value, '')
  assert.equal(ctl.exportListLoading.value, false)
})

test('P1 #45 复审: A(initial) 在途、B(silent) 先失败 -> A 后成功仍落盘（不得误显“暂无成片”）', { skip }, async () => {
  const { fetchMerges, calls } = makeDeferred()
  const { ctl } = makeCtl(fetchMerges)

  const a = ctl.loadExportMerges(7, true) // A: 挂载 initial（慢，随后成功）
  assert.equal(ctl.exportListLoading.value, true)
  const b = ctl.loadExportMerges(7)       // B: listRev silent（后发、先失败）
  calls[1].reject(new Error('silent boom'))
  await b
  // B 失败：不得作废在途 A，也不得提前关闭其 loading（骨架应保留到 A 落定）
  assert.equal(ctl.exportListLoading.value, true)
  assert.equal(ctl.exportListError.value, '')

  calls[0].resolve([{ id: 'A-list' }])
  await a
  // 最终必须展示 A 的列表，不能是无错误空态
  assert.deepEqual(ctl.exportMerges.value.map((x) => x.id), ['A-list'])
  assert.equal(ctl.exportListError.value, '')
  assert.equal(ctl.exportListLoading.value, false)
})

test('P1 #45 复审: A/B 都失败 -> initial 呈现错误、silent 不写错误、loading 收尾', { skip }, async () => {
  const { fetchMerges, calls } = makeDeferred()
  const { ctl } = makeCtl(fetchMerges)

  const a = ctl.loadExportMerges(7, true) // A: initial
  const b = ctl.loadExportMerges(7)       // B: silent（先失败）
  calls[1].reject(new Error('silent boom'))
  await b
  assert.equal(ctl.exportListError.value, '')
  assert.equal(ctl.exportListLoading.value, true) // silent 失败不关闭 initial 的 loading

  calls[0].reject(new Error('initial boom'))
  await a
  assert.deepEqual(ctl.exportMerges.value, [])
  assert.equal(ctl.exportListError.value, 'initial boom')
  assert.equal(ctl.exportListLoading.value, false)
})

test('P2 #45 复审: 当前剧集已切换但第二次请求未发出 -> 旧响应必须被丢弃', { skip }, async () => {
  const { fetchMerges, calls } = makeDeferred()
  const { ctl, setEp } = makeCtl(fetchMerges, 7)

  const a = ctl.loadExportMerges(7, true) // 剧集 7 initial（慢）
  assert.equal(ctl.exportListLoading.value, true)
  setEp(9)                                // 剧集已切到 9，但尚未发起第二次请求
  calls[0].resolve([{ id: 'ep7-old' }])
  await a
  // 旧剧集响应作废：不写列表、不写错误；作为被抛弃的最新 initial 回收 loading 防骨架悬挂
  assert.deepEqual(ctl.exportMerges.value, [])
  assert.equal(ctl.exportListError.value, '')
  assert.equal(ctl.exportListLoading.value, false)
})

test('P2 #45 复审: episodeId 置 0 后旧响应同样不能写回', { skip }, async () => {
  const { fetchMerges, calls } = makeDeferred()
  const { ctl, setEp } = makeCtl(fetchMerges, 7)

  const a = ctl.loadExportMerges(7, true) // 剧集 7 initial（慢）
  setEp(0)                                // 剧集被清空（删除/切离），load 会提前 return 不递增序号
  calls[0].resolve([{ id: 'ep7-old' }])
  await a
  assert.deepEqual(ctl.exportMerges.value, [])
  assert.equal(ctl.exportListError.value, '')
  assert.equal(ctl.exportListLoading.value, false)
})

test('P1 #45 behavior: 无并发时 initial 失败仍正常呈现内联错误并可重试', { skip }, async () => {
  const { fetchMerges, calls } = makeDeferred()
  const { ctl } = makeCtl(fetchMerges)

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
