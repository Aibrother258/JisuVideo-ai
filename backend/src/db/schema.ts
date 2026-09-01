/**
 * Drizzle schema - MySQL column mappings.
 */
import { mysqlTable, text, longtext, int, double, boolean, primaryKey, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

export const dramas = mysqlTable('dramas', {
  id: int('id').primaryKey().autoincrement(),
  title: text('title').notNull(),
  description: longtext('description'),
  genre: text('genre'),
  style: varchar('style', { length: 64 }).default('3d'),
  aspectRatio: varchar('aspect_ratio', { length: 16 }).default('16:9'),
  totalEpisodes: int('total_episodes').default(1),
  totalDuration: int('total_duration').default(0),
  status: varchar('status', { length: 64 }).notNull().default('draft'),
  thumbnail: text('thumbnail'),
  tags: text('tags'),
  metadata: longtext('metadata'),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 64 }),
})

export const episodes = mysqlTable('episodes', {
  id: int('id').primaryKey().autoincrement(),
  dramaId: int('drama_id').notNull(),
  episodeNumber: int('episode_number').notNull(),
  title: text('title').notNull(),
  content: longtext('content'),
  scriptContent: longtext('script_content'),
  description: longtext('description'),
  duration: int('duration').default(0),
  status: varchar('status', { length: 64 }).default('draft'),
  videoUrl: text('video_url'),
  thumbnail: text('thumbnail'),
  imageConfigId: int('image_config_id'),
  videoConfigId: int('video_config_id'),
  resolution: varchar('resolution', { length: 16 }).default('720p'),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 64 }),
}, table => ({
  dramaEpisodeNumberUnique: uniqueIndex('uq_episodes_drama_number').on(table.dramaId, table.episodeNumber),
}))

export const episodePlanDrafts = mysqlTable('episode_plan_drafts', {
  id: int('id').primaryKey().autoincrement(),
  dramaId: int('drama_id').notNull(),
  sourceHash: varchar('source_hash', { length: 64 }).notNull(),
  contentFingerprint: varchar('content_fingerprint', { length: 64 }).notNull(),
  generatedFingerprint: varchar('generated_fingerprint', { length: 64 }),
  version: int('version').notNull().default(1),
  selectedEpisodeNumber: int('selected_episode_number'),
  resolution: varchar('resolution', { length: 16 }).notNull().default('720p'),
  planJson: longtext('plan_json').notNull(),
  revisionHistory: longtext('revision_history'),
  generatedEpisodeIds: longtext('generated_episode_ids'),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
}, table => ({
  dramaUnique: uniqueIndex('uq_episode_plan_drafts_drama').on(table.dramaId),
}))

export const characters = mysqlTable('characters', {
  id: int('id').primaryKey().autoincrement(),
  dramaId: int('drama_id').notNull(),
  name: text('name').notNull(),
  role: text('role'),
  description: text('description'),
  appearance: text('appearance'),
  styling: text('styling'),
  finalPrompt: text('final_prompt'),
  personality: text('personality'),
  imageUrl: text('image_url'),
  referenceImages: text('reference_images'),
  seedValue: text('seed_value'),
  sortOrder: int('sort_order'),
  localPath: text('local_path'),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 64 }),
})

// Episode-Character many-to-many
export const episodeCharacters = mysqlTable('episode_characters', {
  id: int('id').primaryKey().autoincrement(),
  episodeId: int('episode_id').notNull(),
  characterId: int('character_id').notNull(),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
})

// Episode-Scene many-to-many
export const episodeScenes = mysqlTable('episode_scenes', {
  id: int('id').primaryKey().autoincrement(),
  episodeId: int('episode_id').notNull(),
  sceneId: int('scene_id').notNull(),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
})

// Episode-Prop many-to-many
export const episodeProps = mysqlTable('episode_props', {
  id: int('id').primaryKey().autoincrement(),
  episodeId: int('episode_id').notNull(),
  propId: int('prop_id').notNull(),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
})

export const scenes = mysqlTable('scenes', {
  id: int('id').primaryKey().autoincrement(),
  dramaId: int('drama_id').notNull(),
  episodeId: int('episode_id'),
  location: text('location').notNull(),
  time: varchar('time', { length: 64 }).notNull(),
  prompt: text('prompt').notNull(),
  lighting: text('lighting'),
  finalPrompt: text('final_prompt'),
  storyboardCount: int('storyboard_count').default(1),
  imageUrl: text('image_url'),
  status: varchar('status', { length: 64 }).default('pending'),
  localPath: text('local_path'),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 64 }),
})

export const storyboards = mysqlTable('storyboards', {
  id: int('id').primaryKey().autoincrement(),
  episodeId: int('episode_id').notNull(),
  sceneId: int('scene_id'),
  storyboardNumber: int('storyboard_number').notNull(),
  title: text('title'),
  location: text('location'),
  time: varchar('time', { length: 64 }),
  shotType: text('shot_type'),
  angle: text('angle'),
  movement: text('movement'),
  result: text('result'),
  atmosphere: text('atmosphere'),
  imagePrompt: text('image_prompt'),
  videoPrompt: text('video_prompt'),
  minimaxH3Prompt: text('minimax_h3_prompt'),
  minimaxH3SourceHash: varchar('minimax_h3_source_hash', { length: 64 }),
  minimaxH3GeneratedAt: varchar('minimax_h3_generated_at', { length: 64 }),
  bgmPrompt: text('bgm_prompt'),
  soundEffect: text('sound_effect'),
  description: text('description'),
  duration: int('duration').default(0),
  composedImage: text('composed_image'),
  firstFrameImage: text('first_frame_image'),
  lastFrameImage: text('last_frame_image'),
  referenceImages: text('reference_images'),
  videoUrl: text('video_url'),
  subtitleUrl: text('subtitle_url'),
  composedVideoUrl: text('composed_video_url'),
  status: varchar('status', { length: 64 }).default('pending'),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 64 }),
})

