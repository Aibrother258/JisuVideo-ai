/**
 * 真实行为测试：parseRecordId 纯函数。
 *
 * 与 tests/ 下其余「源码结构测试」不同，这里直接导入并执行 TS 源码逻辑，
 * 断言的是算法行为而不是代码外观。query-id.ts 是零依赖纯函数，
 * 因此本测试无需 MySQL 即可运行。
 *
 * 运行：cd backend && npm test（或按需 `node --import tsx/esm --test tests/parse-record-id.test.mjs`）。
 * tsx 加载器由 npm 脚本统一加载（node --import tsx/esm），本文件不再自注册。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { parseRecordId } = await import('../src/utils/query-id.js')

test('parseRecordId: 合法正整数原样返回', () => {
  assert.equal(parseRecordId('12'), 12)
  assert.equal(parseRecordId('1'), 1)
  assert.equal(parseRecordId(' 7 '), 7)
  assert.equal(parseRecordId(String(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER)
})

test('parseRecordId: 缺失/空值返回 undefined（等价于未传该过滤条件）', () => {
  assert.equal(parseRecordId(undefined), undefined)
  assert.equal(parseRecordId(''), undefined)
  assert.equal(parseRecordId('   '), undefined)
})

test('parseRecordId: 非数字/小数/负数/零返回 undefined，杜绝 NaN 进入 SQL', () => {
  assert.equal(parseRecordId('abc'), undefined)
  assert.equal(parseRecordId('12abc'), undefined)
  assert.equal(parseRecordId('1.5'), undefined)
  assert.equal(parseRecordId('-1'), undefined)
  assert.equal(parseRecordId('0'), undefined)
  assert.equal(parseRecordId('NaN'), undefined)
  assert.equal(parseRecordId('Infinity'), undefined)
})

test('parseRecordId: 超出安全整数精度返回 undefined', () => {
  assert.equal(parseRecordId('9007199254740992'), undefined)
  assert.equal(parseRecordId('99999999999999999999'), undefined)
})
