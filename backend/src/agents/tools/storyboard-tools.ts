/**
 * 分镜拆解 Agent 工具
 * 模块级单例 — episodeId + dramaId 通过 RequestContext 按请求注入
 */
import { createTool } from '@mastra/core/tools'
import type { ToolExecutionContext } from '@mastra/core/tools'
import { z } from 'zod'
import { db, getInsertId, schema } from '../../db/index.js'
import { eq } from 'drizzle-orm'
import { now } from '../../utils/response.js'
import { logTaskProgress, logTaskSuccess } from '../../utils/task-logger.js'
import { collectH3SourceHash } from '../../services/h3-source.js'
import { getDramaId, getEpisodeId } from '../context.js'

async function syncStoryboardCharacters(storyboardId: number, characterIds: number[]) {
  await db.delete(schema.storyboardCharacters)
    .where(eq(schema.storyboardCharacters.storyboardId, storyboardId))


  const uniqueIds = [...new Set(characterIds.filter(Boolean))]
  if (!uniqueIds.length) return

  for (const characterId of uniqueIds) {
    await db.insert(schema.storyboardCharacters).values({
      storyboardId,
      characterId,
    })
  }
}

async function syncStoryboardProps(storyboardId: number, propIds: number[]) {
  await db.delete(schema.storyboardProps)
    .where(eq(schema.storyboardProps.storyboardId, storyboardId))

  const uniqueIds = [...new Set(propIds.filter(Boolean))]
  if (!uniqueIds.length) return

  for (const propId of uniqueIds) {
    await db.insert(schema.storyboardProps).values({
      storyboardId,
      propId,
    })
  }
}

async function getEpisodeSceneIds(episodeId: number) {
  const links = await db.select().from(schema.episodeScenes)
    .where(eq(schema.episodeScenes.episodeId, episodeId))
  return new Set(links.map(link => link.sceneId))
}

async function getEpisodeCharacterIds(episodeId: number) {
  const links = await db.select().from(schema.episodeCharacters)
    .where(eq(schema.episodeCharacters.episodeId, episodeId))
  return new Set(links.map(link => link.characterId))
}

async function getEpisodePropIds(episodeId: number) {
  const links = await db.select().from(schema.episodeProps)
    .where(eq(schema.episodeProps.episodeId, episodeId))
  return new Set(links.map(link => link.propId))
}

async function validateStoryboardBindings(episodeId: number, dramaId: number, sceneId: number | null | undefined, characterIds: number[] | undefined, propIds?: number[] | undefined) {
  const episodeSceneIds = await getEpisodeSceneIds(episodeId)
  const episodeCharacterIds = await getEpisodeCharacterIds(episodeId)
  const episodePropIds = await getEpisodePropIds(episodeId)

  // 场景/角色/道具属于本剧但尚未关联到当前集时，自动补关联（拆分时即完成绑定）
  if (sceneId != null && !episodeSceneIds.has(sceneId)) {
    const [scene] = await db.select().from(schema.scenes).where(eq(schema.scenes.id, sceneId))
    if (!scene || scene.dramaId !== dramaId || scene.deletedAt) {
      throw new Error(`scene_id ${sceneId} 不属于当前项目`)
    }
    await db.insert(schema.episodeScenes).values({ episodeId, sceneId, createdAt: now() })
  }

  const uniqueCharacterIds = [...new Set((characterIds || []).filter(Boolean))]
  for (const characterId of uniqueCharacterIds) {
    if (episodeCharacterIds.has(characterId)) continue
    const [character] = await db.select().from(schema.characters).where(eq(schema.characters.id, characterId))
    if (!character || character.dramaId !== dramaId || character.deletedAt) {
      throw new Error(`character_id ${characterId} 不属于当前项目`)
    }
    await db.insert(schema.episodeCharacters).values({ episodeId, characterId, createdAt: now() })
  }

  const uniquePropIds = [...new Set((propIds || []).filter(Boolean))]
  for (const propId of uniquePropIds) {
    if (episodePropIds.has(propId)) continue
    const [prop] = await db.select().from(schema.props).where(eq(schema.props.id, propId))
    if (!prop || prop.dramaId !== dramaId || prop.deletedAt) {
      throw new Error(`prop_id ${propId} 不属于当前项目`)
    }
    await db.insert(schema.episodeProps).values({ episodeId, propId, createdAt: now() })
  }
}

type ToolContext = ToolExecutionContext | undefined

