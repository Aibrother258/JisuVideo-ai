/**
 * 启动恢复 — 处理上次进程中断留下的中间状态：
 * 1. 命名锁（GET_LOCK）串行化恢复入口，多实例/滚动重启时同一时间只有一个实例执行扫描
 * 2. video_merges 残留 processing → failed（FFmpeg 拼接是本地操作，重启即中断且无上游任务可续）
 * 3. sys_task 中有上游 taskId 的视频任务 → 条件更新原子认领后续跑（轮询只读，不重复提交不重复扣费）；
 *    recovery_at 租约列保证同一任务只有认领成功的一方启动后台轮询，双实例不会双重续轮询
 * 4. 图片任务 / 无 taskId 的视频任务（可能已扣费）→ 标 failed 引导手动重试，绝不自动重提
 */
import { eq } from 'drizzle-orm'
import { db, pool, schema } from '../db/index.js'
import { now } from '../utils/response.js'
import { logTaskError, logTaskStart, logTaskSuccess, logTaskWarn } from '../utils/task-logger.js'
import { resumeTaskById } from './generation.js'

/** 认领租约时长：覆盖视频轮询全局上限(45min)+缓冲，租约内另一实例不得重新认领 */
const LEASE_MS = 60 * 60_000
/** 当前实例标识（认领者写入 recovery_owner） */
const INSTANCE_ID = `${process.pid}:${Date.now()}`

export async function recoverInterruptedTasks(): Promise<void> {
  const startedAt = Date.now()
  logTaskStart('Recovery', 'interrupted-tasks', {})

  // 命名锁串行化：GET_LOCK 是连接级锁，必须同一连接内 RELEASE
  let conn: any
  try {
    conn = await pool.getConnection()
    const [rows] = await conn.query('SELECT GET_LOCK(?, 0) AS got', ['hb-startup-recovery'])
    const got = rows?.[0]?.got
    if (got !== 1) {
      logTaskWarn('Recovery', 'lock-skip', { reason: 'another instance is already running recovery' })
      return
    }
  } catch (err: any) {
    logTaskError('Recovery', 'lock-acquire-failed', { error: err.message })
    return
  }

  try {
    // 1. 清理中断的拼接任务（本地 ffmpeg 操作，无恢复价值，直接标失败引导重拼）
    try {
      const mergeRes = await db.update(schema.videoMerges)
        .set({ status: 'failed', errorMsg: '服务重启，拼接任务中断，请重新拼接' })
        .where(eq(schema.videoMerges.status, 'processing'))
      const mergeCount = (Array.isArray(mergeRes) ? mergeRes[0] : mergeRes)?.affectedRows ?? 0
      if (mergeCount > 0) logTaskWarn('Recovery', 'merges-cleaned', { count: mergeCount })
    } catch (err: any) {
      logTaskError('Recovery', 'merges-clean-failed', { error: err.message })
    }

    // 2/3/4. 处理中断的生成任务
    let claimed = 0
    let failed = 0
    try {
      const tasks = await db.select().from(schema.sysTask).where(eq(schema.sysTask.status, 'processing'))
      for (const task of tasks) {
        if (task.type === 'video' && task.taskId) {
          // 有上游 taskId：条件更新原子认领（唯一将 recovery_at 写入本租约窗口的实例才算认领成功），
          // 只有认领成功的一方启动后台续跑——双实例/滚动重启不会对同一任务双重续轮询/双下载回写。
          // 租约到期后（60min，覆盖 45min 全局轮询上限）才允许其他实例重新认领。
          const claimedAt = Date.now()
          const [claimRes] = await conn.query(
            'UPDATE sys_task SET recovery_at = ?, recovery_owner = ?, updated_at = ? WHERE id = ? AND status = ? AND (recovery_at IS NULL OR recovery_at = \'\' OR CAST(recovery_at AS UNSIGNED) < ?)',
            [String(claimedAt + LEASE_MS), INSTANCE_ID, now(), task.id, 'processing', claimedAt],
          )
          const affected = claimRes?.affectedRows ?? 0
          if (affected !== 1) {
            logTaskWarn('Recovery', 'claim-skipped', { id: task.id, reason: 'already claimed within lease window' })
            continue
          }
          // 轮询只读，不重复提交不重复扣费，后台异步执行
          resumeTaskById(task.id).catch(err => {
            logTaskError('Recovery', 'resume-failed', { id: task.id, error: err.message })
          })
          claimed++
        } else {
          // 图片任务（轮询窗口短）/ 无 taskId 的视频任务（创建请求响应可能已丢失，可能已扣费）：
          // 一律标失败引导手动重试，不自动重提
          const msg = task.type === 'video'
            ? '服务重启，任务在提交阶段中断。为避免重复扣费请手动重新生成'
            : '服务重启，图片任务已中断，请重试'
          try {
            await db.update(schema.sysTask)
              .set({ status: 'failed', errorMsg: msg, updatedAt: now() })
              .where(eq(schema.sysTask.id, task.id))
          } catch (err: any) {
            logTaskError('Recovery', 'task-fail-failed', { id: task.id, error: err.message })
          }
          failed++
        }
      }
    } catch (err: any) {
      logTaskError('Recovery', 'tasks-scan-failed', { error: err.message })
    }

    // claimed 表示已认领并在后台续跑（异步完成），failed 表示已标记失败的任务数
    logTaskSuccess('Recovery', 'interrupted-tasks', {
      claimed,
      failed,
      elapsedMs: Date.now() - startedAt,
    })
  } finally {
    await conn.query('SELECT RELEASE_LOCK(?)', ['hb-startup-recovery']).catch(() => {})
    conn.release()
  }
}
