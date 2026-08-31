/**
 * 存量数据回填脚本 — 为已有 H3 提示词但缺少来源指纹的分镜补齐 minimax_h3_source_hash
 *
 * 用法：
 *   cd backend
 *   npx tsx scripts/backfill-h3-source.ts --dry-run   # 预演：只统计，不写入
 *   npx tsx scripts/backfill-h3-source.ts --confirm   # 确认后实际写入
 *
 * 背景：H3 来源元数据是后加的字段。在此之前生成的 H3 提示词没有来源指纹，
 * 前端会把它们一律判定为「可能已过期」，而且永远不会自动恢复。
 *
 * 重要限制：回填以「当前输入」作为这份提示词的来源基准，无法证明提示词生成时
 * 用的就是当前素材。对无法确认内容一致的历史记录，更安全的做法是直接重新生成 H3；
 * 回填只适用于人工确认内容一致的历史记录，或在评审确认可接受近似时使用。
 * 因此实际写入必须显式加 --confirm，防止误操作把「内容已变但没被识别」的旧提示词
 * 标记为新鲜。
 */
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { db, pool, schema } from '../src/db/index.js'
import { collectH3SourceHash } from '../src/services/h3-source.js'
import { now } from '../src/utils/response.js'

const dryRun = process.argv.includes('--dry-run')
const confirmed = process.argv.includes('--confirm')

if (!dryRun && !confirmed) {
  console.log('未指定模式：默认只预演，不写入任何数据。')
  console.log('  预演：npx tsx scripts/backfill-h3-source.ts --dry-run')
  console.log('  写入：npx tsx scripts/backfill-h3-source.ts --confirm')
  console.log('')
  console.log('注意：回填以「当前输入」为基准标记历史提示词为新鲜，无法证明生成时')
  console.log('用的就是当前素材。对无法确认内容一致的历史记录，更安全的做法是')
  console.log('直接重新生成 H3；回填只适用于人工确认内容一致的历史记录。')
  await pool.end()
  process.exit(0)
}

const rows = await db.select().from(schema.storyboards)
  .where(and(
    isNotNull(schema.storyboards.minimaxH3Prompt),
    isNull(schema.storyboards.minimaxH3SourceHash),
  ))

const targets = rows.filter(row => !row.deletedAt && String(row.minimaxH3Prompt || '').trim())

console.log(`${dryRun ? '[预演] ' : '[写入] '}待回填分镜：${targets.length} 个`)

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
    console.log(`  ${dryRun ? '将回填' : '已回填'} 分镜 ${row.id}（第 ${row.storyboardNumber} 镜）${hash.slice(0, 12)}...`)
    done++
  } catch (err) {
    failed++
    console.warn(`  回填失败 分镜 ${row.id}：${(err as Error).message}`)
  }
}

console.log(dryRun
  ? `预演完成，实际写入 0 条。`
  : `回填完成：成功 ${done}，失败 ${failed}`)
await pool.end()