function requireIds(context: ToolContext): { episodeId: number; dramaId: number } | { error: string } {
  const episodeId = getEpisodeId(context?.requestContext)
  const dramaId = getDramaId(context?.requestContext)
  if (!episodeId || !dramaId) return { error: 'Missing episodeId/dramaId in request context' }
  return { episodeId, dramaId }
}

const readStoryboardContext = createTool({
  id: 'read_storyboard_context',
  description: 'Read the screenplay, characters, scenes, and props for storyboard breakdown.',
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const ids = requireIds(context)
    if ('error' in ids) return ids
    const { episodeId, dramaId } = ids
    const [ep] = await db.select().from(schema.episodes)
      .where(eq(schema.episodes.id, episodeId))
    if (!ep) return { error: 'Episode not found' }
    const script = ep.scriptContent || ep.content
    if (!script) return { error: 'Episode has no script' }

    const charLinks = await db.select().from(schema.episodeCharacters)
      .where(eq(schema.episodeCharacters.episodeId, episodeId))
    const sceneLinks = await db.select().from(schema.episodeScenes)
      .where(eq(schema.episodeScenes.episodeId, episodeId))
    const propLinks = await db.select().from(schema.episodeProps)
      .where(eq(schema.episodeProps.episodeId, episodeId))

    const linkedCharacterIds = new Set(charLinks.map(link => link.characterId))
    const linkedSceneIds = new Set(sceneLinks.map(link => link.sceneId))
    const linkedPropIds = new Set(propLinks.map(link => link.propId))

    const chars = await db.select().from(schema.characters)
      .where(eq(schema.characters.dramaId, dramaId))
    const scns = await db.select().from(schema.scenes)
      .where(eq(schema.scenes.dramaId, dramaId))
    const prps = await db.select().from(schema.props)
      .where(eq(schema.props.dramaId, dramaId))
    const existingStoryboards = await db.select().from(schema.storyboards)
      .where(eq(schema.storyboards.episodeId, episodeId))

    const characters = chars
      .filter(c => !c.deletedAt)
      .filter(c => !linkedCharacterIds.size || linkedCharacterIds.has(c.id))
      .map(c => ({
        id: c.id,
        name: c.name,
        role: c.role || '',
        description: c.description || '',
        appearance: c.appearance || '',
        styling: c.styling || '',
        image_url: c.imageUrl || '',
        reference_images: c.referenceImages || '',
      }))

    const scenes = scns
      .filter(s => !s.deletedAt)
      .filter(s => !linkedSceneIds.size || linkedSceneIds.has(s.id))
      .map(s => ({
        id: s.id,
        location: s.location,
        time: s.time,
        prompt: s.prompt || '',
        lighting: s.lighting || '',
        image_url: s.imageUrl || '',
        storyboard_count: s.storyboardCount || 0,
      }))

    const props = prps
      .filter(p => !p.deletedAt)
      .filter(p => !linkedPropIds.size || linkedPropIds.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        type: p.type || '',
        description: p.description || '',
        image_url: p.imageUrl || '',
      }))

    const existingStoryboardPayload = await Promise.all(existingStoryboards
      .filter(sb => !sb.deletedAt)
      .map(async (sb) => {
        const links = await db.select().from(schema.storyboardCharacters)
          .where(eq(schema.storyboardCharacters.storyboardId, sb.id))
        const sbPropLinks = await db.select().from(schema.storyboardProps)
          .where(eq(schema.storyboardProps.storyboardId, sb.id))
        return {
          id: sb.id,
          shot_number: sb.storyboardNumber,
          title: sb.title || '',
          scene_id: sb.sceneId,
          character_ids: links.map(link => link.characterId),
          prop_ids: sbPropLinks.map(link => link.propId),
          shot_type: sb.shotType || '',
          duration: sb.duration || 0,
          description: sb.description || '',
          atmosphere: sb.atmosphere || '',
          video_prompt: sb.videoPrompt || '',
          minimax_h3_prompt: sb.minimaxH3Prompt || '',
        }
      }))

    const payload = {
      episode: {
        id: ep.id,
        title: ep.title,
        episode_number: ep.episodeNumber,
        description: ep.description || '',
      },
      script,
      characters,
      scenes,
      props,
      existing_storyboards: existingStoryboardPayload,
    }
    logTaskSuccess('StoryboardTool', 'read-context', {
      episodeId,
      dramaId,
      characters: characters.length,
      scenes: scenes.length,
      props: props.length,
      existingStoryboards: payload.existing_storyboards.length,
      scriptLength: script.length,
    })
    return payload
  },
})

