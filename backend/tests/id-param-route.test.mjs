/**
 * 路由级行为测试：GET /assets 与 GET /tasks 数字过滤参数契约。
 *
 * 覆盖 owner 复核提出的契约要求：
 * 1. 未传 / 空串：不筛选，保持旧兼容行为；
 * 2. 合法十进制正整数：正常进入 eq() 过滤条件（非分页旧契约返回 200）；
 * 3. abc、-1、0、1.5、空格、超安全整数：返回 400，且数据库查询不执行。
 *
 * 说明：本测试会导入真实路由模块（src/routes/assets.ts / tasks.ts），
 * 而 backend/src/db/index.ts 顶层 `await initDb()` 需要本机 MySQL（127.0.0.1:3306）。
 * 因此本文件先做 TCP 探测：MySQL 不可达时跳过（与 merge-fastpath-and-timeout
 * 用例同样的环境依赖前提）；可达时导入路由并 stub db.select 断言「非法值不触库」。
 *
 * 运行：cd backend && npm test（或按需 node --import tsx/esm --test tests/id-param-route.test.mjs）。
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'

const mysqlUp = await new Promise((resolve) => {
  const socket = net.createConnection({ host: '127.0.0.1', port: 3306 })
  const done = (ok) => { socket.destroy(); resolve(ok) }
  socket.setTimeout(1200, () => done(false))
  socket.on('connect', () => done(true))
  socket.on('error', () => done(false))
})

let dbm = null
let assetsApp = null
let tasksApp = null
let originalSelect = null
let queryCount = 0

after(() => {
  if (dbm && originalSelect) dbm.db.select = originalSelect
})

// 无 MySQL 时默认跳过；设 MYSQL_NO_INIT=1 可强制运行（stub db.select，不触真实数据库）
const canRun = mysqlUp || process.env.MYSQL_NO_INIT === '1'
const SKIP_REASON = '本机未运行 MySQL 3306：db/index 顶层 initDb 依赖 MySQL；可设 MYSQL_NO_INIT=1 用 stub 强制运行本用例'

test('GET /assets & GET /tasks：数字过滤参数三态契约（非法→400 且不触库）', { skip: canRun ? false : SKIP_REASON }, async () => {
  dbm = await import('../src/db/index.js')
  const assetsModule = await import('../src/routes/assets.js')
  const tasksModule = await import('../src/routes/tasks.js')
  assetsApp = assetsModule.default
  tasksApp = tasksModule.default
  originalSelect = dbm.db.select

  // stub db.select：返回一个可 await 出 [] 的链式查询对象（列表与 count 共用）
  const installStub = () => {
    queryCount = 0
    const q = { then: (resolve) => resolve([]) }
    q.where = () => q
    q.groupBy = () => q
    q.orderBy = () => q
    q.limit = () => q
    q.offset = () => q
    dbm.db.select = () => {
      queryCount += 1
      return { from: () => q }
    }
  }

  const call = async (app, qs) => {
    installStub()
    const res = await app.request(`/?${qs}`)
    const body = await res.json().catch(() => ({}))
    return { status: res.status, body, queryCount }
  }

  const invalidValues = ['abc', '-1', '0', '1.5', '   ', '9007199254740992']

  // —— 非法值：400 + 数据库查询不执行 ——
  for (const [app, param] of [[assetsApp, 'drama_id'], [assetsApp, 'episode_id'], [tasksApp, 'storyboard_id'], [tasksApp, 'drama_id']]) {
    for (const value of invalidValues) {
      const r = await call(app, `${param}=${encodeURIComponent(value)}`)
      assert.equal(r.status, 400, `/${param}=${JSON.stringify(value)} 应返回 400，实际 ${r.status}`)
      assert.equal(r.body.code, 400)
      assert.equal(r.body.message, `${param} 参数必须是合法正整数`)
      assert.equal(r.queryCount, 0, `非法 ${param} 值不得执行数据库查询`)
    }
  }

  // —— 空串：视为未传（不 400、走正常过滤流程）——
  for (const [app, qs] of [[assetsApp, 'drama_id='], [assetsApp, 'episode_id='], [tasksApp, 'storyboard_id='], [tasksApp, 'drama_id=']]) {
    const r = await call(app, qs)
    assert.equal(r.status, 200, `空串 ${qs} 应视为未传返回 200，实际 ${r.status}`)
    assert.equal(r.body.code, 200)
    assert.equal(r.queryCount, 1, `空串 ${qs} 应走正常过滤流程（触库 1 次）`)
  }

  // —— 未传：不筛选，正常 200 ——
  for (const app of [assetsApp, tasksApp]) {
    const r = await call(app, '')
    assert.equal(r.status, 200)
    assert.equal(r.body.code, 200)
    assert.equal(r.queryCount, 1)
  }

  // —— 合法正整数：进入 eq 过滤、正常返回 200 ——
  const validCases = [
    [assetsApp, 'drama_id=7', 200],
    [assetsApp, 'drama_id=7&episode_id=3', 200],
    [assetsApp, 'episode_id=3', 200],
    [tasksApp, 'storyboard_id=5', 200],
    [tasksApp, 'drama_id=5', 200],
    [tasksApp, 'type=image&storyboard_id=5&drama_id=5', 200],
  ]
  for (const [app, qs, expectStatus] of validCases) {
    const r = await call(app, qs)
    assert.equal(r.status, expectStatus, `${qs} 应返回 ${expectStatus}，实际 ${r.status}`)
    assert.equal(r.body.code, 200)
    assert.equal(r.queryCount, 1, `${qs} 合法过滤应触库 1 次（非分页旧契约）`)
  }
})
