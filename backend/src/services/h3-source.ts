/**
 * MiniMax H3 提示词来源指纹 — 数据库读写层
 *
 * 本模块是指纹的数据库入口：
 * - `collectH3SourceHash`：分镜当前的全部 H3 来源输入的指纹。H3 保存时用它记录来源，
 *   失效判断时用它比对现状——保存与失效判断共用同一套算法，是「刚生成就被判过期」
 *   这类误判的必要修复条件。
 * - `verifyH3PromptFreshness`：视频任务提交时的服务端兜底。前端提示可被绕过
 *   （直接调 API），这里在提交瞬间重算指纹做最终裁决。
 * - `invalidateH3ForCharacter/Scene/Prop`：资产图片更新后，主动失效所有绑定了
 *   该资产的分镜 H3，让界面立即显示「可能已过期」，而不是等到提交才被拒绝。
 *
 * 纯算法（无需数据库、可独立行为测试）见 h3-fingerprint.ts。
 */
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { now } from '../utils/response.js'
import { logTaskProgress } from '../utils/task-logger.js'
import {
  assetVersion,
  computeH3SourceHash,
  fingerprintReferenceAssets,
  fingerprintSubmittedReferences,
  h3FreshnessError,
  normalizeSubmittedReferences,
  type H3SourceParts,
  type ReferenceAssetFingerprintInput,
  type SubmittedReferences,
} from './h3-fingerprint.js'

export {
  computeH3SourceHash,
  fingerprintReferenceAssets,
  fingerprintSubmittedReferences,
  h3FreshnessError,
  normalizeSubmittedReferences,
} from './h3-fingerprint.js'
export type { H3SourceParts, SubmittedReferences } from './h3-fingerprint.js'

export type StoryboardRow = typeof schema.storyboards.$inferSelect
type CharacterRow = typeof schema.characters.$inferSelect
type PropRow = typeof schema.props.$inferSelect
type SceneRow = typeof schema.scenes.$inferSelect

/** 汇总一个分镜当前的全部 H3 来源输入 */
export async function collectH3SourceParts(storyboard: StoryboardRow): Promise<H3SourceParts> {
  const [characterLinks, propLinks, referenceAssets] = await Promise.all([
    db.select().from(schema.storyboardCharacters)
      .where(eq(schema.storyboardCharacters.storyboardId, storyboard.id)),
    db.select().from(schema.storyboardProps)
      .where(eq(schema.storyboardProps.storyboardId, storyboard.id)),
    db.select().from(schema.storyboardReferenceAssets)
      .where(eq(schema.storyboardReferenceAssets.storyboardId, storyboard.id))
      .orderBy(asc(schema.storyboardReferenceAssets.sortOrder), asc(schema.storyboardReferenceAssets.id)),
  ])

  const characterIds = [...new Set(characterLinks.map(link => link.characterId))].sort((a, b) => a - b)
  const propIds = [...new Set(propLinks.map(link => link.propId))].sort((a, b) => a - b)

  const characterRows: CharacterRow[] = characterIds.length
    ? await db.select().from(schema.characters).where(inArray(schema.characters.id, characterIds))
    : []
  const propRows: PropRow[] = propIds.length
    ? await db.select().from(schema.props).where(inArray(schema.props.id, propIds))
    : []
  const sceneRows: SceneRow[] = storyboard.sceneId
    ? await db.select().from(schema.scenes).where(eq(schema.scenes.id, storyboard.sceneId))
    : []

  const characterMap = new Map<number, CharacterRow>(characterRows.map(row => [row.id, row] as const))
  const propMap = new Map<number, PropRow>(propRows.map(row => [row.id, row] as const))
  const scene = sceneRows[0]

  // 绑定 ID 决定引用谁；image_url/local_path 决定引用哪个文件；
  // updatedAt 决定是不是同一份内容——同路径覆盖新文件时路径不变，靠它识别。
  return {
    videoPrompt: storyboard.videoPrompt || '',
    description: storyboard.description || '',
    atmosphere: storyboard.atmosphere || '',
    duration: String(storyboard.duration ?? ''),
    sceneVersion: `${storyboard.sceneId ?? ''}|${assetVersion(scene)}`,
    characterVersions: characterIds
      .map(id => `${id}|${assetVersion(characterMap.get(id))}`)
      .join('\n'),
    propVersions: propIds
      .map(id => `${id}|${assetVersion(propMap.get(id))}`)
      .join('\n'),
    // 首帧影响 H3 的 T2VA/I2VA 模式判定，尾帧是视频生成输入，一并纳入
    frameVersion: `first:${storyboard.firstFrameImage || ''}|last:${storyboard.lastFrameImage || ''}`,
    referenceAssets: fingerprintReferenceAssets(
      referenceAssets.map((item): ReferenceAssetFingerprintInput => ({
        mediaType: item.mediaType,
        mediaRole: item.mediaRole,
        url: item.url,
      })),
    ),
  }
}

/** 分镜当前的 H3 来源指纹。保存与失效判断都必须走这里，避免两套算法。 */
export async function collectH3SourceHash(storyboard: StoryboardRow): Promise<string> {
  return computeH3SourceHash(await collectH3SourceParts(storyboard))
}

