/**
 * v0.4 原文版本表 —— source 首行懒生成（S1-1 / Issue #71）
 *
 * 契约依据：docs/source-intelligence-episode-planning-v0.4.md rev8
 *   §6.1 source_versions 字段表 + 跨章不变量 I1 / I2 / I7
 *   §6.3 source 行懒生成（rev3 并发防重）与旧项目零回填
 *
 * 关键约束：
 * - I1  content_hash = sha256(String(content || '').trim())，恒为本行 content 的哈希
 * - I2  source 首行 parent 为 NULL → base_hash = 自身 content_hash（NOT NULL，不落库 NULL）
 * - I7  版本行完全不可变：INSERT 后无任何 UPDATE / DELETE 路径
 * - 并发防重：事务内锁 dramas 行 → 锁内判定「是否已有任意版本行」→ 无则 INSERT + 回填指针
 * - 旧项目零回填：无 source_versions 记录的项目仍按 dramas.description 处理，本模块不批量建行
 * - POST /dramas 行为不变：本模块不参与创建链路
 */
import { createHash } from 'node:crypto'
import type { Pool } from 'mysql2/promise'
import { eq } from 'drizzle-orm'
import { pool, db, schema, getInsertId } from '../db/index.js'

/** source_versions.base_kind 取值（契约 §6.1：source / cleaned / confirmed / user-edited） */
export const SOURCE_BASE_KINDS = ['source', 'cleaned', 'confirmed', 'user-edited'] as const

export type SourceBaseKind = (typeof SOURCE_BASE_KINDS)[number]

/** 版本行（只读视图）。行创建后这些字段一律不变（I7）。 */
export interface SourceVersionRow {
  id: number
  dramaId: number
  baseKind: SourceBaseKind
  content: string
  contentHash: string
  baseHash: string
  parentVersionId: number | null
  createdAt: string
}

/**
 * 版本全文哈希（I1）：sha256(String(content || '').trim())。
 * 与 src/services/episode-plan-draft.ts 的 sourceHash 同算法（契约 §6.1 明确「算法与现有 sourceHash 一致」），
 * 此处独立实现以避免 db → services → db 的循环依赖。
 */
export function sourceVersionContentHash(content: unknown): string {
  return createHash('sha256').update(String(content || '').trim()).digest('hex')
}

const now = () => new Date().toISOString()

/**
 * 懒生成 source 首行（幂等、并发防重）。
 *
 * 返回新版本行 id；若该项目已有任意版本行则直接返回现有最早版本行 id（不新建、不覆盖指针）。
 * 无正文（description 为空）返回 null，不建立空 source 行 —— 避免污染当前指针。
 *
 * @param connectionPool 连接池，默认取本进程全局 pool；测试可注入隔离库的池。
 * @param expectedContent 请求正文，仅用于锁内比对，绝不作为 source 的内容来源。
 */
export class SourceContentConflict extends Error {}

export async function ensureSourceVersion(
  dramaId: number,
  expectedContent?: string,
  connectionPool: Pool = pool,
): Promise<number | null> {
  const connection = await connectionPool.getConnection()
  try {
    await connection.beginTransaction()
    try {
      // 锁 dramas 行（契约 §6.3 懒生成原子原语）
      const [rows] = await connection.query<any[]>(
        'SELECT id, description, deleted_at FROM dramas WHERE id = ? FOR UPDATE',
        [dramaId],
      )
      const drama = rows[0]
      if (!drama || drama.deleted_at) {
        await connection.commit()
        return null
      }

      const content = String(drama.description ?? '').trim()
      if (expectedContent !== undefined && expectedContent.trim() !== content) {
        throw new SourceContentConflict('全文内容已变化，请先保存并刷新后重新分析')
      }

      // 锁内判定：已有任意版本行即返回既有 id，与本次 content 是否有效无关
      // —— 避免「已有版本行 + 本次正文为空」被误判成 null 而错报失败。
      const [versions] = await connection.query<any[]>(
        'SELECT id FROM source_versions WHERE drama_id = ? ORDER BY id ASC LIMIT 1',
        [dramaId],
      )
      if (versions.length) {
        await connection.commit()
        return Number(versions[0].id)
      }

      // 首版只使用锁内持久化正文；空正文不创建版本。
      if (!content) {
        await connection.commit()
        return null
      }
      const contentHash = sourceVersionContentHash(content)
      const ts = now()

      const inserted = await connection.execute(
        `INSERT INTO source_versions
          (drama_id, base_kind, content, content_hash, base_hash, parent_version_id, diff, stats, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
        [dramaId, 'source', content, contentHash, contentHash, ts, ts],
      )
      const newVersionId = getInsertId(inserted)

      // 回填当前有效正文指针（契约 §6.1：NULL = 未整理/旧项目 → 有效正文 = dramas.description）
      await connection.execute(
        'UPDATE dramas SET current_source_version_id = ?, updated_at = ? WHERE id = ?',
        [newVersionId, ts, dramaId],
      )

      await connection.commit()
      return newVersionId
    } catch (err) {
      await connection.rollback()
      throw err
    }
  } finally {
    connection.release()
  }
}

/** 当前有效正文（契约 §6.1 指针语义）：有指针取版本行 content；NULL 回退 dramas.description。 */
export async function getCurrentSourceText(dramaId: number): Promise<string> {
  const [drama] = await db.select().from(schema.dramas).where(eq(schema.dramas.id, dramaId))
  if (!drama || drama.deletedAt) return ''
  if (!drama.currentSourceVersionId) return String(drama.description || '').trim()
  const [version] = await db
    .select()
    .from(schema.sourceVersions)
    .where(eq(schema.sourceVersions.id, Number(drama.currentSourceVersionId)))
  return version ? String(version.content || '') : String(drama.description || '').trim()
}
