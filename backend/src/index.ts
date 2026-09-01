import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import path from 'path'
import { fileURLToPath } from 'url'

import dramas from './routes/dramas.js'
import episodes from './routes/episodes.js'
import storyboards from './routes/storyboards.js'
import scenes from './routes/scenes.js'
import characters from './routes/characters.js'
import tasks from './routes/tasks.js'
import upload from './routes/upload.js'
import aiConfigs, { aiProviders } from './routes/aiConfigs.js'
import stylePresets from './routes/stylePresets.js'
import prompts from './routes/prompts.js'
import agent from './routes/agent.js'
import merge from './routes/merge.js'
import skills from './routes/skills.js'
import props from './routes/props.js'
import assets from './routes/assets.js'
import { requestLogger, errorHandler } from './middleware/logger.js'
import { recoverInterruptedTasks } from './services/recovery.js'
import { startStorageCleanup } from './utils/cleanup.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

const app = new Hono()

// Middleware（CORS 来源环境变量化：逗号分隔，默认开发端口；生产通过 CORS_ORIGIN 配置）
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3013,http://localhost:5679')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
app.use('*', cors({
  origin: corsOrigins,
  credentials: true,
}))
app.use('*', requestLogger)
app.use('*', errorHandler)
app.use('/api/v1/dramas/*', bodyLimit({
  maxSize: 2 * 1024 * 1024,
  onError: c => c.json({ code: 413, message: '请求内容超过 2MB 限制' }, 413),
}))

// Health check
app.get('/api/v1/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// API routes
const api = new Hono()
api.route('/dramas', dramas)
api.route('/episodes', episodes)
api.route('/storyboards', storyboards)
api.route('/scenes', scenes)
api.route('/characters', characters)
api.route('/tasks', tasks)
api.route('/upload', upload)
api.route('/ai-configs', aiConfigs)
api.route('/ai-providers', aiProviders)
api.route('/style-presets', stylePresets)
api.route('/prompts', prompts)
api.route('/agent', agent)
api.route('/merge', merge)
api.route('/skills', skills)
api.route('/props', props)
api.route('/assets', assets)

app.route('/api/v1', api)

// Serve static files (storage)
// 生成的图片/视频按 uuid 命名、内容不变，标记为 immutable 让浏览器长缓存
app.use('/static/*', async (c, next) => {
  await next()
  if (c.res.ok) c.header('Cache-Control', 'public, max-age=31536000, immutable')
})
app.use('/static/*', serveStatic({ root: path.join(projectRoot, 'data') }))

// Serve frontend (production build)
const distPath = path.join(projectRoot, 'frontend', 'dist')
app.use('*', serveStatic({ root: distPath }))
app.get('*', serveStatic({ root: distPath, path: 'index.html' }))

const port = Number(process.env.PORT || 5679)
console.log(`🚀 Huobao Drama TS server on http://localhost:${port}`)

// 进程重启后内存中的轮询线程全部丢失：视频任务可凭上游 taskId 续跑（避免已产生费用的任务丢失），
// 拼接任务与图片任务无恢复价值则标记 failed，避免前端一直显示"生成中"
const runInterruptedTaskRecovery = () => {
  recoverInterruptedTasks()
    .catch(err => console.error('恢复中断任务失败:', err?.message))
}

runInterruptedTaskRecovery()
// 旧实例崩溃后遗留的租约会在最长五分钟后过期。周期扫描接管到期租约，
// 防止冷重启首次扫描跳过后任务永久停留在 processing。
const recoveryTimer = setInterval(runInterruptedTaskRecovery, 60_000)
recoveryTimer.unref()

// 存储清理定时任务：temp TTL + 孤儿文件 GC（间隔/保留时长见 utils/cleanup.ts 环境变量）
startStorageCleanup()

serve({ fetch: app.fetch, port })
