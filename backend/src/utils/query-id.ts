/**
 * 解析查询参数中的记录 ID（drama_id / episode_id / storyboard_id 等）。
 *
 * 返回「大于 0 的安全整数」，其余情况（缺失、空串、非数字、非正数、超精度）一律返回 undefined，
 * 由调用方按「未传该过滤条件」处理。
 *
 * 背景：URL 查询参数到 SQL 过滤之间必须收敛数值转换，避免 Number('abc') 得到 NaN 后
 * 经 eq() 直接进入 SQL 绑定参数（MySQL 驱动对 NaN 的编码行为不一致，可能抛错或产生脏过滤）。
 * 与列表分页参数（page / page_size）的「parseInt + NaN 兜底」策略保持同一防御基线。
 */
export function parseRecordId(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === '') return undefined
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : undefined
}