// 模型常把布尔字段的字面量字符串（"true"/"false"）当 boolean 传过来，
// 这里做输入归一化，避免 replace_existing 判断失效。
// 字符串字段传 null 的情况由 schema 层 z.union([z.string(), z.literal(null)]) 兼容。
function coerceBool(v: any): boolean | undefined {
  if (typeof v === 'boolean') return v
  if (v === undefined) return undefined
  if (typeof v === 'string') return v.toLowerCase() === 'true'
  return !!v
}

const storyboardFields = z.object({
  shot_number: z.number(),
  title: z.union([z.string(), z.literal(null)]).optional(),
  shot_type: z.union([z.string(), z.literal(null)]).optional(),
  angle: z.union([z.string(), z.literal(null)]).optional(),
  movement: z.union([z.string(), z.literal(null)]).optional(),
  location: z.union([z.string(), z.literal(null)]).optional(),
  time: z.union([z.string(), z.literal(null)]).optional(),
  description: z.union([z.string(), z.literal(null)]).optional(),
  result: z.union([z.string(), z.literal(null)]).optional(),
  atmosphere: z.union([z.string(), z.literal(null)]).optional(),
  image_prompt: z.union([z.string(), z.literal(null)]).optional(),
  video_prompt: z.union([z.string(), z.literal(null)]).optional(),
  bgm_prompt: z.union([z.string(), z.literal(null)]).optional(),
  sound_effect: z.union([z.string(), z.literal(null)]).optional(),
  duration: z.union([z.number(), z.coerce.number()]).optional(),
  scene_id: z.union([z.number(), z.literal(null)]).nullable().optional(),
  character_ids: z.union([z.array(z.number()), z.literal(null)]).optional(),
  prop_ids: z.union([z.array(z.number()), z.literal(null)]).optional(),
})

const saveStoryboards = createTool({
  id: 'save_storyboards',
  description: 'Save storyboards for this episode. Call in batches of at most 8 storyboards: the first batch must set replace_existing: true (clears all old storyboards for the episode, then writes), every following batch omits replace_existing (appends). Rows are upserted by shot_number, so overlapping batches and retries never create duplicates.',
  inputSchema: z.object({
    // 模型常传字符串 "true"，用 coerce 接受字符串/布尔
    replace_existing: z.union([z.boolean(), z.string(), z.number()]).optional(),
    storyboards: z.array(storyboardFields),
  }),
  execute: async ({ storyboards, replace_existing }, context) => {
    const replaceExisting = coerceBool(replace_existing)
    const ids = requireIds(context)
    if ('error' in ids) return ids
    const { episodeId, dramaId } = ids
    const ts = now()
    logTaskProgress('StoryboardTool', 'save-begin', {
      episodeId,
      dramaId,
      replaceExisting: replaceExisting === true,
      count: storyboards.length,
      shotNumbers: storyboards.map(sb => sb.shot_number).join(','),
    })
    if (replaceExisting === true) {
      const existingStoryboardRows = await db.select().from(schema.storyboards)
        .where(eq(schema.storyboards.episodeId, episodeId))
      for (const storyboardId of existingStoryboardRows.map(sb => sb.id)) {
        await db.delete(schema.storyboardCharacters)
          .where(eq(schema.storyboardCharacters.storyboardId, storyboardId))
        await db.delete(schema.storyboardProps)
          .where(eq(schema.storyboardProps.storyboardId, storyboardId))
        // 整集重新生成会换掉分镜 ID，旧参考素材必须一起清理，否则成为孤儿数据
        await db.delete(schema.storyboardReferenceAssets)
          .where(eq(schema.storyboardReferenceAssets.storyboardId, storyboardId))
      }
      await db.delete(schema.storyboards).where(eq(schema.storyboards.episodeId, episodeId))
    }

    // shot_number → id 索引（含本次调用内新增的行），保证按分镜号幂等 upsert
    const existingRows = await db.select().from(schema.storyboards)
      .where(eq(schema.storyboards.episodeId, episodeId))
    const shotToId = new Map<number, number>(
      existingRows.filter(sb => !sb.deletedAt).map(sb => [sb.storyboardNumber, sb.id]),
    )

    for (const sb of storyboards) {
      const characterIds = (sb.character_ids || []).filter((id): id is number => typeof id === 'number')
      const propIds = (sb.prop_ids || []).filter((id): id is number => typeof id === 'number')
      const sceneId = typeof sb.scene_id === 'number' ? sb.scene_id : null
      await validateStoryboardBindings(episodeId, dramaId, sceneId, characterIds, propIds)
      const existingId = shotToId.get(sb.shot_number)
      if (existingId !== undefined) {
        await db.update(schema.storyboards).set({
          title: sb.title, shotType: sb.shot_type,
          angle: sb.angle, movement: sb.movement,
          location: sb.location, time: sb.time,
          description: sb.description, result: sb.result,
          atmosphere: sb.atmosphere, imagePrompt: sb.image_prompt,
          videoPrompt: sb.video_prompt, bgmPrompt: sb.bgm_prompt,
          soundEffect: sb.sound_effect,
          sceneId, duration: typeof sb.duration === 'number' ? sb.duration : 10,
          updatedAt: ts,
        }).where(eq(schema.storyboards.id, existingId))
        await syncStoryboardCharacters(existingId, characterIds)
        await syncStoryboardProps(existingId, propIds)
      } else {
        const res = await db.insert(schema.storyboards).values({
          episodeId,
          storyboardNumber: sb.shot_number,
          title: sb.title, shotType: sb.shot_type,
          angle: sb.angle, movement: sb.movement,
          location: sb.location, time: sb.time,
          description: sb.description, result: sb.result,
          atmosphere: sb.atmosphere, imagePrompt: sb.image_prompt,
          videoPrompt: sb.video_prompt, bgmPrompt: sb.bgm_prompt,
          soundEffect: sb.sound_effect,
          sceneId, duration: typeof sb.duration === 'number' ? sb.duration : 10,
          createdAt: ts, updatedAt: ts,
        })
        const newId = getInsertId(res)
        shotToId.set(sb.shot_number, newId)
        await syncStoryboardCharacters(newId, characterIds)
        await syncStoryboardProps(newId, propIds)
      }
    }

    // 整集时长 = 当前全部存活分镜时长之和（分批保存时不能再按单批累加）
    const allRows = await db.select().from(schema.storyboards)
      .where(eq(schema.storyboards.episodeId, episodeId))
    const totalDuration = allRows
      .filter(sb => !sb.deletedAt)
      .reduce((sum, sb) => sum + (sb.duration || 0), 0)

    await db.update(schema.episodes)
      .set({ duration: Math.ceil(totalDuration / 60), updatedAt: ts })
      .where(eq(schema.episodes.id, episodeId))

    logTaskSuccess('StoryboardTool', 'save-complete', {
      episodeId,
      count: storyboards.length,
      totalDuration,
    })
    return { message: `Saved ${storyboards.length} storyboards`, count: storyboards.length, total_duration: totalDuration }
  },
})

