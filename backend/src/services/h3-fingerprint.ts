/**
 * MiniMax H3 来源指纹 — 纯函数层
 *
 * 本文件刻意不引入任何数据库/框架依赖，使指纹算法可以在无 MySQL 的
 * 环境下直接做行为测试（`npm run test:h3`）。
 * 需要读库的入口（collectH3SourceHash / verifyH3PromptFreshness / 失效钩子）
 * 见同目录 h3-source.ts。
 *
 * 指纹覆盖的输入（任意一项变化，已保存的 H3 提示词就不再代表当前投产输入）：
 * - 分镜文本：video_prompt / description / atmosphere / duration
 * - 场景绑定：scene_id + 场景设定图版本
 * - 角色绑定：character_ids + 各自设定图版本
 * - 道具绑定：prop_ids + 各自设定图版本
 * - 首帧/尾帧图版本（影响 H3 的 T2VA/I2VA/Ref2VA 模式判定）
 * - 额外参考素材：类型 / 角色 / URL / 顺序
 *
 * 资产版本包含 updatedAt：文件内容变化但路径不变时也能识别。
 */
import crypto from 'node:crypto'

/** 参考素材指纹的最小输入（storyboard_reference_assets 行的子集，按目标顺序传入） */
export interface ReferenceAssetFingerprintInput {
  mediaType: string
  mediaRole: string
  url: string
}

/** 参与 H3 输入的资产（角色/场景/道具）版本描述 */
export interface AssetVersionInput {
  imageUrl?: string | null
  localPath?: string | null
  /** 任意保存都会刷新；同路径新内容靠它识别 */
  updatedAt?: string | null
  /** 软删除时间：资产被删除后，绑定了它的分镜 H3 同样不再代表当前输入 */
  deletedAt?: string | null
}

/** H3 来源指纹的组成段落 */
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
  /** 首帧/尾帧图版本 */
  frameVersion: string
  /** 额外参考素材指纹 */
  referenceAssets: string
}

/** 段落分隔符：避免不同字段拼接后产生歧义（例如描述末尾换行 + 下一段开头数字） */
const SECTION_SEPARATOR = '\n---\n'

export function assetVersion(row: AssetVersionInput | undefined): string {
  if (!row) return '|||'
  return `${row.imageUrl || ''}|${row.localPath || ''}|${row.updatedAt || ''}|${row.deletedAt || ''}`
}

/**
 * 额外参考素材指纹。顺序敏感：
 * 顺序变化会改变 H3 里的 <Picture N> / <Video N> / <Audio N> 编号，
 * 因此调用方必须按目标顺序传入。
 */
export function fingerprintReferenceAssets(items: readonly ReferenceAssetFingerprintInput[]): string {
  return items
    .map(item => `${item.mediaType}:${item.mediaRole}:${item.url}`)
    .join('\n')
}

/** 前端提交的参考素材（仅额外素材：手动选择/上传的图片、视频、音频） */
export interface SubmittedReferences {
  images?: unknown[]
  videos?: unknown[]
  audios?: unknown[]
}

/** 归一化前端提交的参考素材：只保留字符串 URL、保持顺序、丢弃空项 */
export function normalizeSubmittedReferences(raw: unknown): SubmittedReferences {
  if (!raw || typeof raw !== 'object') return {}
  const source = raw as Record<string, unknown>
  const urls = (value: unknown) => Array.isArray(value)
    ? value.map(item => String(item ?? '').trim()).filter(Boolean)
    : []
  return { images: urls(source.images), videos: urls(source.videos), audios: urls(source.audios) }
}

/**
 * 把前端提交的额外参考素材转成与 storyboardReferenceAssets 相同的指纹格式。
 * 与 fingerprintReferenceAssets 完全同构，只是媒体角色固定为 reference，
 * 因此两份指纹可直接做字符串比较。
 */
export function fingerprintSubmittedReferences(submitted: SubmittedReferences | null | undefined): string {
  if (!submitted) return ''
  const items: ReferenceAssetFingerprintInput[] = [
    ...(submitted.images || []).map(url => ({ mediaType: 'image', mediaRole: 'reference', url: String(url) })),
    ...(submitted.videos || []).map(url => ({ mediaType: 'video', mediaRole: 'reference', url: String(url) })),
    ...(submitted.audios || []).map(url => ({ mediaType: 'audio', mediaRole: 'reference', url: String(url) })),
  ]
  return fingerprintReferenceAssets(items)
}

/**
 * 与前端 episode.vue 的 normalizeMediaUrl 等价：空值返回空串，
 * http(s)/data:/根路径开头原样保留，其余补根路径前缀。
 * 服务端重建参考列表时必须用同一套归一化，否则与前端提交的 URL 无法逐项比对。
 */
export function normalizeReferenceImageUrl(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw || /^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('/')) return raw
  return `/${raw}`
}

/** 服务端重建完整参考图片列表时所需的最小资产字段。 */
export interface ReferenceImageAssetInput {
  id?: number | null
  imageUrl?: unknown
  deletedAt?: unknown
  name?: unknown
  role?: unknown
}

