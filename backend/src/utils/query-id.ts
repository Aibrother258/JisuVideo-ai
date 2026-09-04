/**
 * 解析查询参数中的记录 ID（drama_id / episode_id / storyboard_id 等）。
 *
 * 返回三态判别联合，把「未提供」「非法」「合法」明确区分开：
 *
 * - absent  —— 参数未出现或为空串（沿用旧契约：不增加过滤条件）；
 * - invalid —— 参数已提供但非「大于 0 的安全整数」（含非数字、小数、负数、
 *   零、纯空格、超精度整数等）：路由必须返回 400，禁止静默省略过滤条件；
 * - id      —— 合法正整数。
 *
 * 为什么非法值要返回 400 而不是按「未传」处理：如果非法值被静默省略过滤，
 * 会把原本受限的查询（如 /tasks?storyboard_id=abc）放大成全量查询，
 * 造成跨项目数据误展示，并为以后的权限隔离埋下隐患。背景见
 * docs/product-positioning-roadmap.md §13 双 Fork 协作中 Fork B 的 API 边界校验分工。
 *
 * 语法语义：接受十进制纯数字串（允许首位零，Number 语义与旧代码一致），
 * 拒绝 '1e3' / '0x1F' / '+7' 等非十进制写法；外层空格先 trim 再判定。
 */
export type RecordIdParam =
  | { kind: 'absent' }
  | { kind: 'invalid' }
  | { kind: 'id'; id: number }

export function parseRecordId(raw: string | undefined | null): RecordIdParam {
  if (raw == null || raw === '') return { kind: 'absent' }
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return { kind: 'invalid' }
  const n = Number(trimmed)
  if (!Number.isSafeInteger(n) || n <= 0) return { kind: 'invalid' }
  return { kind: 'id', id: n }
}