const updateStoryboard = createTool({
  id: 'update_storyboard',
  description: 'Update a specific storyboard shot.',
  inputSchema: z.object({
    storyboard_id: z.number(),
    title: z.union([z.string(), z.literal(null)]).optional(),
    shot_type: z.union([z.string(), z.literal(null)]).optional(),
    angle: z.union([z.string(), z.literal(null)]).optional(),
    movement: z.union([z.string(), z.literal(null)]).optional(),
    location: z.union([z.string(), z.literal(null)]).optional(),
    time: z.union([z.string(), z.literal(null)]).optional(),
    result: z.union([z.string(), z.literal(null)]).optional(),
    atmosphere: z.union([z.string(), z.literal(null)]).optional(),
    image_prompt: z.union([z.string(), z.literal(null)]).optional(),
    video_prompt: z.union([z.string(), z.literal(null)]).optional(),
    minimax_h3_prompt: z.union([z.string(), z.literal(null)]).optional(),
    bgm_prompt: z.union([z.string(), z.literal(null)]).optional(),
    sound_effect: z.union([z.string(), z.literal(null)]).optional(),
    description: z.union([z.string(), z.literal(null)]).optional(),
    scene_id: z.union([z.number(), z.literal(null)]).nullable().optional(),
    character_ids: z.union([z.array(z.number()), z.literal(null)]).optional(),
    prop_ids: z.union([z.array(z.number()), z.literal(null)]).optional(),
    duration: z.union([z.number(), z.coerce.number()]).optional(),
  }),
  execute: async ({ storyboard_id, ...fields }, context) => {
    const ids = requireIds(context)
    if ('error' in ids) return ids
    const { episodeId, dramaId } = ids
    const [storyboard] = await db.select().from(schema.storyboards).where(eq(schema.storyboards.id, storyboard_id))
    if (!storyboard) return { error: `Storyboard ${storyboard_id} not found` }

    // 过滤模型回传的垃圾值：视频提示词 Agent 常把整行字段回传，
    // 拿不准的字符串字段写成 "null"/"undefined"，直接覆盖会毁掉已有内容
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      const v = fields[key]
      if (typeof v === 'string' && (v === 'null' || v === 'undefined' || v === 'NULL' || v === 'Null')) {
        delete fields[key]
      }
    }

    logTaskProgress('StoryboardTool', 'update-begin', {
      episodeId,
      storyboardId: storyboard_id,
      fields: Object.keys(fields),
    })

    const currentCharacterIds = 'character_ids' in fields
      ? (fields.character_ids || []).filter((id): id is number => typeof id === 'number')
      : (await db.select().from(schema.storyboardCharacters)
          .where(eq(schema.storyboardCharacters.storyboardId, storyboard_id)))
          .map(link => link.characterId)

    const currentPropIds = 'prop_ids' in fields
      ? (fields.prop_ids || []).filter((id): id is number => typeof id === 'number')
      : (await db.select().from(schema.storyboardProps)
          .where(eq(schema.storyboardProps.storyboardId, storyboard_id)))
          .map(link => link.propId)

    await validateStoryboardBindings(
      episodeId,
      dramaId,
      'scene_id' in fields ? fields.scene_id : storyboard.sceneId,
      currentCharacterIds,
      currentPropIds,
    )

    const updates: Record<string, any> = { updatedAt: now() }
    if ('title' in fields) updates.title = fields.title
    if ('shot_type' in fields) updates.shotType = fields.shot_type
    if ('angle' in fields) updates.angle = fields.angle
    if ('movement' in fields) updates.movement = fields.movement
    if ('location' in fields) updates.location = fields.location
    if ('time' in fields) updates.time = fields.time
    if ('result' in fields) updates.result = fields.result
    if ('atmosphere' in fields) updates.atmosphere = fields.atmosphere
    if ('image_prompt' in fields) updates.imagePrompt = fields.image_prompt
    if ('video_prompt' in fields) updates.videoPrompt = fields.video_prompt
    if ('minimax_h3_prompt' in fields) updates.minimaxH3Prompt = fields.minimax_h3_prompt
    if ('bgm_prompt' in fields) updates.bgmPrompt = fields.bgm_prompt
    if ('sound_effect' in fields) updates.soundEffect = fields.sound_effect
    if ('description' in fields) updates.description = fields.description
    if ('scene_id' in fields) updates.sceneId = fields.scene_id
    if ('duration' in fields) updates.duration = fields.duration
    await db.update(schema.storyboards).set(updates).where(eq(schema.storyboards.id, storyboard_id))
    if ('character_ids' in fields) await syncStoryboardCharacters(storyboard_id, fields.character_ids || [])
    if ('prop_ids' in fields) await syncStoryboardProps(storyboard_id, fields.prop_ids || [])
    logTaskSuccess('StoryboardTool', 'update-complete', {
      episodeId,
      storyboardId: storyboard_id,
      updatedFields: Object.keys(updates),
      characterIds: 'character_ids' in fields ? (fields.character_ids || []).join(',') : undefined,
      propIds: 'prop_ids' in fields ? (fields.prop_ids || []).join(',') : undefined,
    })
    return { message: `Storyboard ${storyboard_id} updated` }
  },
})

