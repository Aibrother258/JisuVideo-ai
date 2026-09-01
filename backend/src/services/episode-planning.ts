export interface EpisodeOutlineItem {
  title?: string
  summary?: string
}

function naturalBoundaries(text: string) {
  const result = new Set<number>()
  const pattern = /[。！？!?](?:[”’」』])?|\r?\n\s*\r?\n/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) result.add(match.index + match[0].length)
  return [...result].filter(value => value > 0 && value < text.length).sort((a, b) => a - b)
}

/**
 * 顺序、无遗漏地按自然段/句子将全文切成指定数量的初稿。
 * AI 只负责集数、标题和摘要，正文始终来自用户原文，避免模型改写或漏字。
 */
export function splitSourceIntoEpisodes(content: string, requestedCount: number, outlines: EpisodeOutlineItem[] = []) {
  const normalized = content.trim()
  if (!normalized) return []
  const safeRequested = Math.max(1, Math.min(50, Math.round(requestedCount || 1)))
  const count = Math.min(safeRequested, normalized.length)
  const candidates = naturalBoundaries(normalized)
  const boundaries = [0]
  for (let index = 1; index < count; index += 1) {
    const target = Math.round((normalized.length * index) / count)
    const minimum = boundaries[index - 1] + 1
    const maximum = normalized.length - (count - index)
    const valid = candidates.filter(value => value >= minimum && value <= maximum)
    let boundary = Math.max(minimum, Math.min(maximum, target))
    if (valid.length) {
      boundary = valid.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best, valid[0])
    }
    boundaries.push(boundary)
  }
  boundaries.push(normalized.length)
  const chunks = boundaries.slice(0, -1).map((start, index) => normalized.slice(start, boundaries[index + 1]))

  return chunks.filter(Boolean).map((chunk, index) => ({
    episode_number: index + 1,
    title: String(outlines[index]?.title || `第${index + 1}集`).trim(),
    summary: String(outlines[index]?.summary || '').trim(),
    content: chunk,
    character_count: chunk.length,
  }))
}

export function defaultEpisodeCount(contentLength: number) {
  // 初稿按每集约 2500-4500 中文字符估算，限制在 1-30 集。
  return Math.max(1, Math.min(30, Math.round(contentLength / 3500) || 1))
}
