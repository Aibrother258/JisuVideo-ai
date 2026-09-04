/**
 * 路由级行为测试：GET /assets 与 GET /tasks 数字过滤参数契约。
 *
 * 覆盖 owner 复核验收要求（必须真实执行、不允许静默 skip）：
 * 1. 未传 / 空串：不筛选，保持旧兼容行为；
 * 2. 合法十进制正整数：正常进入 eq() 过滤条件（非分页旧契约返回 200）；
 * 3. abc、-1、0、1.5、空格、超安全整数：返回 400，且数据库查询不执行（queryCount=0）；
 * 4. /assets（drama_id、episode_id）与 /tasks（storyboard_id、drama_id）同一契约。
 *
 * 运行机制：db/index.ts 顶层 initDb 采用「测试专用双条件保护」——
 * 仅当 NODE_ENV==='test' && MYSQL_NO_INIT==='1' 时跳过建表。本文件在动态导入
 * db / 真实路由模块之前先设置这两个变量，因此在无本机 MySQL 时也能真实运行：
 * db.select 被替换为可 await 出 [] 的 stub，断言非法值在触库前就返回 400。
 * 生产 / Docker 环境未设置该组合，initDb 行为不变。
 *
 * 运行：cd backend && npm test（或 node --import tsx/esm --test tests/id-param-route.test.mjs）
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'

// 必须先于对 ../src/db/index.js 的动态 import 设置（静态 import 求值在前，故 db/路由用动态导入）
process.env.NODE_ENV = 'test'
process.env.MYSQL_NO_INIT = '1'

const { db } = await import('../src/db/index.js')
const assetsApp = (await import('../src/routes/assets.js')).default
const tasksApp = (await import('../src/routes/tasks.js')).default

const originalSelect = db.select
after(() => {
  db.select = originalSelect
})

let queryCount = 0

// stub db.select：返回可 await 出 [] 的链式查询对象（列表与 count 查询共用）
function installStub() {
  queryCount = 0
  const q = { then: (resolve) => resolve([]) }
  q.where = () => q
  q.groupBy = () => q
  q.orderBy = () => q
  q.limit = () => q
  q.offset = () => q
  db.select = () => {
    queryCount += 1
    return { from: () => q }
  }
}

async function call(app, qs) {
  installStub()
  const res = await app.request(`/?${qs}`)
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body, queryCount }
}

const invalidValues = ['abc', '-1', '0', '1.5', '   ', '9007199254740992']

test('GET /assets & GET /tasks：非法值返回 400 且数据库查询不执行', async () => {
  for (const [app, param] of [
    [assetsApp, 'drama_id'],
    [assetsApp, 'episode_id'],
    [tasksApp, 'storyboard_id'],
    [tasksApp, 'drama_id'],
  ]) {
    for (const value of invalidValues) {
      const r = await call(app, `${param}=${encodeURIComponent(value)}`)
      assert.equal(r.status, 400, `${param}=${JSON.stringify(value)} 应返回 400，实际 ${r.status}`)
      assert.equal(r.body.code, 400)
      assert.equal(r.body.message, `${param} 参数必须是合法正整数`)
      assert.equal(r.queryCount, 0, `非法 ${param} 值不得执行数据库查询`)
    }
  }
})

test('GET /assets & GET /tasks：空串视为未传（不 400、正常走过滤流程）', async () => {
  for (const [app, qs] of [
    [assetsApp, 'drama_id='],
    [assetsApp, 'episode_id='],
    [tasksApp, 'storyboard_id='],
    [tasksApp, 'drama_id='],
  ]) {
    const r = await call(app, qs)
    assert.equal(r.status, 200, `空串 ${qs} 应视为未传返回 200，实际 ${r.status}`)
    assert.equal(r.body.code, 200)
    assert.equal(r.queryCount, 1, `空串 ${qs} 应走正常过滤流程（触库 1 次）`)
  }
})

test('GET /assets & GET /tasks：未传数字过滤参数时保持不筛选（正常 200）', async () => {
  for (const app of [assetsApp, tasksApp]) {
    const r = await call(app, '')
    assert.equal(r.status, 200)
    assert.equal(r.body.code, 200)
    assert.equal(r.queryCount, 1)
  }
})

test('GET /assets & GET /tasks：合法正整数进入 eq() 过滤并正常返回', async () => {
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