/**
 * 视频任务提交时的服务端兜底：提交的 prompt 若就是该分镜已保存的 H3 提示词，
 * 必须确认来源指纹仍然新鲜。返回 null 表示无需拦截（不是 H3 提示词，或仍然新鲜）；
 * 返回字符串为拒绝原因。
 *
 * 判定方式是「提交的 prompt 与库中 H3 提示词逐字一致」，不依赖前端传任何标志，
 * 直接调 API 也无法绕过。除此之外，H3 新鲜只证明「数据库状态 == H3 生成时」；
 * 调用者仍可带着另一套参考素材提交，因此还要比对本次请求的额外参考素材
 * （手动选择/上传的图片、视频、音频）与数据库，不一致同样拒绝。
 */
export async function verifyH3PromptFreshness(
  storyboardId: number,
  submittedPrompt: unknown,
  submittedReferences?: unknown,
): Promise<string | null> {
  const trimmed = String(submittedPrompt ?? '').trim()
  if (!trimmed) return null
  const [storyboard] = await db.select().from(schema.storyboards).where(eq(schema.storyboards.id, storyboardId))
  if (!storyboard || !storyboard.minimaxH3Prompt) return null
  if (trimmed !== String(storyboard.minimaxH3Prompt).trim()) return null

  const currentHash = await collectH3SourceHash(storyboard)
  const error = h3FreshnessError(currentHash, storyboard.minimaxH3SourceHash)
  if (error) {
    logTaskProgress('H3Source', 'stale-rejected', {
      storyboardId,
      hasStoredHash: !!storyboard.minimaxH3SourceHash,
    })
    return error
  }

  if (submittedReferences != null) {
    const submittedFp = fingerprintSubmittedReferences(normalizeSubmittedReferences(submittedReferences))
    const dbRefs = await collectStoryboardReferenceAssets(storyboardId)
    const dbFp = fingerprintReferenceAssets(dbRefs)
    if (submittedFp !== dbFp) {
      logTaskProgress('H3Source', 'ref-mismatch-rejected', { storyboardId })
      return '参考素材与 H3 生成时不一致，请刷新分镜后重新生成 H3 再提交视频'
    }
  }
  return null
}

/** 分镜当前保存的额外参考素材（保持顺序），格式与前端提交的素材可直接比对 */
export async function collectStoryboardReferenceAssets(storyboardId: number): Promise<ReferenceAssetFingerprintInput[]> {
  const rows = await db.select().from(schema.storyboardReferenceAssets)
    .where(eq(schema.storyboardReferenceAssets.storyboardId, storyboardId))
    .orderBy(asc(schema.storyboardReferenceAssets.sortOrder), asc(schema.storyboardReferenceAssets.id))
  return rows.map((item): ReferenceAssetFingerprintInput => ({
    mediaType: item.mediaType,
    mediaRole: item.mediaRole,
    url: item.url,
  }))
}

/** 清空一批分镜的 H3 来源元数据（提示词本体保留，仅标记过期）。只更新仍有指纹的行。 */
export async function invalidateH3ForStoryboards(storyboardIds: number[], reason: string): Promise<number> {
  const ids = [...new Set(storyboardIds.filter(id => Number.isFinite(id)))]
  if (!ids.length) return 0
  await db.update(schema.storyboards)
    .set({ minimaxH3SourceHash: null, minimaxH3GeneratedAt: null, updatedAt: now() })
    .where(and(
      isNotNull(schema.storyboards.minimaxH3SourceHash),
      inArray(schema.storyboards.id, ids),
    ))
  logTaskProgress('H3Source', 'invalidate', { reason, storyboards: ids.length })
  return ids.length
}

/** 角色设定图/信息更新后：失效所有绑定了该角色的分镜 H3 */
export async function invalidateH3ForCharacter(characterId: number, reason = 'character-updated'): Promise<number> {
  const links = await db.select().from(schema.storyboardCharacters)
    .where(eq(schema.storyboardCharacters.characterId, characterId))
  return invalidateH3ForStoryboards(links.map(link => link.storyboardId), `${reason}:character:${characterId}`)
}

/** 道具设定图/信息更新后：失效所有绑定了该道具的分镜 H3 */
export async function invalidateH3ForProp(propId: number, reason = 'prop-updated'): Promise<number> {
  const links = await db.select().from(schema.storyboardProps)
    .where(eq(schema.storyboardProps.propId, propId))
  return invalidateH3ForStoryboards(links.map(link => link.storyboardId), `${reason}:prop:${propId}`)
}

/** 场景设定图/信息更新后：失效所有绑定该场景的分镜 H3 */
export async function invalidateH3ForScene(sceneId: number, reason = 'scene-updated'): Promise<number> {
  const rows = await db.select({ id: schema.storyboards.id }).from(schema.storyboards)
    .where(eq(schema.storyboards.sceneId, sceneId))
  return invalidateH3ForStoryboards(rows.map(row => row.id), `${reason}:scene:${sceneId}`)
}
