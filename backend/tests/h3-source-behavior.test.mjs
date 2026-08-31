/**
 * 真实行为测试：H3 来源指纹纯函数。
 *
 * 与 tests/ 下其余「源码结构测试」不同，这里直接导入并执行 TS 源码逻辑，
 * 断言的是算法行为而不是代码外观。h3-fingerprint.ts 刻意不依赖数据库，
 * 因此本测试无需 MySQL 即可运行。
 *
 * 运行：cd backend && npm run test:h3。
 * tsx 加载器由 npm 脚本统一加载（node --import tsx/esm），本文件不再自注册，
 * 否则会与脚本加载器冲突（ERR_UNSUPPORTED_RESOLVE_REQUEST）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

const {
  assetVersion,
  buildFullReferenceImageList,
  computeH3SourceHash,
  fingerprintReferenceAssets,
  fingerprintSubmittedReferences,
  h3FreshnessError,
  normalizeReferenceImageUrl,
  normalizeSubmittedReferences,
  referenceMismatchError,
  sameReferenceList,
} = await import('../src/services/h3-fingerprint.js')

function baseParts(overrides = {}) {
  return {
    videoPrompt: '白天，女主走进咖啡店',
    description: '近景，推镜头',
    atmosphere: '温馨',
    duration: '10',
    sceneVersion: '1|image://scene/001.png||2026-09-01T00:00:00.000Z|',
    characterVersions: '2|image://char/002.png||2026-09-01T00:00:00.000Z|',
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
  const changed = baseParts({ sceneVersion: '1|image://scene/002.png||2026-09-01T00:00:00.000Z|' })
  assert.notEqual(computeH3SourceHash(baseParts()), computeH3SourceHash(changed))
})

test('指纹：角色设定图变化会改变哈希', () => {
  const changed = baseParts({ characterVersions: '2|image://char/003.png||2026-09-01T00:00:00.000Z|' })
  assert.notEqual(computeH3SourceHash(baseParts()), computeH3SourceHash(changed))
})

test('指纹：素材 updatedAt 变化会改变哈希（同路径新内容）', () => {
  const changed = baseParts({ characterVersions: '2|image://char/002.png||2026-09-01T01:00:00.000Z|' })
  assert.notEqual(computeH3SourceHash(baseParts()), computeH3SourceHash(changed))
})

test('指纹：资产被软删除（deletedAt 非空）会改变哈希', () => {
  const changed = baseParts({ characterVersions: '2|image://char/002.png||2026-09-01T00:00:00.000Z|2026-09-01T02:00:00.000Z' })
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
  assert.equal(assetVersion(undefined), '|||')
  assert.notEqual(assetVersion({ imageUrl: 'a', localPath: 'b', updatedAt: 'c' }), '|||')
})

test('assetVersion：同路径不同 updatedAt 版本不同', () => {
  const v1 = assetVersion({ imageUrl: 'a', updatedAt: 't1' })
  const v2 = assetVersion({ imageUrl: 'a', updatedAt: 't2' })
  assert.notEqual(v1, v2)
})

test('assetVersion：deletedAt 变化版本不同（删除后不再代表当前输入）', () => {
  const v1 = assetVersion({ imageUrl: 'a', updatedAt: 't1' })
  const v2 = assetVersion({ imageUrl: 'a', updatedAt: 't1', deletedAt: '2026-09-01T02:00:00.000Z' })
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

test('提交素材指纹：与数据库参考素材指纹同构，可直接字符串比对', () => {
  // 数据库里保存的额外素材
  const dbFp = fingerprintReferenceAssets([
    { mediaType: 'image', mediaRole: 'reference', url: 'image://ref/1.png' },
    { mediaType: 'video', mediaRole: 'reference', url: 'video://ref/1.mp4' },
  ])
  // 前端提交的同一份素材（normalizeSubmittedReferences 归一化后）
  const submitted = normalizeSubmittedReferences({
    images: [' image://ref/1.png ', ''],
    videos: ['video://ref/1.mp4'],
    audios: [],
  })
  const submittedFp = fingerprintSubmittedReferences(submitted)
  assert.equal(submittedFp, dbFp)
  // 缺一张图 → 不一致（提交的素材必须与 H3 生成时逐项一致）
  const dropped = fingerprintSubmittedReferences(normalizeSubmittedReferences({
    images: ['image://ref/1.png'],
    videos: [],
    audios: [],
  }))
  assert.notEqual(dropped, dbFp)
  // 空输入 → 空指纹（无额外素材的 H3 不应被误判为不一致）
  assert.equal(fingerprintSubmittedReferences(undefined), '')
})

test('normalizeReferenceImageUrl：与前端 normalizeMediaUrl 等价', () => {
  assert.equal(normalizeReferenceImageUrl(''), '')
  assert.equal(normalizeReferenceImageUrl('  '), '')
  assert.equal(normalizeReferenceImageUrl('https://cdn/x.png'), 'https://cdn/x.png')
  assert.equal(normalizeReferenceImageUrl('data:image/png;base64,xx'), 'data:image/png;base64,xx')
  assert.equal(normalizeReferenceImageUrl('/uploads/x.png'), '/uploads/x.png')
  assert.equal(normalizeReferenceImageUrl('uploads/x.png'), '/uploads/x.png')
})

test('完整参考图重建：过滤软删除与旁白，并按 ID 确定排序', () => {
  const images = buildFullReferenceImageList({
    scene: { id: 9, imageUrl: 'scene.png' },
    characters: [
      { id: 8, name: '已删除角色', imageUrl: 'deleted-char.png', deletedAt: '2026-09-01T03:00:00.000Z' },
      { id: 6, name: '系统旁白', role: 'Narrator', imageUrl: 'narrator.png' },
      { id: 5, name: '李明', imageUrl: 'char-5.png' },
      { id: 2, name: '张宁', imageUrl: 'char-2.png' },
    ],
    props: [
      { id: 7, imageUrl: 'prop-7.png' },
      { id: 3, imageUrl: 'deleted-prop.png', deletedAt: '2026-09-01T03:00:00.000Z' },
      { id: 1, imageUrl: 'prop-1.png' },
    ],
    extraImages: ['extra.png', '/char-2.png'],
  })

  assert.deepEqual(images, [
    '/scene.png',
    '/char-2.png',
    '/char-5.png',
    '/prop-1.png',
    '/prop-7.png',
    '/extra.png',
  ])
})

test('完整参考图重建：已软删除场景不进入投产列表，图片总数不超过 9', () => {
  const images = buildFullReferenceImageList({
    scene: { id: 1, imageUrl: 'deleted-scene.png', deletedAt: '2026-09-01T03:00:00.000Z' },
    extraImages: Array.from({ length: 12 }, (_, index) => `extra-${index + 1}.png`),
  })
  assert.equal(images.includes('/deleted-scene.png'), false)
  assert.equal(images.length, 9)
  assert.equal(images.at(-1), '/extra-9.png')
})

test('sameReferenceList：长度与每一项都必须一致，顺序敏感', () => {
  assert.equal(sameReferenceList([], []), true)
  assert.equal(sameReferenceList(['a', 'b'], ['a', 'b']), true)
  assert.equal(sameReferenceList(['a', 'b'], ['b', 'a']), false)
  assert.equal(sameReferenceList(['a'], ['a', 'b']), false)
})

test('referenceMismatchError：实际素材与服务端重建状态一致 → 放行', () => {
  const db = {
    images: ['/scene.png', '/char.png', '/ref1.png'],
    videos: ['/ref1.mp4'],
    audios: [],
  }
  const submitted = normalizeSubmittedReferences({
    images: ['/scene.png', '/char.png', '/ref1.png'],
    videos: ['/ref1.mp4'],
    audios: [],
  })
  assert.equal(referenceMismatchError(db, submitted), null)
})

test('referenceMismatchError：伪造快照 - 实际数组放另一套素材必须拒绝', () => {
  // 数据库当前状态：H3 生成时的素材
  const db = {
    images: ['/scene.png', '/char.png', '/ref1.png'],
    videos: ['/ref1.mp4'],
    audios: [],
  }
  // 调用者可以在 reference_snapshot 里填正确值，但实际生成数组携带另一套素材。
  // 校验只比较实际数组，因此即使「快照正确」，实际素材不同也必须拒绝。
  const submitted = normalizeSubmittedReferences({
    images: ['/scene.png', '/char.png', '/evil.png'], // 偷换了额外参考图
    videos: ['/ref1.mp4'],
    audios: [],
  })
  assert.match(referenceMismatchError(db, submitted), /参考图片与分镜当前绑定的素材不一致/)

  const swappedVideo = normalizeSubmittedReferences({
    images: ['/scene.png', '/char.png', '/ref1.png'],
    videos: ['/evil.mp4'],
    audios: [],
  })
  assert.match(referenceMismatchError(db, swappedVideo), /参考视频与数据库保存的额外素材不一致/)

  // 多传一张图（超出现有状态）同样拒绝
  const extra = normalizeSubmittedReferences({
    images: ['/scene.png', '/char.png', '/ref1.png', '/extra.png'],
    videos: ['/ref1.mp4'],
    audios: [],
  })
  assert.match(referenceMismatchError(db, extra), /参考图片与分镜当前绑定的素材不一致/)
})
