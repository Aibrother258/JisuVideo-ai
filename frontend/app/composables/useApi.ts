const BASE = '/api/v1'

async function req<T = any>(method: string, path: string, body?: any): Promise<T> {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)

  const start = performance.now()
  console.log(`%c[API] %c${method} %c${path}`, 'color:#888', 'color:#4fc3f7;font-weight:bold', 'color:#ccc', body || '')

  try {
    const resp = await fetch(`${BASE}${path}`, opts)
    const json = await resp.json()
    const ms = Math.round(performance.now() - start)

    if (!resp.ok || (json.code && json.code >= 400)) {
      console.log(`%c[API] %c${method} ${path} %c${resp.status} %c${ms}ms`, 'color:#888', 'color:#ef5350', 'color:#ef5350;font-weight:bold', 'color:#888', json.message || '')
      throw new Error(json.message || `${resp.status}`)
    }

    console.log(`%c[API] %c${method} ${path} %c${resp.status} %c${ms}ms`, 'color:#888', 'color:#66bb6a', 'color:#66bb6a;font-weight:bold', 'color:#888')
    return json.data ?? json
  } catch (err: any) {
    if (!err.message?.match(/^\d{3}$/)) {
      const ms = Math.round(performance.now() - start)
      console.log(`%c[API] %c${method} ${path} %cERROR %c${ms}ms`, 'color:#888', 'color:#ef5350', 'color:#ef5350;font-weight:bold', 'color:#888', err.message)
    }
    throw err
  }
}

export const api = {
  get: <T = any>(p: string) => req<T>('GET', p),
  post: <T = any>(p: string, b?: any) => req<T>('POST', p, b),
  put: <T = any>(p: string, b?: any) => req<T>('PUT', p, b),
  del: <T = any>(p: string) => req<T>('DELETE', p),
}

export const dramaAPI = {
  list: () => api.get<{ items: any[] }>('/dramas'),
  get: (id: number) => api.get(`/dramas/${id}`),
  create: (data: any) => api.post('/dramas', data),
  update: (id: number, data: any) => api.put(`/dramas/${id}`, data),
  del: (id: number) => api.del(`/dramas/${id}`),
}

export const episodeAPI = {
  create: (data: any) => api.post('/episodes', data),
  update: (id: number, data: any) => api.put(`/episodes/${id}`, data),
  del: (id: number) => api.del(`/episodes/${id}`),
  characters: (id: number) => api.get(`/episodes/${id}/characters`),
  scenes: (id: number) => api.get(`/episodes/${id}/scenes`),
  props: (id: number) => api.get(`/episodes/${id}/props`),
  storyboards: (id: number) => api.get(`/episodes/${id}/storyboards`),
  pipelineStatus: (id: number) => api.get(`/episodes/${id}/pipeline-status`),
  extract: (id: number, target: string, model?: string, configId?: number) => api.post(`/episodes/${id}/extract`, { target, model: model || undefined, config_id: configId || undefined }),
  extractStatus: (id: number) => api.get(`/episodes/${id}/extract-status`),
  generateVideoPrompts: (id: number, model?: string, configId?: number, storyboardIds?: number[]) => api.post(`/episodes/${id}/generate-video-prompts`, { model: model || undefined, config_id: configId || undefined, storyboard_ids: storyboardIds?.length ? storyboardIds : undefined }),
  videoPromptsStatus: (id: number) => api.get(`/episodes/${id}/video-prompts-status`),
}

export const storyboardAPI = {
  create: (data: any) => api.post('/storyboards', data),
  update: (id: number, data: any) => api.put(`/storyboards/${id}`, data),
  del: (id: number) => api.del(`/storyboards/${id}`),
  referenceAssets: (id: number) => api.get(`/storyboards/${id}/reference-assets`),
  saveReferenceAssets: (id: number, items: any[]) => api.put(`/storyboards/${id}/reference-assets`, { items }),
}

export const characterAPI = {
  create: (data: any) => api.post('/characters', data),
  update: (id: number, data: any) => api.put(`/characters/${id}`, data),
  del: (id: number) => api.del(`/characters/${id}`),
  generatePrompt: (id: number, episodeId: number, force = false, textModel?: string, textConfigId?: number) => api.post(`/characters/${id}/generate-prompt`, { episode_id: episodeId, force, text_model: textModel || undefined, text_config_id: textConfigId || undefined }),
  generateImage: (id: number, episodeId: number, model?: string, configId?: number, textModel?: string, textConfigId?: number) => api.post(`/characters/${id}/generate-image`, { episode_id: episodeId, model: model || undefined, config_id: configId || undefined, text_model: textModel || undefined, text_config_id: textConfigId || undefined }),
  batchImages: (ids: number[], episodeId: number, model?: string, configId?: number, textModel?: string, textConfigId?: number) => api.post('/characters/batch-generate-images', { character_ids: ids, episode_id: episodeId, model: model || undefined, config_id: configId || undefined, text_model: textModel || undefined, text_config_id: textConfigId || undefined }),
}

export const sceneAPI = {
  create: (data: any) => api.post('/scenes', data),
  update: (id: number, data: any) => api.put(`/scenes/${id}`, data),
  del: (id: number) => api.del(`/scenes/${id}`),
  generatePrompt: (id: number, episodeId: number, force = false, textModel?: string, textConfigId?: number) => api.post(`/scenes/${id}/generate-prompt`, { episode_id: episodeId, force, text_model: textModel || undefined, text_config_id: textConfigId || undefined }),
  generateImage: (id: number, episodeId: number, model?: string, configId?: number, textModel?: string, textConfigId?: number) => api.post(`/scenes/${id}/generate-image`, { episode_id: episodeId, model: model || undefined, config_id: configId || undefined, text_model: textModel || undefined, text_config_id: textConfigId || undefined }),
}

