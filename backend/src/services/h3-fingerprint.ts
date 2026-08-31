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
  if (!row) return '||'
  return `${row.imageUrl || ''}|${row.localPath || ''}|${row.updatedAt || ''}`
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
