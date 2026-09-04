/**
 * 真实行为测试：parseRecordId 纯函数（三态判别联合契约）。
 *
 * 契约要点：区分「未提供」「非法」「合法」，保证非法值在进入 SQL 前被路由
 * 转成 400——非法输入绝不静默省略过滤条件（否则会把受限查询放大成全量，
 * 造成跨项目数据误展示）。
 *
 * query-id.ts 是零依赖纯函数，本测试无需 MySQL 即可运行。
 *
 * 运行：cd backend && npm test（或按需 `node --import tsx/esm --test tests/parse-record-id.test.mjs`）。
 * tsx 加载器由 npm 脚本统一加载（node --import tsx/esm），本文件不再自注册。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { parseRecordId } = await import('../src/utils/query-id.js')

test('parseRecordId: 未提供 / 空串 → absent（不筛选，旧契约兼容）', () => {
  assert.deepEqual(parseRecordId(undefined), { kind: 'absent' })
  assert.deepEqual(parseRecordId(null), { kind: 'absent' })
  assert.deepEqual(parseRecordId(''), { kind: 'absent' })
})

test('parseRecordId: 非法值 → invalid（路由必须返回 400，禁止省略过滤）', () => {
  // 非数字 / 小数 / 负数 / 零 / 纯空格 / 超精度 / 非十进制写法
  const invalid = [
    'abc', '12abc', '1.5', '-1', '0', '00', '   ', 'NaN', 'Infinity',
    '1e3', '0x1F', '+7', '9007199254740992', '99999999999999999999', '12 3',
  ]
  for (const raw of invalid) {
    assert.deepEqual(parseRecordId(raw), { kind: 'invalid' }, `raw=${JSON.stringify(raw)}`)
  }
})

test('parseRecordId: 合法十进制正整数 → id', () => {
  assert.deepEqual(parseRecordId('12'), { kind: 'id', id: 12 })
  assert.deepEqual(parseRecordId('1'), { kind: 'id', id: 1 })
  assert.deepEqual(parseRecordId(' 7 '), { kind: 'id', id: 7 })
  assert.deepEqual(parseRecordId('007'), { kind: 'id', id: 7 })
  assert.deepEqual(parseRecordId(String(Number.MAX_SAFE_INTEGER)), { kind: 'id', id: Number.MAX_SAFE_INTEGER })
})