export const propAPI = {
  create: (data: any) => api.post('/props', data),
  update: (id: number, data: any) => api.put(`/props/${id}`, data),
  del: (id: number) => api.del(`/props/${id}`),
  generatePrompt: (id: number, episodeId: number, force = false, textModel?: string, textConfigId?: number) => api.post(`/props/${id}/generate-prompt`, { episode_id: episodeId, force, text_model: textModel || undefined, text_config_id: textConfigId || undefined }),
  generateImage: (id: number, episodeId: number, model?: string, configId?: number, textModel?: string, textConfigId?: number) => api.post(`/props/${id}/generate-image`, { episode_id: episodeId, model: model || undefined, config_id: configId || undefined, text_model: textModel || undefined, text_config_id: textConfigId || undefined }),
}

// 统一生成任务（图片/视频）：POST 带 type 字段，列表按 type 过滤
export const taskAPI = {
  generate: (d: any) => api.post('/tasks', d),
  get: (id: number) => api.get(`/tasks/${id}`),
  del: (id: number) => api.del(`/tasks/${id}`),
  list: (params?: { type?: 'image' | 'video'; drama_id?: number; storyboard_id?: number }) => {
    const query = new URLSearchParams()
    if (params?.type) query.set('type', params.type)
    if (params?.drama_id) query.set('drama_id', String(params.drama_id))
    if (params?.storyboard_id) query.set('storyboard_id', String(params.storyboard_id))
    return api.get(`/tasks${query.size ? `?${query.toString()}` : ''}`)
  },
  // 按集聚合生成任务（sys_task + video_merges）
  listByEpisode: (episodeId: number) => api.get<{ tasks: any[]; merges: any[] }>(`/episodes/${episodeId}/generation-tasks`),
}

async function uploadReq<T = any>(path: string, file: File, meta: Record<string, string | number | boolean | null | undefined> = {}): Promise<T> {
  const fd = new FormData()
  fd.append('file', file)
  for (const [key, value] of Object.entries(meta)) {
    if (value !== undefined && value !== null) fd.append(key, String(value))
  }
  console.log(`%c[API] %cPOST %c${path} %c${file.name}`, 'color:#888', 'color:#4fc3f7;font-weight:bold', 'color:#ccc', 'color:#888')
  const resp = await fetch(`${BASE}${path}`, { method: 'POST', body: fd })
  const json = await resp.json()
  if (!resp.ok || (json.code && json.code >= 400)) {
    console.log(`%c[API] %cPOST ${path} %c${resp.status}`, 'color:#888', 'color:#ef5350', 'color:#ef5350;font-weight:bold')
    throw new Error(json.message || `${resp.status}`)
  }
  return json.data ?? json
}

export const uploadAPI = {
  image: (f: File, meta?: Record<string, any>) => uploadReq<{ url: string; path: string; asset_id?: number }>('/upload/image', f, meta),
  video: (f: File, meta?: Record<string, any>) => uploadReq<{ url: string; path: string; asset_id?: number }>('/upload/video', f, meta),
  audio: (f: File, meta?: Record<string, any>) => uploadReq<{ url: string; path: string; asset_id?: number }>('/upload/audio', f, meta),
}
export const assetLibraryAPI = {
  list: (params?: { drama_id?: number; episode_id?: number; type?: 'image' | 'video' | 'audio' }) => {
    const query = new URLSearchParams()
    if (params?.drama_id) query.set('drama_id', String(params.drama_id))
    if (params?.episode_id) query.set('episode_id', String(params.episode_id))
    if (params?.type) query.set('type', params.type)
    return api.get(`/assets${query.size ? `?${query.toString()}` : ''}`)
  },
}
export const mergeAPI = {
  merge: (epId: number, storyboardIds?: number[]) => api.post(`/merge/episodes/${epId}/merge`, storyboardIds?.length ? { storyboard_ids: storyboardIds } : {}),
  status: (epId: number) => api.get(`/merge/episodes/${epId}/merge`),
  list: (epId: number) => api.get<any[]>(`/merge/episodes/${epId}/merges`),
}
export const aiConfigAPI = {
  list: (t?: string) => api.get(`/ai-configs${t ? `?service_type=${t}` : ''}`),
  create: (d: any) => api.post('/ai-configs', d),
  update: (id: number, d: any) => api.put(`/ai-configs/${id}`, d),
  del: (id: number) => api.del(`/ai-configs/${id}`),
  test: (d: any) => api.post('/ai-configs/test', d),
}

export const promptAPI = {
  list: () => api.get('/prompts'),
  get: (type: string) => api.get(`/prompts/${type}`),
  update: (type: string, d: any) => api.put(`/prompts/${type}`, d),
  reset: (type: string) => api.post(`/prompts/${type}/reset`),
}

export const skillsAPI = {
  list: () => api.get('/skills'),
  get: (id: string) => api.get(`/skills/${id}`),
  create: (data: { id: string; name: string; description?: string }) => api.post('/skills', data),
  update: (id: string, content: string) => api.put(`/skills/${id}`, { content }),
  del: (id: string) => api.del(`/skills/${id}`),
}

export const stylePresetAPI = {
  list: (all = false) => api.get(`/style-presets${all ? '?all=1' : ''}`),
  create: (d: any) => api.post('/style-presets', d),
  update: (id: number, d: any) => api.put(`/style-presets/${id}`, d),
  del: (id: number) => api.del(`/style-presets/${id}`),
}
