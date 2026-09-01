/**
 * 生成任务生命周期中的纯时间逻辑。
 * 单独放在无数据库依赖的模块，便于验证重启后的 deadline 语义。
 */
export function computePollDeadline(
  params: Record<string, any> | null | undefined,
  maxDurationMs: number | null,
  currentTime = Date.now(),
): number | null {
  if (!maxDurationMs) return null
  const saved = Number(params?.pollDeadline)
  // 只要已持久化值是合法时间戳就必须沿用；是否已过期由轮询入口立即判定。
  // 把过期值重建为新窗口会让服务重启绕过全局超时。
  if (Number.isFinite(saved) && saved > 0) return saved
  return currentTime + maxDurationMs
}
