import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, getInsertId, schema } from '../db/index.js'
import { success, created, now, badRequest } from '../utils/response.js'
import { toSnakeCase } from '../utils/transform.js'
import { logTaskPayload, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'

const app = new Hono()

// 持久化分镜的视频参考素材选择；上传素材本体仍由 assets 表管理。
app.get('/:id/reference-assets', async (c) => {
  const storyboardId = Number(c.req.param('id'))
  const rows = await db.select().from(schema.storyboardReferenceAssets)
    .where(eq(schema.storyboardReferenceAssets.storyboardId, storyboardId))
  return success(c, rows.map(toSnakeCase))
})

app.put('/:id/reference-assets', async (c) => {
  const storyboardId = Number(c.req.param('id'))
  const [storyboard] = await db.select().from(schema.storyboards).where(eq(schema.storyboards.id, storyboardId))
  if (!storyboard) return badRequest(c, '镜头不存在')
  const body = await c.req.json().catch(() => ({}))
  const items = Array.isArray(body.items) ? body.items : []
  const validTypes = new Set(['image', 'video', 'audio'])
  const ts = now()
  const normalized = items
    .filter((item: any) => validTypes.has(String(item.media_type || '').toLowerCase()) && String(item.url || '').trim())
    .slice(0, 15)
    .map((item: any, index: number) => ({
      storyboardId,
      assetId: item.asset_id == null ? null : Number(item.asset_id),
      mediaType: String(item.media_type).toLowerCase(),
      mediaRole: String(item.media_role || 'reference'),
      url: String(item.url).trim(),
      sortOrder: index,
      createdAt: ts,
      updatedAt: ts,
    }))
  await db.delete(schema.storyboardReferenceAssets)
    .where(eq(schema.storyboardReferenceAssets.storyboardId, storyboardId))
  for (const item of normalized) await db.insert(schema.storyboardReferenceAssets).values(item)
  // 参考素材变化后，旧 H3 提示词不再代表当前投产输入。
  await db.update(schema.storyboards)
    .set({ minimaxH3SourceHash: null, minimaxH3GeneratedAt: null, updatedAt: ts })
    .where(eq(schema.storyboards.id, storyboardId))
  return success(c, normalized.map(toSnakeCase))
})

async function syncStoryboardCharacters(storyboardId: number, characterIds: number[]) {
  await db.delete(schema.storyboardCharacters)
    .where(eq(schema.storyboardCharacters.storyboardId, storyboardId))


  const uniqueIds = [...new Set((characterIds || []).filter(Boolean))]
  if (!uniqueIds.length) return

  for (const characterId of uniqueIds) {
    await db.insert(schema.storyboardCharacters).values({
      storyboardId,
      characterId,
    })
  }
}

async function getStoryboardCharacterIds(storyboardId: number) {
  const links = await db.select().from(schema.storyboardCharacters)
    .where(eq(schema.storyboardCharacters.storyboardId, storyboardId))
  return links.map(link => link.characterId)
}

async function syncStoryboardProps(storyboardId: number, propIds: number[]) {
  await db.delete(schema.storyboardProps)
    .where(eq(schema.storyboardProps.storyboardId, storyboardId))

  const uniqueIds = [...new Set((propIds || []).filter(Boolean))]
  if (!uniqueIds.length) return

  for (const propId of uniqueIds) {
    await db.insert(schema.storyboardProps).values({
      storyboardId,
      propId,
    })
  }
}

async function getStoryboardPropIds(storyboardId: number) {
  const links = await db.select().from(schema.storyboardProps)
    .where(eq(schema.storyboardProps.storyboardId, storyboardId))
  return links.map(link => link.propId)
}

async function validateStoryboardBindings(episodeId: number, sceneId: number | null | undefined, characterIds: number[] | undefined, propIds?: number[] | undefined) {
  const sceneLinks = await db.select().from(schema.episodeScenes)
    .where(eq(schema.episodeScenes.episodeId, episodeId))
  const episodeSceneIds = new Set(sceneLinks.map(link => link.sceneId))
  const characterLinks = await db.select().from(schema.episodeCharacters)
    .where(eq(schema.episodeCharacters.episodeId, episodeId))
  const episodeCharacterIds = new Set(characterLinks.map(link => link.characterId))
  const propLinks = await db.select().from(schema.episodeProps)
    .where(eq(schema.episodeProps.episodeId, episodeId))
  const episodePropIds = new Set(propLinks.map(link => link.propId))

  if (sceneId != null && !episodeSceneIds.has(sceneId)) {
    throw new Error('scene_id 必须来自当前集已关联场景')
  }

  const invalidCharacterIds = (characterIds || []).filter(id => !episodeCharacterIds.has(id))
  if (invalidCharacterIds.length) {
    throw new Error('character_ids 必须来自当前集已关联角色')
  }

  const invalidPropIds = (propIds || []).filter(id => !episodePropIds.has(id))
  if (invalidPropIds.length) {
    throw new Error('prop_ids 必须来自当前集已关联道具')
  }
}

// POST /storyboards
app.post('/', async (c) => {
  const body = await c.req.json()
  const ts = now()
  logTaskStart('StoryboardAPI', 'create', {
    episodeId: body.episode_id,
    shotNumber: body.storyboard_number || 1,
    sceneId: body.scene_id,
    characterIds: body.character_ids,
  })
  logTaskPayload('StoryboardAPI', 'create body', body)
  await validateStoryboardBindings(body.episode_id, body.scene_id, body.character_ids, body.prop_ids)
  const res = await db.insert(schema.storyboards).values({
    episodeId: body.episode_id,
    storyboardNumber: body.storyboard_number || 1,
    title: body.title,
    description: body.description,
    sceneId: body.scene_id,
    duration: body.duration || 10,
    createdAt: ts,
    updatedAt: ts,
  })
  await syncStoryboardCharacters(getInsertId(res), body.character_ids || [])
  await syncStoryboardProps(getInsertId(res), body.prop_ids || [])
  const [result] = await db.select().from(schema.storyboards)
    .where(eq(schema.storyboards.id, getInsertId(res)))
  logTaskSuccess('StoryboardAPI', 'create', {
    storyboardId: result.id,
    episodeId: result.episodeId,
    shotNumber: result.storyboardNumber,
  })
  return created(c, {
    ...toSnakeCase(result),
    character_ids: await getStoryboardCharacterIds(result.id),
    prop_ids: await getStoryboardPropIds(result.id),
  })
})

// PUT /storyboards/:id
app.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const [storyboard] = await db.select().from(schema.storyboards).where(eq(schema.storyboards.id, id))
  if (!storyboard) return badRequest(c, '镜头不存在')
  logTaskStart('StoryboardAPI', 'update', {
    storyboardId: id,
    episodeId: storyboard.episodeId,
    fields: Object.keys(body),
  })
  logTaskPayload('StoryboardAPI', 'update body', body)

  const fieldMap: Record<string, string> = {
    title: 'title', description: 'description', shot_type: 'shotType',
    angle: 'angle', movement: 'movement', duration: 'duration',
    video_prompt: 'videoPrompt',
    minimax_h3_prompt: 'minimaxH3Prompt',
    image_prompt: 'imagePrompt', scene_id: 'sceneId', location: 'location',
    time: 'time', atmosphere: 'atmosphere', result: 'result',
    bgm_prompt: 'bgmPrompt', sound_effect: 'soundEffect',
    video_url: 'videoUrl',
  }

  const updates: Record<string, any> = { updatedAt: now() }
  for (const [snakeKey, camelKey] of Object.entries(fieldMap)) {
    if (snakeKey in body) updates[camelKey] = body[snakeKey]
  }
  // H3 prompt is derived from these source fields; mark it stale when a source changes.
  if (['description', 'atmosphere', 'duration', 'video_prompt'].some(key => key in body)) {
    updates.minimaxH3SourceHash = null
    updates.minimaxH3GeneratedAt = null
  }

  await validateStoryboardBindings(
    storyboard.episodeId,
    'scene_id' in body ? body.scene_id : storyboard.sceneId,
    'character_ids' in body ? body.character_ids : await getStoryboardCharacterIds(id),
    'prop_ids' in body ? body.prop_ids : await getStoryboardPropIds(id),
  )

  await db.update(schema.storyboards).set(updates).where(eq(schema.storyboards.id, id))
  if ('character_ids' in body) await syncStoryboardCharacters(id, body.character_ids || [])
  if ('prop_ids' in body) await syncStoryboardProps(id, body.prop_ids || [])
  logTaskSuccess('StoryboardAPI', 'update', {
    storyboardId: id,
    updatedFields: Object.keys(updates),
    characterIds: body.character_ids,
    propIds: body.prop_ids,
  })
  return success(c)
})

// DELETE /storyboards/:id
app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  logTaskStart('StoryboardAPI', 'delete', { storyboardId: id })
  await db.delete(schema.storyboardCharacters).where(eq(schema.storyboardCharacters.storyboardId, id))
  await db.delete(schema.storyboardProps).where(eq(schema.storyboardProps.storyboardId, id))
  await db.delete(schema.storyboards).where(eq(schema.storyboards.id, id))
  logTaskSuccess('StoryboardAPI', 'delete', { storyboardId: id })
  return success(c)
})

export default app
