/**
 * 真实行为测试：H3 来源指纹纯函数。
 *
 * 与 tests/ 下其余「源码结构测试」不同，这里直接导入并执行 TS 源码逻辑，
 * 断言的是算法行为而不是代码外观。h3-fingerprint.ts 刻意不依赖数据库，
 * 因此本测试无需 MySQL 即可运行。
 *
 * 运行：cd backend && npm run test:h3（或直接 node --test tests/，本文件自注册加载器）
 */
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// 注册 tsx 的 ESM 加载器，使 `import '../src/services/h3-fingerprint.js'` 能解析到 .ts 源码。
// tsx 是 backend 的 devDependency；独立运行本文件时也在这里先激活加载器。
register('tsx/esm')

const { assetVersion, computeH3SourceHash, fingerprintReferenceAssets, h3FreshnessError } =
  await import('../src/services/h3-fingerprint.js')

function baseParts(overrides = {}) {
  return {
    videoPrompt: '白天，女主走进咖啡店',
    description: '近景，推镜头',
    atmosphere: '温馨',
    duration: '10',
    sceneVersion: '1|image://scene/001.png||2026-09-01T00:00:00.000Z',
    characterVersions: '2|image://char/002.png||2026-09-01T00:00:00.000Z',
    propVersions: '',
    frameVersion: 'first:image://frame/first.png|last:',
    referenceAssets: fingerprintReferenceAssets([
      { mediaType: 'image', mediaRole: 'reference', url: 'image://ref/1.png' },
      { mediaType: 'image', mediaRole: 'reference', url: 'image://ref/2.png' },
    ]),
    ...overrides,
  }
}

test('指纹：相同输入得到相同哈希（幂等）', () => {
  assert.equal(computeH3SourceHash(baseParts()), computeH3SourceHash(baseParts()))
})

test('指纹：分镜文本变化会改变哈希', () => {
  const changed = baseParts({ videoPrompt: '夜晚，女主走进咖啡店' })
  assert.notEqual(computeH3SourceHash(baseParts()), computeH3SourceHash(changed))
})

test('指纹：场景设定图变化会改变哈希', () => {
  const changed = baseParts({ sceneVersion: '1|image://scene/002.png||2026-09-01T00:00:00.000Z' })
  assert.notEqual(computeH3SourceHash(baseParts()), computeH3SourceHash(changed))
})

test('指纹：角色设定图变化会改变哈希', () => {
  const changed = baseParts({ characterVersions: '2|image://char/003.png||2026-09-01T00:00:00.000Z' })
  assert.notEqual(computeH3SourceHash(baseParts()), computeH3SourceHash(changed))
})

test('指纹：素材 updatedAt 变化会改变哈希（同路径新内容）', () => {
  const changed = baseParts({ characterVersions: '2|image://char/002.png||2026-09-01T01:00:00.000Z' })
  assert.notEqual(computeH3SourceHash(baseParts()), computeH3SourceHash(changed))
})

test('指纹：参考素材顺序变化会改变哈希（H3 的 <Picture N> 编号依赖顺序）', () => {
  const reordered = baseParts({
    referenceAssets: fingerprintReferenceAssets([
      { mediaType: 'image', mediaRole: 'reference', url: 'image://ref/2.png' },
      { mediaType: 'image', mediaRole: 'reference', url: 'image://ref/1.png' },
    ]),
  })
  assert.notEqual(computeH3SourceHash(baseParts()), computeH3SourceHash(reordered))
})

test('指纹：参考素材内容变化会改变哈希', () => {
  const changed = baseParts({
    referenceAssets: fingerprintReferenceAssets([
      { mediaType: 'image', mediaRole: 'reference', url: 'image://ref/1.png' },
    ]),
  })
  assert.notEqual(computeH3SourceHash(baseParts()), computeH3SourceHash(changed))
})

test('assetVersion：无资产时为空版本，有资产时非空', () => {
  assert.equal(assetVersion(undefined), '||')
  assert.notEqual(assetVersion({ imageUrl: 'a', localPath: 'b', updatedAt: 'c' }), '||')
})

test('assetVersion：同路径不同 updatedAt 版本不同', () => {
  const v1 = assetVersion({ imageUrl: 'a', updatedAt: 't1' })
  const v2 = assetVersion({ imageUrl: 'a', updatedAt: 't2' })
  assert.notEqual(v1, v2)
})

test('h3FreshnessError：缺少来源指纹 → 拒绝', () => {
  const error = h3FreshnessError('hash-now', null)
  assert.ok(error)
  assert.match(error, /缺少来源指纹/)
})

test('h3FreshnessError：哈希不匹配 → 拒绝', () => {
  const error = h3FreshnessError('hash-now', 'hash-then')
  assert.ok(error)
  assert.match(error, /已过期/)
})

test('h3FreshnessError：哈希一致 → 放行', () => {
  assert.equal(h3FreshnessError('same', 'same'), null)
})
