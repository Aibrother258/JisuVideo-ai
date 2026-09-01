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
const { computePollDeadline } = await import('../src/services/generation.ts')

test('computePollDeadline：恢复任务沿用持久化 deadline，重启不重置全局上限', () => {
  const maxDurationMs = 45 * 60_000

  // 未过期 → 原样沿用（跨重启不重置）
  const future = Date.now() + 10 * 60_000
  assert.equal(computePollDeadline({ pollDeadline: future }, maxDurationMs), future)

  // 已过期 → 重新生成完整窗口
  const past = computePollDeadline({ pollDeadline: Date.now() - 1000 }, maxDurationMs)
  assert.ok(past > Date.now() + 44 * 60_000, '已过期 deadline 应重新生成完整窗口')

  // 无持久化值 → 生成
  const fresh = computePollDeadline({}, maxDurationMs)
  assert.ok(fresh > Date.now() + 44 * 60_000)

  // 无全局上限（图片以外的兜底配置）→ 不启用 deadline
  assert.equal(computePollDeadline({ pollDeadline: future }, null), null)
})

test('pollTask 持久化 deadline 且以 deadline 约束循环/重试/终态', () => {
  const generation = read('src/services/generation.ts')

  // 持久化：首次进入写 params.pollDeadline，恢复时沿用
  assert.match(generation, /const deadline = computePollDeadline\(params, profile\.maxDurationMs\)/)
  assert.match(generation, /pollDeadline: deadline/)

  // 循环头用绝对 deadline 判超时，而非「每次重启重置的 Date.now() 起点」
  assert.match(generation, /if \(deadline && Date\.now\(\) >= deadline\)/)
  assert.doesNotMatch(generation, /const startedAt = Date\.now\(\)/)

  // withRetry 每次尝试（含重试）都用最新剩余时间，不复用已过期剩余时间
  assert.match(generation, /const remainingNow = deadline \? Math\.max\(1_000, deadline - Date\.now\(\)\) : 600_000/)
  assert.doesNotMatch(generation, /const remainingMs = profile\.maxDurationMs/)

  // 建议项：completed 但缺结果 URL → 立即失败，不继续轮询
  assert.match(generation, /上游已返回 completed 但缺少结果 URL/)
})

// ─── 2. 两实例认领：recovery_at 租约 + 条件更新原子认领 ─────────────────────
test('恢复采用条件更新原子认领，只有认领成功的一方启动后台续跑', () => {
  const recovery = read('src/services/recovery.ts')

  // 租约列写入
  assert.match(recovery, /SET recovery_at = \?, recovery_owner = \?, updated_at = \?/)
  // 条件更新：status=processing 且租约窗口内未认领（recovery_at 空或已过期）
  assert.match(recovery, /status = \? AND \(recovery_at IS NULL OR recovery_at = \\'\\' OR CAST\(recovery_at AS UNSIGNED\) < \?\)/)
  // 只有 affectedRows === 1 才续跑；否则跳过
  assert.match(recovery, /const affected = claimRes\?\.affectedRows \?\? 0/)
  assert.match(recovery, /if \(affected !== 1\)/)
  assert.match(recovery, /claim-skipped/)
  assert.match(recovery, /resumeTaskById\(task\.id\)/)
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

  // 统一解析入口：返回 { config, configId }
  assert.match(generation, /async function resolveConfig\(type: 'image' \| 'video', requestedConfigId\?: number\)/)
  assert.match(generation, /return \{ config, configId \}/)
  // active 兜底时同时取 getActiveConfig 与 getActiveConfigId（两者过滤/排序一致）
  assert.match(generation, /const \[config, configId\] = await Promise\.all\(\[getActiveConfig\(type\), getActiveConfigId\(type\)\]\)/)

  // 传给 createTask 的是局部 configId（实际生效），而非原始 params.configId
  assert.match(generation, /const \{ config, configId \} = await resolveConfig\('image', params\.configId\)/)
  assert.match(generation, /const \{ config, configId \} = await resolveConfig\('video', params\.configId\)/)
  assert.match(generation, /}, configId\)/)

  // import 引入了 getActiveConfigId
  assert.match(generation, /import \{ getActiveConfig, getActiveConfigId, getConfigById \} from '\.\/ai\.js'/)
})
