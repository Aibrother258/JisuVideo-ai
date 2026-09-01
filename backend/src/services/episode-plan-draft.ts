import { createHash } from 'node:crypto'

export interface ReviewableEpisode {
  episode_number: number
  title: string
  summary: string
  content: string
  character_count: number
  reviewed: boolean
  review_note: string
}

export interface ReviewablePlan {
  recommended_count: number
  reason: string
  episodes: ReviewableEpisode[]
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function sourceHash(content: unknown) {
  return sha256(String(content || '').trim())
}

export function normalizeReviewablePlan(raw: any): ReviewablePlan {
  const sourceEpisodes = Array.isArray(raw?.episodes) ? raw.episodes : []
  if (!sourceEpisodes.length || sourceEpisodes.length > 50) throw new Error('分集草稿数量必须在 1-50 集之间')
  let totalContent = 0
  const episodes = sourceEpisodes.map((item: any, index: number) => {
    const title = String(item?.title || `第${index + 1}集`).trim()
    const summary = String(item?.summary || '').trim()
    const content = String(item?.content || '').trim()
    const reviewNote = String(item?.review_note || '').trim()
    if (!content) throw new Error(`第 ${index + 1} 集缺少正文内容`)
    if (title.length > 200) throw new Error(`第 ${index + 1} 集标题超过 200 字`)
    if (summary.length > 4000) throw new Error(`第 ${index + 1} 集摘要超过 4000 字`)
    if (reviewNote.length > 2000) throw new Error(`第 ${index + 1} 集批注超过 2000 字`)
    totalContent += content.length
    return {
      episode_number: index + 1,
      title,
      summary,
      content,
      character_count: content.length,
      reviewed: item?.reviewed === true,
      review_note: reviewNote,
    }
  })
  if (totalContent > 250_000) throw new Error('分集正文总长度超过 25 万字限制')
  const reason = String(raw?.reason || '').trim()
  if (reason.length > 8000) throw new Error('分集建议说明超过 8000 字')
  return { recommended_count: episodes.length, reason, episodes }
}

export function contentFingerprint(plan: ReviewablePlan, resolution: string) {
  return sha256(JSON.stringify({
    resolution: resolution === '480p' ? '480p' : '720p',
    episodes: plan.episodes.map(item => ({
      episode_number: item.episode_number,
      title: item.title,
      summary: item.summary,
      content: item.content,
    })),
  }))
}

export function parseJsonArray(value: unknown) {
  try {
    const parsed = JSON.parse(String(value || '[]'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function serializePlanDraft(row: any) {
  const plan = normalizeReviewablePlan(JSON.parse(String(row.plan_json)))
  return {
    version: Number(row.version),
    source_hash: String(row.source_hash),
    current_content_fingerprint: String(row.content_fingerprint),
    generated_fingerprint: row.generated_fingerprint ? String(row.generated_fingerprint) : '',
    selected_episode_number: row.selected_episode_number ? Number(row.selected_episode_number) : plan.episodes[0]?.episode_number || null,
    resolution: row.resolution === '480p' ? '480p' : '720p',
    revision_count: parseJsonArray(row.revision_history).length,
    updated_at: row.updated_at,
    plan,
  }
}
