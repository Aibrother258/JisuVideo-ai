/**
 * 进程内并发控制 — 生成任务信号量。
 * 视频/图片批量生成时限制同时运行的任务数，防止一次提交过多任务打爆厂商 API。
 * 并发数可用环境变量覆盖：VIDEO_CONCURRENCY / IMAGE_CONCURRENCY
 */
import { logTaskProgress } from './task-logger.js'

export class Semaphore {
  private active = 0
  private readonly queue: Array<() => void> = []

  constructor(
    private readonly limit: number,
    private readonly name: string,
  ) {}

  get activeCount(): number {
    return this.active
  }

  get waitingCount(): number {
    return this.queue.length
  }

  /** 等待可用槽位（可能立即返回），拿到后必须配对 release */
  async acquire(meta?: Record<string, unknown>): Promise<void> {
    if (this.active >= this.limit) {
      logTaskProgress('Concurrency', `${this.name}-queue-wait`, {
        ...meta,
        active: this.active,
        waiting: this.queue.length + 1,
        limit: this.limit,
      })
      await new Promise<void>(resolve => this.queue.push(resolve))
    }
    this.active++
    logTaskProgress('Concurrency', `${this.name}-acquire`, {
      ...meta,
      active: this.active,
      waiting: this.queue.length,
      limit: this.limit,
    })
  }

  /** 释放槽位并唤醒下一个排队任务 */
  release(meta?: Record<string, unknown>): void {
    this.active = Math.max(0, this.active - 1)
    const next = this.queue.shift()
    if (next) next()
    logTaskProgress('Concurrency', `${this.name}-release`, {
      ...meta,
      active: this.active,
      waiting: this.queue.length,
    })
  }
}

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : fallback
}

/** 视频生成并发上限（含恢复续跑的任务），默认 2 */
export const videoSlot = new Semaphore(envInt('VIDEO_CONCURRENCY', 2), 'VideoSlot')

/** 图片生成并发上限，默认 4 */
export const imageSlot = new Semaphore(envInt('IMAGE_CONCURRENCY', 4), 'ImageSlot')
