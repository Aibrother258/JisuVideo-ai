/**
 * PR #3 复核第三轮回归测试
 *
 * 覆盖三项 P1 阻塞 + 一项建议：
 * 1. 跨重启超时：轮询绝对 deadline 持久化（params.pollDeadline），重启不重置 45 分钟全局上限；
 *    withRetry 每次尝试用最新剩余时间，不复用已过期剩余时间。
 * 2. 两实例认领：恢复采用 recovery_at 租约列 + 条件更新原子认领，只有更新成功的一方启动后台续跑。
 * 3. 实际配置 ID：持久化的是「最终解析成功、实际发起请求」的配置 ID，而非原始 params.configId。
 * 4. 建议：上游已返回 completed 但缺少结果 URL → 立即标记失败，不继续轮询。
 */
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

// ─── 1. 跨重启超时：computePollDeadline 行为单测 ───────────────────────────
const { computePollDeadline } = await import('../src/utils/task-lifecycle.ts')

test('computePollDeadline：恢复任务沿用持久化 deadline，重启不重置全局上限', () => {
  const maxDurationMs = 45 * 60_000

  // 未过期 → 原样沿用（跨重启不重置）
  const future = Date.now() + 10 * 60_000
  assert.equal(computePollDeadline({ pollDeadline: future }, maxDurationMs), future)

  // 已过期 → 仍原样沿用，恢复入口应立即判失败，绝不能重新生成完整窗口
  const expired = Date.now() - 1000
  assert.equal(computePollDeadline({ pollDeadline: expired }, maxDurationMs), expired)

  // 无持久化值 → 生成
  const fresh = computePollDeadline({}, maxDurationMs)
  assert.ok(fresh > Date.now() + 44 * 60_000)

  // 无全局上限（图片以外的兜底配置）→ 不启用 deadline
  assert.equal(computePollDeadline({ pollDeadline: future }, null), null)
})

test('pollTask 持久化 deadline 且以 deadline 约束循环/重试/终态', () => {
  const generation = read('src/services/generation.ts')

  // taskId 与首次 deadline 在 markPolling 一起持久化，消除“先写 taskId 后崩溃”的窗口
  assert.match(generation, /async function markPolling\(record: SysTaskRecord, taskId: string \| undefined\)/)
  assert.match(generation, /taskId, params: JSON\.stringify\(nextParams\), status: 'processing'/)
  assert.match(generation, /const deadline = computePollDeadline\(params, POLL_PROFILES\[record\.type as TaskType\]\.maxDurationMs\)/)

  // 循环头用绝对 deadline 判超时，而非「每次重启重置的 Date.now() 起点」
  assert.match(generation, /if \(deadline && Date\.now\(\) >= deadline\)/)
  assert.doesNotMatch(generation, /const startedAt = Date\.now\(\)/)

  // withRetry 每次尝试（含重试）都用最新剩余时间，不复用已过期剩余时间
  assert.match(generation, /const remainingNow = deadline \? Math\.max\(1_000, deadline - Date\.now\(\)\) : 600_000/)
  assert.doesNotMatch(generation, /const remainingMs = profile\.maxDurationMs/)

  // 建议项：completed 但缺结果 URL → 立即失败，不继续轮询
  assert.match(generation, /上游已返回 completed 但缺少结果 URL/)
})

// ─── 2. 两实例认领：所有执行路径共用 recovery_at 租约 ─────────────────────
test('正常执行与恢复都通过同一条件更新租约认领，避免滚动重启双跑', () => {
  const generation = read('src/services/generation.ts')
  const recovery = read('src/services/recovery.ts')

  // 条件更新：status=processing 且租约窗口内未认领（recovery_at 空或已过期）
  assert.match(generation, /UPDATE sys_task SET recovery_at = \?, recovery_owner = \?, updated_at = \? WHERE id = \? AND status = \? AND \(recovery_at IS NULL OR recovery_at = \\'\\' OR CAST\(recovery_at AS UNSIGNED\) < \?\)/)
  assert.match(generation, /async function acquireTaskLease/)
  assert.match(generation, /async function refreshTaskLease/)
  assert.match(generation, /recovery_owner = \?/, 'heartbeat and release must be owner-scoped')
  assert.match(generation, /lease = await acquireTaskLease\(id\)/)
  assert.match(generation, /if \(!lease\)/)
  // 租约必须先于并发槽位取得；排队中的正常任务也不能被启动恢复误杀。
  assert.ok(generation.indexOf('const lease = await acquireTaskLease(id)') < generation.indexOf('await slots.acquire({ id, type })'))
  // recovery 不另写租约，而是进入统一 processTask 路径
  assert.match(recovery, /resumeTaskById\(task\.id\)/)
  assert.doesNotMatch(recovery, /UPDATE sys_task SET recovery_at/)
  // 无 taskId 的任务只有在扫描时无有效租约、且条件更新仍成立时才会被标失败。
  assert.match(recovery, /const leaseUntil = Number\(task\.recoveryAt\)/)
  assert.match(recovery, /leaseUntil > claimTime/)
  assert.match(recovery, /WHERE id = \? AND status = \? AND \(recovery_at IS NULL OR recovery_at = \\'\\' OR CAST\(recovery_at AS UNSIGNED\) < \?\)/)
})

test('sys_task 增加 recovery_at / recovery_owner 列（含已有库幂等 ALTER）', () => {
  const schema = read('src/db/schema.ts')
  const mysqlSchema = read('src/db/mysql-schema.ts')

  assert.match(schema, /recoveryAt: varchar\('recovery_at', \{ length: 64 \}\)/)
  assert.match(schema, /recoveryOwner: varchar\('recovery_owner', \{ length: 64 \}\)/)
  assert.match(mysqlSchema, /recovery_at VARCHAR\(64\)/)
  assert.match(mysqlSchema, /recovery_owner VARCHAR\(64\)/)
  // CREATE TABLE IF NOT EXISTS 不给已有表补列，须有幂等 ALTER
  assert.match(mysqlSchema, /ALTER TABLE sys_task ADD COLUMN recovery_at VARCHAR\(64\) AFTER completed_at/)
  assert.match(mysqlSchema, /ALTER TABLE sys_task ADD COLUMN recovery_owner VARCHAR\(64\) AFTER recovery_at/)
})

// ─── 3. 实际配置 ID：持久化实际生效配置而非原始参数 ─────────────────────────
test('持久化「实际生效」的配置 ID（指定失效/未指定时回退 active 并记录其 ID）', () => {
  const generation = read('src/services/generation.ts')

  // 统一解析入口：返回实际使用的配置及其 ID
  assert.match(generation, /async function resolveConfig\(type: 'image' \| 'video', requestedConfigId\?: number\)/)
  // active 兜底时通过单次读取同时获得 config 与 id，不能用两条独立查询拼接快照
  assert.match(generation, /const active = await getActiveConfigWithId\(type\)/)
  assert.match(generation, /return \{ config: active\.config, configId: active\.id \}/)

  // 传给 createTask 的是局部 configId（实际生效），而非原始 params.configId
  assert.match(generation, /const \{ config, configId \} = await resolveConfig\('image', params\.configId\)/)
  assert.match(generation, /const \{ config, configId \} = await resolveConfig\('video', params\.configId\)/)
  assert.match(generation, /}, configId\)/)

  // import 引入了单快照解析 helper
  assert.match(generation, /import \{ getActiveConfig, getActiveConfigWithId, getConfigById \} from '\.\/ai\.js'/)
})
