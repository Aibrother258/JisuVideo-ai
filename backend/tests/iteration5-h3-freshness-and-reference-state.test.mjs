/**
 * HB-20260831-05 回归测试：H3 新鲜度与参考素材状态同步
 *
 * 覆盖本轮修复的 P0/P1 问题，重点是「刚生成的 H3 提示词立刻被判过期」这条调用链：
 * H3 保存 → 前端 refresh → selectedSb 监听器回写参考素材 → 后端无条件清空指纹。
 * 因此这里同时约束后端（内容感知失效、事务、级联）和前端（恢复状态不回写）。
 */
import { readFileSync, existsSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const exists = (path) => existsSync(new URL(path, root))

const h3 = read('src/services/h3-source.ts')
const routes = read('src/routes/storyboards.ts')
const tools = read('src/agents/tools/storyboard-tools.ts')
const tasks = read('src/routes/tasks.ts')
const generation = read('src/services/generation.ts')
const frontend = read('../frontend/app/views/drama/episode.vue')

test('H3 source fingerprint lives in one shared module used by both writers', () => {
  // 生成侧（Agent 工具）与失效侧（路由）必须用同一套算法，
  // 两边各算一遍就会出现「保存完立刻被判过期」。
  assert.match(tools, /from '\.\.\/\.\.\/services\/h3-source\.js'/)
  assert.match(routes, /from '\.\.\/services\/h3-source\.js'/)
  assert.match(tools, /collectH3SourceHash\(storyboard\)/)
  assert.match(routes, /collectH3SourceHash\(/)
  assert.match(h3, /export async function collectH3SourceHash/)
  assert.match(h3, /export function computeH3SourceHash/)
})

test('H3 fingerprint covers scene, character and prop bindings plus their image versions', () => {
  assert.match(h3, /schema\.storyboardCharacters/)
  assert.match(h3, /schema\.storyboardProps/)
  assert.match(h3, /schema\.storyboardReferenceAssets/)
  assert.match(h3, /schema\.scenes/)
  assert.match(h3, /sceneVersion/)
  assert.match(h3, /characterVersions/)
  assert.match(h3, /propVersions/)
  // 设定图版本进入指纹：重新生成角色图 / 场景图 / 道具图也要让 H3 失效
  assert.match(h3, /imageUrl/)
  assert.match(h3, /localPath/)
})

test('reference asset saves invalidate H3 only when the source actually changes', () => {
  assert.match(routes, /const beforeHash = await collectH3SourceHash\(storyboard\)/)
  assert.match(routes, /const afterHash = refreshed \? await collectH3SourceHash\(refreshed\) : beforeHash/)
  assert.match(routes, /if \(afterHash !== beforeHash\)/)
  assert.match(routes, /h3-invalidated/)
  // 旧实现「收到保存请求就清空」已移除：写入必须走事务里的 tx.insert
  assert.doesNotMatch(routes, /for \(const item of normalized\) await db\.insert/)
})

test('storyboard updates invalidate H3 by content, not by which fields were sent', () => {
  const updateRoute = routes.slice(routes.indexOf("app.put('/:id'"))
  assert.match(updateRoute, /const beforeHash = await collectH3SourceHash\(storyboard\)/)
  assert.match(updateRoute, /const afterHash = await collectH3SourceHash\(updated\)/)
  assert.match(updateRoute, /if \(afterHash !== beforeHash\)/)
  // 旧实现按「请求里带了哪些字段」判断，会把内容相同的回写误判为变更
  assert.doesNotMatch(updateRoute, /\['description', 'atmosphere', 'duration', 'video_prompt'\]\.some\(key => key in body\)/)
})

test('reference asset replacement runs inside a database transaction', () => {
  assert.match(routes, /await db\.transaction\(async \(tx\) => \{/)
  assert.match(routes, /await tx\.delete\(schema\.storyboardReferenceAssets\)/)
  assert.match(routes, /await tx\.insert\(schema\.storyboardReferenceAssets\)\.values\(item\)/)
  assert.match(routes, /参考素材保存失败/)
})

test('reference asset saves enforce per-type and total limits', () => {
  assert.match(routes, /REFERENCE_MEDIA_LIMITS/)
  assert.match(routes, /image: 9, video: 3, audio: 3/)
  assert.match(routes, /REFERENCE_TOTAL_LIMIT/)
  assert.match(routes, /参考素材超限/)
})

test('storyboard deletion cascades reference assets in both route and agent paths', () => {
  const deleteRoute = routes.slice(routes.indexOf("app.delete('/:id'"))
  assert.match(deleteRoute, /db\.transaction/)
  assert.match(deleteRoute, /tx\.delete\(schema\.storyboardReferenceAssets\)/)
  // 分镜 Agent 整集重新生成（replace_existing）会换掉分镜 ID，同样要清理
  assert.match(tools, /db\.delete\(schema\.storyboardReferenceAssets\)/)
})

test('reference assets keep the originating asset id', () => {
  assert.match(routes, /assetId: item\?\.asset_id == null \|\| Number\.isNaN\(assetId\) \? null : assetId/)
  assert.match(frontend, /asset_id: refAssetOrigins\.value\[url\] \?\? null/)
  assert.match(frontend, /function rememberRefAssetOrigin/)
})

test('video tasks persist the reference_snapshot submitted by the frontend', () => {
  assert.match(tasks, /function normalizeReferenceSnapshot/)
  assert.match(tasks, /normalizeReferenceSnapshot\(body\.reference_snapshot\)/)
  assert.match(generation, /export interface VideoReferenceSnapshot/)
  assert.match(generation, /referenceSnapshot: params\.referenceSnapshot \?\? null/)
  assert.match(frontend, /reference_snapshot: \{/)
})

test('MySQL stays canonical for reference selections and identical saves are skipped', () => {
  // 请求成功返回空数组即代表正式状态为空，不再回退浏览器缓存
  assert.doesNotMatch(frontend, /const source = durable\.length \? \{/)
  assert.match(frontend, /返回空数组就是「确实没有参考素材」/)
  // 内容签名去重：内容未变就不回写，避免刚生成的 H3 被误判过期
  assert.match(frontend, /function shotRefSignature/)
  assert.match(frontend, /lastSavedShotRefSelections\.value\[key\] === signature/)
  // 保存失败必须提示用户，不再静默忽略
  assert.doesNotMatch(frontend, /saveReferenceAssets\(storyboardId, items\)\.catch\(\(\) => \{\}\)/)
  assert.match(frontend, /参考素材保存失败/)
})

test('a backfill script can repair storyboards that have an H3 prompt but no source hash', () => {
  assert.equal(exists('scripts/backfill-h3-source.ts'), true)
  const script = read('scripts/backfill-h3-source.ts')
  assert.match(script, /isNull\(schema\.storyboards\.minimaxH3SourceHash\)/)
  assert.match(script, /isNotNull\(schema\.storyboards\.minimaxH3Prompt\)/)
  assert.match(script, /collectH3SourceHash/)
  assert.match(script, /--dry-run/)
  assert.match(read('package.json'), /"backfill-h3-source": "tsx scripts\/backfill-h3-source\.ts"/)
})