// Durable per-storyboard reference media selections for video generation.
export const storyboardReferenceAssets = mysqlTable('storyboard_reference_assets', {
  id: int('id').primaryKey().autoincrement(),
  storyboardId: int('storyboard_id').notNull(),
  assetId: int('asset_id'),
  mediaType: varchar('media_type', { length: 16 }).notNull(),
  mediaRole: varchar('media_role', { length: 32 }).notNull().default('reference'),
  url: text('url').notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
})

export const storyboardCharacters = mysqlTable('storyboard_characters', {
  storyboardId: int('storyboard_id').notNull(),
  characterId: int('character_id').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.storyboardId, table.characterId] }),
}))

export const storyboardProps = mysqlTable('storyboard_props', {
  storyboardId: int('storyboard_id').notNull(),
  propId: int('prop_id').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.storyboardId, table.propId] }),
}))

export const aiServiceConfigs = mysqlTable('ai_service_configs', {
  id: int('id').primaryKey().autoincrement(),
  serviceType: varchar('service_type', { length: 64 }).notNull(),
  provider: varchar('provider', { length: 64 }),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  apiKey: text('api_key').notNull(),
  model: text('model'),
  endpoint: text('endpoint'),
  queryEndpoint: text('query_endpoint'),
  priority: int('priority').default(0),
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  settings: text('settings'),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
  // 注意: 此表无 deleted_at
})

export const aiServiceProviders = mysqlTable('ai_service_providers', {
  id: int('id').primaryKey().autoincrement(),
  name: text('name').notNull(),
  displayName: text('display_name'),
  serviceType: varchar('service_type', { length: 64 }).notNull(),
  provider: varchar('provider', { length: 64 }).notNull(),
  defaultUrl: text('default_url'),
  presetModels: text('preset_models'),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
})

export const stylePresets = mysqlTable('style_presets', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 64 }).notNull(),
  value: varchar('value', { length: 64 }).notNull(),
  prompt: text('prompt').notNull(),
  description: text('description'),
  sortOrder: int('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
  // 注意: 此表无 deleted_at（硬删除），value 列有唯一索引（见 DDL）
})

// 统一生成任务表：图片/视频生成共用，type 区分，生成参数存 params(JSON)
export const sysTask = mysqlTable('sys_task', {
  id: int('id').primaryKey().autoincrement(),
  type: varchar('type', { length: 16 }).notNull(), // image | video
  storyboardId: int('storyboard_id'),
  dramaId: int('drama_id'),
  sceneId: int('scene_id'),
  characterId: int('character_id'),
  propId: int('prop_id'),
  provider: varchar('provider', { length: 64 }),
  prompt: text('prompt'),
  model: text('model'),
  // image: {size, frameType, referenceImages[]}
  // video: {referenceMode, referenceImageUrls[], referenceVideoUrls[], referenceAudioUrls[], generateAudio, duration, aspectRatio}
  params: text('params'),
  taskId: text('task_id'),
  resultUrl: text('result_url'),
  localPath: text('local_path'),
  status: varchar('status', { length: 64 }).default('processing'),
  errorMsg: text('error_msg'),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
  completedAt: varchar('completed_at', { length: 64 }),
  // 启动恢复租约：认领者的到期时间戳(ms)与标识，条件更新实现原子认领，防多实例双重续轮询
  recoveryAt: varchar('recovery_at', { length: 64 }),
  recoveryOwner: varchar('recovery_owner', { length: 64 }),
})

export const videoMerges = mysqlTable('video_merges', {
  id: int('id').primaryKey().autoincrement(),
  episodeId: int('episode_id'),
  dramaId: int('drama_id'),
  title: text('title'),
  provider: varchar('provider', { length: 64 }),
  model: text('model'),
  status: varchar('status', { length: 64 }).default('pending'),
  scenes: text('scenes'), // JSON
  mergedUrl: text('merged_url'),
  duration: int('duration'),
  taskId: text('task_id'),
  errorMsg: text('error_msg'),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  completedAt: varchar('completed_at', { length: 64 }),
  deletedAt: varchar('deleted_at', { length: 64 }),
})

export const props = mysqlTable('props', {
  id: int('id').primaryKey().autoincrement(),
  dramaId: int('drama_id').notNull(),
  name: text('name').notNull(),
  type: text('type'),
  description: text('description'),
  prompt: text('prompt'),
  finalPrompt: text('final_prompt'),
  imageUrl: text('image_url'),
  referenceImages: text('reference_images'),
  localPath: text('local_path'),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 64 }),
})

export const assets = mysqlTable('assets', {
  id: int('id').primaryKey().autoincrement(),
  dramaId: int('drama_id'),
  episodeId: int('episode_id'),
  storyboardId: int('storyboard_id'),
  storyboardNum: int('storyboard_num'),
  name: text('name'),
  description: text('description'),
  type: text('type'),
  category: text('category'),
  url: text('url'),
  thumbnailUrl: text('thumbnail_url'),
  localPath: text('local_path'),
  fileSize: int('file_size'),
  mimeType: text('mime_type'),
  width: int('width'),
  height: int('height'),
  duration: int('duration'),
  format: text('format'),
  imageGenId: int('image_gen_id'),
  videoGenId: int('video_gen_id'),
  isFavorite: boolean('is_favorite').default(false),
  viewCount: int('view_count').default(0),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  updatedAt: varchar('updated_at', { length: 64 }).notNull(),
  deletedAt: varchar('deleted_at', { length: 64 }),
})
