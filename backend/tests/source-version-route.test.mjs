import { test, after } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.MYSQL_NO_INIT = '1'
const { db, pool } = await import('../src/db/index.ts')
const app = (await import('../src/routes/dramas.ts')).default
const originalSelect = db.select
const originalGetConnection = pool.getConnection
after(() => {
  db.select = originalSelect
  pool.getConnection = originalGetConnection
})

test('分析参数非法或正文未保存时，不取得写连接、不触发模型', async () => {
  const saved = '已经保存的正文内容，足够二十个字，用于原始版本的来源验证。'
  let writes = 0
  db.select = () => ({ from: () => ({ where: async () => [{ id: 1, description: saved }] }) })
  pool.getConnection = async () => {
    writes++
    throw new Error('非法请求不应触及版本写入')
  }
  for (const [body, status] of [
    [{ content: saved, episode_count: 'abc' }, 400],
    [{ content: saved, requirement: '长'.repeat(501) }, 400],
    [{ content: saved, review_notes: [{ note: '长'.repeat(2001) }] }, 400],
    [{ content: '尚未保存的另外一篇正文，也有足够的二十个字用于测试。' }, 409],
  ]) {
    const response = await app.request('/1/analyze-episodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    assert.equal(response.status, status, JSON.stringify(body))
  }
  assert.equal(writes, 0)
})
