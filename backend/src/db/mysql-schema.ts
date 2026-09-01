import type { Pool } from 'mysql2/promise'

export const mysqlSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS dramas (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title TEXT NOT NULL,
    description LONGTEXT,
    genre TEXT,
    style VARCHAR(64) DEFAULT '3d',
    aspect_ratio VARCHAR(16) DEFAULT '16:9',
    total_episodes INT DEFAULT 1,
    total_duration INT DEFAULT 0,
    status VARCHAR(64) NOT NULL DEFAULT 'draft',
    thumbnail TEXT,
    tags TEXT,
    metadata LONGTEXT,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    deleted_at VARCHAR(64)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS episodes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    drama_id INT NOT NULL,
    episode_number INT NOT NULL,
    title TEXT NOT NULL,
    content LONGTEXT,
    script_content LONGTEXT,
    description LONGTEXT,
    duration INT DEFAULT 0,
    status VARCHAR(64) DEFAULT 'draft',
    video_url TEXT,
    thumbnail TEXT,
    image_config_id INT,
    video_config_id INT,
    resolution VARCHAR(16) DEFAULT '720p',
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    deleted_at VARCHAR(64),
    UNIQUE KEY uq_episodes_drama_number (drama_id, episode_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS episode_plan_drafts (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    drama_id INT NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    content_fingerprint VARCHAR(64) NOT NULL,
    generated_fingerprint VARCHAR(64),
    version INT NOT NULL DEFAULT 1,
    selected_episode_number INT,
    resolution VARCHAR(16) NOT NULL DEFAULT '720p',
    plan_json LONGTEXT NOT NULL,
    revision_history LONGTEXT,
    generated_episode_ids LONGTEXT,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    UNIQUE KEY uq_episode_plan_drafts_drama (drama_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS characters (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    drama_id INT NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    description TEXT,
    appearance TEXT,
    styling TEXT,
    final_prompt TEXT,
    personality TEXT,
    image_url TEXT,
    reference_images TEXT,
    seed_value TEXT,
    sort_order INT,
    local_path TEXT,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    deleted_at VARCHAR(64)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS scenes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    drama_id INT NOT NULL,
    episode_id INT,
    location TEXT NOT NULL,
    time VARCHAR(64) NOT NULL,
    prompt TEXT NOT NULL,
    lighting TEXT,
    final_prompt TEXT,
    storyboard_count INT DEFAULT 1,
    image_url TEXT,
    status VARCHAR(64) DEFAULT 'pending',
    local_path TEXT,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    deleted_at VARCHAR(64)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS storyboards (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    episode_id INT NOT NULL,
    scene_id INT,
    storyboard_number INT NOT NULL,
    title TEXT,
    location TEXT,
    time VARCHAR(64),
    shot_type TEXT,
    angle TEXT,
    movement TEXT,
    result TEXT,
    atmosphere TEXT,
    image_prompt TEXT,
    video_prompt TEXT,
    minimax_h3_prompt TEXT,
    minimax_h3_source_hash VARCHAR(64),
    minimax_h3_generated_at VARCHAR(64),
    bgm_prompt TEXT,
    sound_effect TEXT,
    description TEXT,
    duration INT DEFAULT 0,
    composed_image TEXT,
    first_frame_image TEXT,
    last_frame_image TEXT,
    reference_images TEXT,
    video_url TEXT,
    subtitle_url TEXT,
    composed_video_url TEXT,
    status VARCHAR(64) DEFAULT 'pending',
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    deleted_at VARCHAR(64)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS storyboard_reference_assets (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    storyboard_id INT NOT NULL,
    asset_id INT,
    media_type VARCHAR(16) NOT NULL,
    media_role VARCHAR(32) NOT NULL DEFAULT 'reference',
    url TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    INDEX idx_storyboard_reference_assets_storyboard_id (storyboard_id),
    INDEX idx_storyboard_reference_assets_asset_id (asset_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS episode_characters (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    episode_id INT NOT NULL,
    character_id INT NOT NULL,
    created_at VARCHAR(64) NOT NULL,
    INDEX idx_episode_characters_episode_id (episode_id),
    INDEX idx_episode_characters_character_id (character_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS episode_scenes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    episode_id INT NOT NULL,
    scene_id INT NOT NULL,
    created_at VARCHAR(64) NOT NULL,
    INDEX idx_episode_scenes_episode_id (episode_id),
    INDEX idx_episode_scenes_scene_id (scene_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS episode_props (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    episode_id INT NOT NULL,
    prop_id INT NOT NULL,
    created_at VARCHAR(64) NOT NULL,
    INDEX idx_episode_props_episode_id (episode_id),
    INDEX idx_episode_props_prop_id (prop_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS storyboard_characters (
    storyboard_id INT NOT NULL,
    character_id INT NOT NULL,
    PRIMARY KEY (storyboard_id, character_id),
    INDEX idx_storyboard_characters_character_id (character_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS storyboard_props (
    storyboard_id INT NOT NULL,
    prop_id INT NOT NULL,
    PRIMARY KEY (storyboard_id, prop_id),
    INDEX idx_storyboard_props_prop_id (prop_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS ai_service_configs (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    service_type VARCHAR(64) NOT NULL,
    provider VARCHAR(64),
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    model TEXT,
    endpoint TEXT,
    query_endpoint TEXT,
    priority INT DEFAULT 0,
    is_default TINYINT(1) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    settings TEXT,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS ai_service_providers (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT,
    service_type VARCHAR(64) NOT NULL,
    provider VARCHAR(64) NOT NULL,
    default_url TEXT,
    preset_models TEXT,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS style_presets (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    value VARCHAR(64) NOT NULL,
    prompt TEXT NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    UNIQUE KEY uk_style_presets_value (value)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS sys_task (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(16) NOT NULL,
    storyboard_id INT,
    drama_id INT,
    scene_id INT,
    character_id INT,
    prop_id INT,
    provider VARCHAR(64),
    prompt TEXT,
    model TEXT,
    params TEXT,
    task_id TEXT,
    result_url TEXT,
    local_path TEXT,
    status VARCHAR(64) DEFAULT 'processing',
    error_msg TEXT,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    completed_at VARCHAR(64),
    INDEX idx_sys_task_type (type),
    INDEX idx_sys_task_drama_id (drama_id),
    INDEX idx_sys_task_storyboard_id (storyboard_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS video_merges (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    episode_id INT,
    drama_id INT,
    title TEXT,
    provider VARCHAR(64) NOT NULL,
    model TEXT NOT NULL,
    status VARCHAR(64) DEFAULT 'pending',
    scenes TEXT,
    merged_url TEXT,
    duration INT,
    task_id TEXT,
    error_msg TEXT,
    created_at VARCHAR(64) NOT NULL,
    completed_at VARCHAR(64),
    deleted_at VARCHAR(64)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS props (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    drama_id INT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    description TEXT,
    prompt TEXT,
    final_prompt TEXT,
    image_url TEXT,
    reference_images TEXT,
    local_path TEXT,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    deleted_at VARCHAR(64)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS assets (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    drama_id INT,
    episode_id INT,
    storyboard_id INT,
    storyboard_num INT,
    name TEXT,
    description TEXT,
    type TEXT,
    category TEXT,
    url TEXT,
    thumbnail_url TEXT,
    local_path TEXT,
    file_size INT,
    mime_type TEXT,
    width INT,
    height INT,
    duration INT,
    format TEXT,
    image_gen_id INT,
    video_gen_id INT,
    is_favorite TINYINT(1) DEFAULT 0,
    view_count INT DEFAULT 0,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    deleted_at VARCHAR(64)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
]

/**
 * 风格预设种子数据 — value 存入 dramas.style，prompt 注入生图提示词
 */
export const stylePresetSeeds = [
  { name: '3D 漫剧', value: '3d', sortOrder: 1, prompt: '3D CG animation style, game-engine quality render, semi-realistic stylized characters, refined facial features, detailed materials and textures, cinematic lighting, high detail', description: '游戏引擎级 3D 渲染，半写实角色，当前短剧主流的 3D 漫剧质感' },
  { name: '日漫赛璐璐', value: 'anime', sortOrder: 2, prompt: 'Japanese anime style, cel shading, clean crisp line art, vivid saturated colors, expressive character designs, detailed painted backgrounds', description: '日式赛璐璐动画风格' },
  { name: '吉卜力手绘', value: 'ghibli', sortOrder: 3, prompt: 'Studio Ghibli style, hand-drawn animation, soft watercolor painted backgrounds, warm nostalgic lighting, gentle natural palette, whimsical cozy atmosphere', description: '吉卜力手绘治愈风' },
  { name: '水彩绘本', value: 'watercolor', sortOrder: 4, prompt: 'watercolor illustration style, soft translucent washes, visible paper texture, delicate fluid brushwork, light airy atmosphere, hand-painted storybook feel', description: '水彩插画质感' },
  { name: '美式漫画', value: 'comic', sortOrder: 5, prompt: 'Western comic book style, bold black ink outlines, halftone dot shading, dynamic saturated colors, dramatic contrast lighting, flat graphic novel look', description: '美式漫画粗线条风格' },
]

// INSERT ... SELECT WHERE NOT EXISTS → 幂等：只补缺失行，不覆盖用户编辑，
// 且不会像 INSERT IGNORE 那样在每次启动时白白消耗自增 id
export const mysqlDataSeedStatements = stylePresetSeeds.map((s) => ({
  sql: 'INSERT INTO `style_presets` (`name`, `value`, `prompt`, `description`, `sort_order`, `is_active`, `created_at`, `updated_at`) SELECT ?, ?, ?, ?, ?, 1, ?, ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `style_presets` WHERE `value` = ?)',
  params: [s.name, s.value, s.prompt, s.description, s.sortOrder, new Date().toISOString(), new Date().toISOString(), s.value],
}))

export async function initMySqlSchema(pool: Pool) {
  for (const statement of mysqlSchemaStatements) {
    await pool.query(statement)
  }
  // 用户正文和剧本允许 20 万字符，必须使用 LONGTEXT；ALTER MODIFY 为幂等的数据保留迁移。
  await pool.query('ALTER TABLE dramas MODIFY COLUMN description LONGTEXT, MODIFY COLUMN metadata LONGTEXT')
  await pool.query('ALTER TABLE episodes MODIFY COLUMN content LONGTEXT, MODIFY COLUMN script_content LONGTEXT, MODIFY COLUMN description LONGTEXT')
  const [episodeNumberIndexes] = await pool.query<any[]>(
    "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'episodes' AND INDEX_NAME = 'uq_episodes_drama_number' LIMIT 1",
  )
  if (!episodeNumberIndexes.length) {
    const [duplicates] = await pool.query<any[]>(
      'SELECT drama_id, episode_number FROM episodes GROUP BY drama_id, episode_number HAVING COUNT(*) > 1 LIMIT 1',
    )
    if (duplicates.length) throw new Error('episodes 存在重复集号，无法建立唯一索引；请先人工处理重复数据')
    await pool.query('ALTER TABLE episodes ADD UNIQUE KEY uq_episodes_drama_number (drama_id, episode_number)')
  }
  // CREATE TABLE IF NOT EXISTS 不会给已有表补列；启动时幂等补齐新增生产字段。
  const [h3PromptColumns] = await pool.query<any[]>(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storyboards' AND COLUMN_NAME = 'minimax_h3_prompt' LIMIT 1",
  )
  if (!h3PromptColumns.length) {
    await pool.query('ALTER TABLE storyboards ADD COLUMN minimax_h3_prompt TEXT AFTER video_prompt')
  }
  const [h3MetaColumns] = await pool.query<any[]>(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storyboards' AND COLUMN_NAME IN ('minimax_h3_source_hash','minimax_h3_generated_at')",
  )
  const h3Meta = new Set(h3MetaColumns.map((row: any) => row.COLUMN_NAME))
  if (!h3Meta.has('minimax_h3_source_hash')) await pool.query('ALTER TABLE storyboards ADD COLUMN minimax_h3_source_hash VARCHAR(64) AFTER minimax_h3_prompt')
  if (!h3Meta.has('minimax_h3_generated_at')) await pool.query('ALTER TABLE storyboards ADD COLUMN minimax_h3_generated_at VARCHAR(64) AFTER minimax_h3_source_hash')
  await pool.query(`CREATE TABLE IF NOT EXISTS storyboard_reference_assets (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, storyboard_id INT NOT NULL, asset_id INT,
    media_type VARCHAR(16) NOT NULL, media_role VARCHAR(32) NOT NULL DEFAULT 'reference',
    url TEXT NOT NULL, sort_order INT NOT NULL DEFAULT 0, created_at VARCHAR(64) NOT NULL, updated_at VARCHAR(64) NOT NULL,
    INDEX idx_storyboard_reference_assets_storyboard_id (storyboard_id), INDEX idx_storyboard_reference_assets_asset_id (asset_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  for (const seed of mysqlDataSeedStatements) {
    await pool.query(seed.sql, seed.params)
  }
}