const saveMinimaxH3Prompt = createTool({
  id: 'save_minimax_h3_prompt',
  description: 'Save only the MiniMax H3 prompt for one storyboard. This tool cannot change any other storyboard field.',
  inputSchema: z.object({
    storyboard_id: z.number(),
    minimax_h3_prompt: z.string().min(1),
  }),
  execute: async ({ storyboard_id, minimax_h3_prompt }, context) => {
    const ids = requireIds(context)
    if ('error' in ids) return ids
    const [storyboard] = await db.select().from(schema.storyboards).where(eq(schema.storyboards.id, storyboard_id))
    if (!storyboard || storyboard.episodeId !== ids.episodeId) {
      return { error: `Storyboard ${storyboard_id} not found in current episode` }
    }
    // 来源指纹必须与失效判断用同一套算法，否则刚保存的 H3 会立刻被判过期
    const sourceHash = await collectH3SourceHash(storyboard)
    await db.update(schema.storyboards)
      .set({
        minimaxH3Prompt: minimax_h3_prompt,
        minimaxH3SourceHash: sourceHash,
        minimaxH3GeneratedAt: now(),
        updatedAt: now(),
      })
      .where(eq(schema.storyboards.id, storyboard_id))
    logTaskSuccess('StoryboardTool', 'h3-prompt-saved', {
      episodeId: ids.episodeId,
      storyboardId: storyboard_id,
      promptLength: minimax_h3_prompt.length,
    })
    return { message: `MiniMax H3 prompt saved for storyboard ${storyboard_id}` }
  },
})

export const storyboardTools = { readStoryboardContext, saveStoryboards, updateStoryboard, saveMinimaxH3Prompt }
