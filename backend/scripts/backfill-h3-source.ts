/**
 * 存量数据回填脚本 — 为已有 H3 提示词但缺少来源指纹的分镜补齐 minimax_h3_source_hash
 *
 * 用法：cd backend && npx tsx scripts/backfill-h3-source.ts [--dry-run]
 *
 * 背景：H3 来源元数据是后加的字段。在此之前生成的 H3 提示词没有来源指纹，
 * 前端会把它们一律判定为「可能已过期」，而且永远不会自动恢复。
 *
 * 处理策略：无法还原生成当时的输入，因此以「当前输入」作为这份提示词的来源基准。
 * 回填后只要来源真的发生变化，仍会正常失效。已有指纹的分镜一律跳过，可重复执行。
 */
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { db, pool, schema } from '../src/db/index.js'
import { collectH3SourceHash } from '../src/services/h3-source.js'
import { now } from '../src/utils/response.js'

const dryRun = process.argv.includes('--dry-run')

const rows = await db.select().from(schema.storyboards)
  .where(and(
    isNotNull(schema.storyboards.minimaxH3Prompt),
    isNull(schema.storyboards.minimaxH3SourceHash),
  ))

const targets = rows.filter(row => !row.deletedAt && String(row.minimaxH3Prompt || '').trim())

console.log(`${dryRun ? '[预演] ' : ''}待回填分镜：${targets.length} 个`)

let done = 0
let failed = 0
for (const row of targets) {
  try {
    const hash = await collectH3SourceHash(row)
    if (!dryRun) {
      await db.update(schema.storyboards)
        .set({
          minimaxH3SourceHash: hash,
          minimaxH3GeneratedAt: row.minimaxH3GeneratedAt || now(),
        })
        .where(eq(schema.storyboards.id, row.id))
    }
    console.log(`  ${dryRun ? '将回填' : '已回填'} ✓ 分镜 ${row.id}（第 ${row.storyboardNumber} 镜）${hash.slice(0, 12)}…`)
    done++
  } catch (err) {
    failed++
    console.warn(`  回填 ✗ 分镜 ${row.id}：${(err as Error).message}`)
  }
}

console.log(`${dryRun ? '预演完成，实际写入 0 条。' : `回填完成：成功 ${done}，失败 ${failed}`}`)
await pool.end()
