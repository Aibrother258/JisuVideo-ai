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
const fingerprint = read('src/services/h3-fingerprint.ts')
const routes = read('src/routes/storyboards.ts')
const tools = read('src/agents/tools/storyboard-tools.ts')
const tasks = read('src/routes/tasks.ts')
const generation = read('src/services/generation.ts')
const frontend = read('../frontend/app/views/drama/episode.vue')
const characters = read('src/routes/characters.ts')
const scenes = read('src/routes/scenes.ts')
const props = read('src/routes/props.ts')

test('H3 source fingerprint lives in one shared module used by both writers', () => {
  // 生成侧（Agent 工具）与失效侧（路由）必须用同一套算法，
  // 两边各算一遍就会出现「保存完立刻被判过期」。
  assert.match(tools, /from '\.\.\/\.\.\/services\/h3-source\.js'/)
  assert.match(routes, /from '\.\.\/services\/h3-source\.js'/)
  assert.match(tools, /collectH3SourceHash\(storyboard\)/)
  assert.match(routes, /collectH3SourceHash\(/)
  assert.match(h3, /export async function collectH3SourceHash/)
  // 纯算法抽到独立模块（不依赖数据库，可做真实行为测试），h3-source 再导出
  assert.match(fingerprint, /export function computeH3SourceHash/)
  assert.match(fingerprint, /export function h3FreshnessError/)
  // h3-source 必须再导出全部纯函数，供既有调用方继续使用
  assert.match(h3, /export \{[\s\S]*?computeH3SourceHash[\s\S]*?fingerprintReferenceAssets[\s\S]*?h3FreshnessError[\s\S]*?\} from '\.\/h3-fingerprint\.js'/)
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
  // （imageUrl/localPath/updatedAt 在纯算法层 h3-fingerprint.ts 的 assetVersion 中）
  assert.match(fingerprint, /imageUrl/)
  assert.match(fingerprint, /localPath/)
  // 素材版本带 updatedAt：文件内容变了但路径没变时也能识别
  assert.match(h3, /updatedAt/)
  // 首帧/尾帧影响 H3 模式判定，也纳入指纹
  assert.match(h3, /frameVersion/)
  // 资产软删除（deletedAt）同样进入版本：删除绑定素材后 H3 不再有效
  assert.match(fingerprint, /deletedAt/)
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
  // 实际写入必须显式 --confirm，防止把「内容已变但没被识别」的旧提示词误标为新鲜
  assert.match(script, /--confirm/)
  assert.match(script, /未指定模式：默认只预演/)
  assert.match(read('package.json'), /"backfill-h3-source": "tsx scripts\/backfill-h3-source\.ts"/)
})

test('server-side guard rejects video tasks that resubmit a stale H3 prompt', () => {
  assert.match(tasks, /import \{ verifyH3PromptFreshness \} from '\.\.\/services\/h3-source\.js'/)
  assert.match(tasks, /await verifyH3PromptFreshness\(/)
  assert.match(tasks, /if \(h3Error\) return badRequest\(c, h3Error\)/)
  // 判定必须在生成之前，否则旧提示词照样投产出片
  assert.ok(tasks.indexOf('verifyH3PromptFreshness') < tasks.indexOf('generateVideo('))
})

test('server-side guard also verifies submitted reference assets match the H3 source', () => {
  // H3 新鲜只证明「数据库状态 == H3 生成时」；调用者仍可带另一套素材提交。
  // 校验只比较请求中的实际 reference_*_urls，不信任客户端快照。
  assert.match(h3, /verifyH3PromptFreshness\(/)
  assert.match(h3, /submittedReferences/)
  assert.match(h3, /reconstructFullReferenceImageList\(storyboardId\)/)
  assert.match(h3, /referenceMismatchError\(/)
  // 纯函数层提供与前端 normalizeMediaUrl 等价的归一化、逐项比较与拒绝消息
  assert.match(fingerprint, /export function normalizeReferenceImageUrl/)
  assert.match(fingerprint, /export function sameReferenceList/)
  assert.match(fingerprint, /export function referenceMismatchError/)
  assert.match(fingerprint, /参考图片与分镜当前绑定的素材不一致/)
  // 服务端重建完整图片列表：场景 → 角色 → 道具 → 数据库额外图片
  assert.match(h3, /场景图 → 角色图（按绑定顺序）→ 道具图/)
  assert.match(h3, /storyboardReferenceAssets\.mediaType, 'image'/)
  // tasks.ts 校验传实际数组，快照不再参与比对
  assert.match(tasks, /images: body\.reference_image_urls/)
  assert.match(tasks, /videos: body\.reference_video_urls/)
  assert.match(tasks, /audios: body\.reference_audio_urls/)
  assert.doesNotMatch(tasks, /snapshot\?\.extra_images/)
  assert.match(tasks, /不信任 reference_snapshot/)
  // 前端快照仍携带 extra_images 供落库追溯，但不参与校验
  assert.match(frontend, /extra_images: \[\.\.\.videoRefImageUrls\.value\]/)
  assert.match(generation, /extra_images\?: string\[\]/)
})

test('character / scene / prop image updates invalidate bound storyboards H3', () => {
  assert.match(characters, /import \{ invalidateH3ForCharacter \} from '\.\.\/services\/h3-source\.js'/)
  assert.match(characters, /invalidateH3ForCharacter\(id, 'character-image-updated'\)/)
  assert.match(scenes, /import \{ invalidateH3ForScene \} from '\.\.\/services\/h3-source\.js'/)
  assert.match(scenes, /invalidateH3ForScene\(id, 'scene-image-updated'\)/)
  assert.match(props, /import \{ invalidateH3ForProp \} from '\.\.\/services\/h3-source\.js'/)
  assert.match(props, /invalidateH3ForProp\(id, 'prop-image-updated'\)/)
  // 钩子只挂在图片字段变化时，避免「改文本也失效」的过度失效
  assert.match(characters, /if \('imageUrl' in updates \|\| 'localPath' in updates\)/)
  assert.match(h3, /export async function invalidateH3ForCharacter/)
  assert.match(h3, /export async function invalidateH3ForScene/)
  assert.match(h3, /export async function invalidateH3ForProp/)
})

test('generated character / scene / prop images also invalidate bound storyboards H3', () => {
  assert.match(generation, /invalidateH3ForCharacter\(record\.characterId, 'character-image-generated'\)/)
  assert.match(generation, /invalidateH3ForScene\(record\.sceneId, 'scene-image-generated'\)/)
  assert.match(generation, /invalidateH3ForProp\(record\.propId, 'prop-image-generated'\)/)
  // 首帧/尾帧生成后同样失效该分镜 H3（帧图影响 H3 模式判定）
  assert.match(generation, /invalidateH3ForStoryboards\(\[record\.storyboardId\], `frame-/)
})

test('frontend blocks video generation when H3 has been marked stale', () => {
  assert.match(frontend, /const h3SourceHash = String\(sb\.minimax_h3_source_hash/)
  assert.match(frontend, /h3Provider && h3Prompt && !h3SourceHash/)
  assert.match(frontend, /请重新生成 H3 后再提交视频/)
})

test('rapid reference selection saves are serialized per storyboard', () => {
  assert.match(frontend, /const shotRefSaveQueues = \{\}/)
  assert.match(frontend, /const shotRefPendingSignatures = \{\}/)
  assert.match(frontend, /async function performShotRefSave/)
  // 请求按入队顺序串行执行，防止网络返回乱序覆盖
  assert.match(frontend, /shotRefSaveQueues\[key\] \|\| Promise\.resolve\(\)/)
  // 内容在入队时同步捕获：排队执行时状态可能已切换
  assert.match(frontend, /同步捕获当前内容/)
})

test('video generation and H3 generation wait for the reference save queue to flush', () => {
  // 串行队列只是顺序执行：最新素材仍可能排队未写入，必须等队列清空再生成
  assert.match(frontend, /async function flushShotRefSaves\(storyboardId\)/)
  assert.match(frontend, /while \(shotRefSaveQueues\[key\]\)/)
  // 生成 H3、提交视频前都强制等待
  assert.match(frontend, /await flushShotRefSaves\(sb\.id\)/)
  // 签名已排队时返回那条队列任务，而不是立即放行
  assert.match(frontend, /if \(shotRefPendingSignatures\[key\] === signature\)/)
  assert.match(frontend, /return shotRefSaveQueues\[key\] \|\| Promise\.resolve\(\)/)
})

test('reference save failure aborts H3 / video generation instead of continuing silently', () => {
  // 队列不因单次失败中断，但失败必须记录并由 flush 抛出，生成流程中止
  assert.match(frontend, /const shotRefLastErrors = \{\}/)
  assert.match(frontend, /\.catch\(\(error\) => \{ shotRefLastErrors\[key\] = error \}\)/)
  assert.match(frontend, /if \(shotRefLastErrors\[key\]\)/)
  assert.match(frontend, /throw new Error\(`参考素材保存失败/)
  // genVid 对 flush 失败的处理：toast 后返回，不再提交
  assert.match(frontend, /保存失败（flushShotRefSaves 抛出）同样中止生成/)
})

test('deleting a character / scene / prop invalidates H3 of bound storyboards', () => {
  assert.match(characters, /invalidateH3ForCharacter\(id, 'character-deleted'\)/)
  assert.match(scenes, /invalidateH3ForScene\(id, 'scene-deleted'\)/)
  assert.match(props, /invalidateH3ForProp\(id, 'prop-deleted'\)/)
})

test('reference asset total overflow returns an explicit 400 instead of silent truncation', () => {
  assert.match(routes, /normalized\.length > REFERENCE_TOTAL_LIMIT/)
  assert.match(routes, /参考素材总数超过上限/)
  // 静默截断已移除
  assert.doesNotMatch(routes, /if \(normalized\.length >= REFERENCE_TOTAL_LIMIT\) break/)
})
