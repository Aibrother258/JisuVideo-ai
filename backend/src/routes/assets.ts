import { Hono } from 'hono'
import { db, schema } from '../db/index.js'
import { success } from '../utils/response.js'
import { toSnakeCase } from '../utils/transform.js'

const app = new Hono()

// GET /assets?drama_id=&episode_id=&type=image|video|audio
// 素材库只返回未删除记录；同一短剧下允许跨集复用，未归属短剧的记录视为公共素材。
app.get('/', async (c) => {
  const dramaId = Number(c.req.query('drama_id') || 0)
  const episodeId = Number(c.req.query('episode_id') || 0)
  const type = String(c.req.query('type') || '').trim().toLowerCase()

  let rows = await db.select().from(schema.assets)
  rows = rows.filter(row => {
    if (row.deletedAt) return false
    if (dramaId && row.dramaId != null && row.dramaId !== dramaId) return false
    if (episodeId && row.episodeId != null && row.episodeId !== episodeId && row.dramaId == null) return false
    if (type && String(row.type || '').toLowerCase() !== type) return false
    return true
  })
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return success(c, rows.map(toSnakeCase))
})

export default app
