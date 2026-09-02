import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

const guard = await import('../src/utils/endpoint-guard.ts')

afterEach(() => guard.resetEndpointLookup())

test('IPv4、IPv4-mapped IPv6 与 IPv4-compatible IPv6 均拒绝私网和回环地址', () => {
  for (const address of [
    '127.0.0.1', '10.0.0.1', '192.168.1.10',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:0a00:1',
    '0:0:0:0:0:ffff:c0a8:1', '::127.0.0.1',
  ]) {
    assert.equal(guard.isPrivateAddress(address), true, address)
  }
})

test('公网 IPv4 与 IPv6 地址不被误判为私网', () => {
  assert.equal(guard.isPrivateAddress('8.8.8.8'), false)
  assert.equal(guard.isPrivateAddress('2606:4700:4700::1111'), false)
})

test('解析到任一私网地址的域名会整体拒绝，避免多地址 DNS 绕过', async () => {
  guard.setEndpointLookup(async () => ['8.8.8.8', '10.0.0.8'])
  await assert.rejects(
    () => guard.assertSafeEndpointUrl('https://provider.example/v1/models'),
    /private address not allowed/,
  )
})

test('解析结果会返回已校验且将被固定连接的地址', async () => {
  guard.setEndpointLookup(async () => ['8.8.8.8'])
  const endpoint = await guard.resolveSafeEndpoint('https://provider.example/v1/models')
  assert.equal(endpoint.address, '8.8.8.8')
  assert.equal(endpoint.family, 4)
  assert.equal(endpoint.url.hostname, 'provider.example')
})

test('拒绝非 HTTP(S) 协议与无有效 DNS 结果', async () => {
  await assert.rejects(() => guard.assertSafeEndpointUrl('file:///etc/passwd'), /protocol not allowed/)
  guard.setEndpointLookup(async () => [])
  await assert.rejects(() => guard.assertSafeEndpointUrl('https://provider.example/v1/models'), /no valid IP address/)
})