/** 与前端 episode.vue 的 isNarratorCharacter 保持一致。 */
export function isNarratorReferenceAsset(asset: ReferenceImageAssetInput | null | undefined): boolean {
  const text = `${String(asset?.name ?? '')} ${String(asset?.role ?? '')}`.toLowerCase()
  return text.includes('旁白') || text.includes('narrator') || text.includes('画外音')
}

/**
 * 按前端 getShotReferenceImages 的正式规则重建完整参考图片列表：
 * 可见场景图 -> 可见非旁白角色图（ID 升序）-> 可见道具图（ID 升序）
 * -> 已按 sort_order 排好的额外图片；最后统一归一化、去重并限制为 9 张。
 *
 * 把规则放在纯函数层，确保软删除、旁白过滤与顺序可以脱离数据库做行为测试。
 */
export function buildFullReferenceImageList(input: {
  scene?: ReferenceImageAssetInput | null
  characters?: readonly ReferenceImageAssetInput[]
  props?: readonly ReferenceImageAssetInput[]
  extraImages?: readonly unknown[]
}): string[] {
  const refs: string[] = []
  const pushRef = (value: unknown) => {
    const normalized = normalizeReferenceImageUrl(value)
    if (!normalized || refs.includes(normalized) || refs.length >= 9) return
    refs.push(normalized)
  }
  const byId = (a: ReferenceImageAssetInput, b: ReferenceImageAssetInput) => Number(a.id ?? 0) - Number(b.id ?? 0)

  if (input.scene && !input.scene.deletedAt) pushRef(input.scene.imageUrl)
  for (const character of [...(input.characters || [])]
    .filter(item => !item.deletedAt && !isNarratorReferenceAsset(item))
    .sort(byId)) {
    pushRef(character.imageUrl)
  }
  for (const prop of [...(input.props || [])]
    .filter(item => !item.deletedAt)
    .sort(byId)) {
    pushRef(prop.imageUrl)
  }
  for (const image of input.extraImages || []) pushRef(image)
  return refs
}

/** 逐项比较两份参考素材列表：长度与每一项都必须一致（顺序敏感） */
export function sameReferenceList(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/** 服务端重建的当前参考素材状态（不信任客户端快照） */
export interface ReferenceStateSnapshot {
  /** 完整图片列表：场景图 + 角色图 + 道具图 + 数据库额外图片（已归一化、去重、≤9） */
  images: readonly string[]
  /** 数据库保存的额外视频（顺序敏感） */
  videos: readonly string[]
  /** 数据库保存的额外音频（顺序敏感） */
  audios: readonly string[]
}

/**
 * 校验本次请求携带的实际参考素材（reference_image_urls / reference_video_urls /
 * reference_audio_urls）与服务端重建的当前状态逐项一致。
 * 返回 null 表示一致；返回字符串为拒绝原因。
 *
 * 不信任客户端快照：调用者可以在快照里填数据库的正确值、实际生成数组里放
 * 另一套素材，因此这里只比较请求中的实际数组，与快照完全无关。
 */
export function referenceMismatchError(
  db: ReferenceStateSnapshot,
  submitted: SubmittedReferences | null | undefined,
): string | null {
  if (submitted == null) return null
  const sImages = (submitted.images || []).map(normalizeReferenceImageUrl)
  const sVideos = (submitted.videos || []).map(normalizeReferenceImageUrl)
  const sAudios = (submitted.audios || []).map(normalizeReferenceImageUrl)
  if (!sameReferenceList(db.images, sImages)) {
    return '参考图片与分镜当前绑定的素材不一致，请刷新分镜后重新生成 H3 再提交视频'
  }
  if (!sameReferenceList(db.videos, sVideos)) {
    return '参考视频与数据库保存的额外素材不一致，请刷新分镜后重新生成 H3 再提交视频'
  }
  if (!sameReferenceList(db.audios, sAudios)) {
    return '参考音频与数据库保存的额外素材不一致，请刷新分镜后重新生成 H3 再提交视频'
  }
  return null
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
      parts.frameVersion,
      parts.referenceAssets,
    ].join(SECTION_SEPARATOR))
    .digest('hex')
}

/**
 * 视频任务提交时的服务端兜底校验（纯决策部分）。
 * 返回 null 表示无需拦截；返回字符串为拒绝原因。
 *
 * 用途：前端「已过期」提示可以被绕过（直接调 API），服务端在提交瞬间
 * 重新计算指纹与存储值比对，做最终裁决。
 */
export function h3FreshnessError(currentHash: string, storedHash: string | null | undefined): string | null {
  if (!storedHash) return 'H3 提示词已过期（缺少来源指纹），请重新生成 H3 后再提交视频'
  if (currentHash !== storedHash) return 'H3 提示词已过期（分镜内容或参考素材已变化），请重新生成 H3 后再提交视频'
  return null
}
