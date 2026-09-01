/**
 * 启动恢复 — 处理上次进程中断留下的中间状态：
 * 1. video_merges 残留 processing → failed（FFmpeg 拼接是本地操作，重启即中断且无上游任务可续）
 * 2. sys_task 中 processing 的视频任务 → 认领恢复（有上游 taskId 续轮询，否则重新提交）
 * 3. sys_task 中 processing 的图片任务 → 标 failed（图片轮询窗口仅 10 分钟，重启后大概率已过期）
 */
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { now } from '../utils/response.js'
import { logTaskError, logTaskStart, logTaskSuccess, logTaskWarn } from '../utils/task-logger.js'
import { resumeTaskById } from './generation.js'

export async function recoverInterruptedTasks(): Promise<void> {
  const startedAt = Date.now()
  logTaskStart('Recovery', 'interrupted-tasks', {})

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

  // 2/3. 处理中断的生成任务
  let resumed = 0
  let failed = 0
  try {
    const tasks = await db.select().from(schema.sysTask).where(eq(schema.sysTask.status, 'processing'))
    for (const task of tasks) {
      if (task.type === 'video') {
        // 视频任务值得恢复：上游任务 ID 可能仍有效，续轮询或重新提交
        resumeTaskById(task.id).catch(err => {
          failed++
          logTaskError('Recovery', 'resume-failed', { id: task.id, error: err.message })
        })
        resumed++
      } else {
        // 图片任务轮询窗口短，直接标失败引导用户重试
        try {
          await db.update(schema.sysTask)
            .set({ status: 'failed', errorMsg: '服务重启，图片任务已中断，请重试', updatedAt: now() })
            .where(eq(schema.sysTask.id, task.id))
        } catch (err: any) {
          logTaskError('Recovery', 'image-fail-failed', { id: task.id, error: err.message })
        }
        failed++
      }
    }
  } catch (err: any) {
    logTaskError('Recovery', 'tasks-scan-failed', { error: err.message })
  }

  logTaskSuccess('Recovery', 'interrupted-tasks', {
    resumed,
    failed,
    elapsedMs: Date.now() - startedAt,
  })
}
