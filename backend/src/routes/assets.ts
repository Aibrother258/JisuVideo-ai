import { Hono } from 'hono'
import { and, count, desc, eq, isNotNull, isNull, ne, not, or, type SQL } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success } from '../utils/response.js'
import { toSnakeCase } from '../utils/transform.js'

const app = new Hono()

// GET /assets?drama_id=&episode_id=&type=image|video|audio&page=&page_size=
// 素材库只返回未删除记录；同一短剧下允许跨集复用，未归属短剧的记录视为公共素材。
// 过滤/排序/分页全部 SQL 下推，避免全表读取后内存过滤。
app.get('/', async (c) => {
  const dramaId = Number(c.req.query('drama_id') || 0)
  const episodeId = Number(c.req.query('episode_id') || 0)
  const type = String(c.req.query('type') || '').trim().toLowerCase()
  // parseInt + `|| 默认值` 兜底：Number('abc') 得 NaN，Math.max(1, NaN) 会传播 NaN 进 SQL
  const page = Math.max(1, Number.parseInt(c.req.query('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(c.req.query('page_size') || '20', 10) || 20))

  // drizzle 的 and/or 在入参为空时返回 undefined，此处条件恒定非空，用 ! 断言收窄为 SQL
  const conds: SQL[] = [isNull(schema.assets.deletedAt)]
  // 未归属短剧的记录视为公共素材：请求指定短剧时保留「无归属或归属当前短剧」的记录
  if (dramaId) conds.push(or(isNull(schema.assets.dramaId), eq(schema.assets.dramaId, dramaId))!)
  // 跨集复用：仅排除「无短剧归属（公共素材）但归属其他集」的记录；
  // 归属当前短剧的其他集资产允许跨集复用，不在此排除
  if (episodeId) conds.push(not(and(
    isNull(schema.assets.dramaId),
    isNotNull(schema.assets.episodeId),
    ne(schema.assets.episodeId, episodeId),
  )!)!)
  if (type) conds.push(eq(schema.assets.type, type))
  const where = and(...conds)

  const total = (await db.select({ value: count() }).from(schema.assets).where(where))[0]?.value ?? 0
  const rows = await db.select().from(schema.assets)
    .where(where)
    .orderBy(desc(schema.assets.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return success(c, {
    items: rows.map(toSnakeCase),
    pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) },
  })
})

export default app
