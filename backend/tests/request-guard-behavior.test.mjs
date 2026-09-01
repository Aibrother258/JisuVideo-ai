import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acquireAiRequest } from '../src/services/request-guard.ts'

test('AI request guard limits concurrency and releases the project slot', () => {
  const key = `concurrency-${Date.now()}-${Math.random()}`
  const first = acquireAiRequest(key, 6, 1)
  assert.equal(first.ok, true)
  const concurrent = acquireAiRequest(key, 6, 1)
  assert.equal(concurrent.ok, false)
  assert.match(concurrent.message, /正在进行/)
  first.release()
  assert.equal(acquireAiRequest(key, 6, 1).ok, true)
})

test('AI request guard enforces a fixed-window request budget', () => {
  const key = `rate-${Date.now()}-${Math.random()}`
  for (let index = 0; index < 2; index += 1) {
    const request = acquireAiRequest(key, 2, 1)
    assert.equal(request.ok, true)
    request.release()
  }
  const limited = acquireAiRequest(key, 2, 1)
  assert.equal(limited.ok, false)
  assert.match(limited.message, /过于频繁/)
  assert.ok(limited.retryAfter > 0)
})
