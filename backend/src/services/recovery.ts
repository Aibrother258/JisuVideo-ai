/**
 * 启动恢复 — 处理上次进程中断留下的中间状态：
 * 1. 命名锁（GET_LOCK）串行化恢复，多实例/滚动重启时同一时间只有一个实例执行，避免重复认领
 * 2. video_merges 残留 processing → failed（FFmpeg 拼接是本地操作，重启即中断且无上游任务可续）
 * 3. sys_task 中有上游 taskId 的视频任务 → 认领续跑（轮询只读，不重复提交不重复扣费）
 * 4. 图片任务 / 无 taskId 的视频任务（可能已扣费）→ 标 failed 引导手动重试，绝不自动重提
 */
import { eq } from 'drizzle-orm'
import { db, pool, schema } from '../db/index.js'
import { now } from '../utils/response.js'
import { logTaskError, logTaskStart, logTaskSuccess, logTaskWarn } from '../utils/task-logger.js'
import { resumeTaskById } from './generation.js'

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
          // 有上游 taskId：安全续跑（轮询只读，不重复提交不重复扣费），后台异步执行
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
