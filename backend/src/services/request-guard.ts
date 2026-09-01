interface GuardState {
  startedAt: number
  requests: number
  active: number
}

const states = new Map<string, GuardState>()
const WINDOW_MS = 60_000

export function acquireAiRequest(key: string, maxRequests = 6, maxConcurrent = 1) {
  const current = Date.now()
  let state = states.get(key)
  if (!state || current - state.startedAt >= WINDOW_MS) {
    state = { startedAt: current, requests: 0, active: 0 }
    states.set(key, state)
  }
  if (state.requests >= maxRequests) {
    return { ok: false as const, message: 'AI 请求过于频繁，请稍后再试', retryAfter: Math.ceil((WINDOW_MS - (current - state.startedAt)) / 1000) }
  }
  if (state.active >= maxConcurrent) {
    return { ok: false as const, message: '同一项目已有 AI 分析正在进行，请等待完成后再试', retryAfter: 3 }
  }
  state.requests += 1
  state.active += 1
  let released = false
  return {
    ok: true as const,
    release() {
      if (released) return
      released = true
      state!.active = Math.max(0, state!.active - 1)
    },
  }
}
