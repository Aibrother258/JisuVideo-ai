/**
 * MiniMax H3 提示词来源指纹
 *
 * H3 提示词是「分镜文本 + 正式绑定素材 + 额外参考素材」的派生产物，
 * 这些输入任意一项变化，已保存的 H3 提示词就不再代表当前投产输入。
 *
 * 本模块是指纹的唯一计算入口：生成时用 `collectH3SourceHash` 记录来源，
 * 失效判断时用同一个函数比对现状。这样即使前端用完全相同的内容重复提交
 * （页面刷新、切换分镜恢复状态），指纹也不会变化，H3 不会被误判为过期。
 *
 * 纳入指纹的输入：
 * - 分镜文本：video_prompt / description / atmosphere / duration
 * - 场景绑定：scene_id + 场景设定图版本（重新生成场景图会改变 H3 输入）
 * - 角色绑定：character_ids + 各自设定图版本
 * - 道具绑定：prop_ids + 各自设定图版本
 * - 额外参考：storyboard_reference_assets 的类型 / 角色 / URL / 顺序
 *
 * 顺序敏感：参考素材顺序变化会改变 H3 里的 <Picture N> / <Video N> / <Audio N> 编号。
 */
import crypto from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type StoryboardRow = typeof schema.storyboards.$inferSelect
export type ReferenceAssetRow = typeof schema.storyboardReferenceAssets.$inferSelect
type CharacterRow = typeof schema.characters.$inferSelect
type PropRow = typeof schema.props.$inferSelect
type SceneRow = typeof schema.scenes.$inferSelect

/** 段落分隔符：避免不同字段拼接后产生歧义（例如描述末尾换行 + 下一段开头数字） */
const SECTION_SEPARATOR = '\n---\n'

export interface H3SourceParts {
  videoPrompt: string
  description: string
  atmosphere: string
  duration: string
  /** 场景绑定 + 场景设定图版本 */
  sceneVersion: string
  /** 角色绑定 + 各自设定图版本 */
  characterVersions: string
  /** 道具绑定 + 各自设定图版本 */
  propVersions: string
  /** 额外参考素材指纹 */
  referenceAssets: string
}

/** 额外参考素材指纹。顺序敏感，保证 <Picture N> 编号变化能被发现。 */
export function fingerprintReferenceAssets(items: readonly ReferenceAssetRow[]): string {
  return [...items]
    .sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id))
    .map(item => `${item.mediaType}:${item.mediaRole}:${item.url}`)
    .join('\n')
}

export function computeH3SourceHash(parts: H3SourceParts): string {
  return crypto.createHash('sha256')
    .update([
      parts.videoPrompt,
      parts.description,
      parts.atmosphere,
      parts.duration,
      parts.sceneVersion,
      parts.characterVersions,
      parts.propVersions,
      parts.referenceAssets,
    ].join(SECTION_SEPARATOR))
    .digest('hex')
}

/** 汇总一个分镜当前的全部 H3 来源输入 */
export async function collectH3SourceParts(storyboard: StoryboardRow): Promise<H3SourceParts> {
  const [characterLinks, propLinks, referenceAssets] = await Promise.all([
    db.select().from(schema.storyboardCharacters)
      .where(eq(schema.storyboardCharacters.storyboardId, storyboard.id)),
    db.select().from(schema.storyboardProps)
      .where(eq(schema.storyboardProps.storyboardId, storyboard.id)),
    db.select().from(schema.storyboardReferenceAssets)
      .where(eq(schema.storyboardReferenceAssets.storyboardId, storyboard.id)),
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

  // 绑定 ID 决定引用谁，image_url / local_path 决定引用的是哪个版本的图。
  // 重新生成角色设定图只改 image_url，因此必须纳入指纹。
  const versionOf = (row: { imageUrl?: string | null; localPath?: string | null } | undefined) =>
    `${row?.imageUrl || ''}|${row?.localPath || ''}`

  return {
    videoPrompt: storyboard.videoPrompt || '',
    description: storyboard.description || '',
    atmosphere: storyboard.atmosphere || '',
    duration: String(storyboard.duration ?? ''),
    sceneVersion: `${storyboard.sceneId ?? ''}|${versionOf(scene)}`,
    characterVersions: characterIds
      .map(id => `${id}|${versionOf(characterMap.get(id))}`)
      .join('\n'),
    propVersions: propIds
      .map(id => `${id}|${versionOf(propMap.get(id))}`)
      .join('\n'),
    referenceAssets: fingerprintReferenceAssets(referenceAssets),
  }
}

/** 分镜当前的 H3 来源指纹。保存与失效判断都必须走这里，避免两套算法。 */
export async function collectH3SourceHash(storyboard: StoryboardRow): Promise<string> {
  return computeH3SourceHash(await collectH3SourceParts(storyboard))
}
