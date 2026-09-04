import 'dotenv/config'
import fs from 'fs'
import mysql from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'
import * as schema from './schema.js'
import { initMySqlSchema } from './mysql-schema.js'

// 容器内 127.0.0.1 指向容器自身;未显式配置时默认指向宿主机
// (Linux 需 --add-host=host.docker.internal:host-gateway 才能解析)
const inContainer = fs.existsSync('/.dockerenv')
const usingDefaultHost = !process.env.DATABASE_URL && !process.env.MYSQL_HOST

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const host = process.env.MYSQL_HOST || (inContainer ? 'host.docker.internal' : '127.0.0.1')
  const port = process.env.MYSQL_PORT || '3306'
  const user = encodeURIComponent(process.env.MYSQL_USER || 'huobao')
  const password = encodeURIComponent(process.env.MYSQL_PASSWORD || 'huobao')
  const database = process.env.MYSQL_DATABASE || 'huobao_drama'
  return `mysql://${user}:${password}@${host}:${port}/${database}`
}

export const pool = mysql.createPool({
  uri: databaseUrl(),
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
})

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** 启动建表带重试：Docker 部署时 MySQL 容器就绪晚于应用启动，直接失败会导致进程崩溃 */
export async function initDb(retries = 10, delayMs = 3000) {
  for (let attempt = 1; ; attempt++) {
    try {
      await initMySqlSchema(pool)
      return
    } catch (err) {
      if (attempt >= retries) throw err
      console.warn(`[db] init failed (attempt ${attempt}/${retries}), retrying in ${delayMs}ms: ${(err as Error).message}`)
      if (attempt === 1 && usingDefaultHost && inContainer) {
        console.warn('[db] 未配置数据库连接:容器内默认尝试宿主机 host.docker.internal:3306。' +
          '如使用独立 MySQL 容器或外部数据库,请设置 DATABASE_URL 或 MYSQL_HOST 环境变量')
      }
      await sleep(delayMs)
    }
  }
}

export function getInsertId(result: unknown) {
  const packet = Array.isArray(result) ? result[0] : result
  const insertId = (packet as { insertId?: number | string } | undefined)?.insertId
  if (insertId === undefined || insertId === null) {
    throw new Error('MySQL insert did not return an insertId')
  }
  return Number(insertId)
}

// 测试专用双条件保护：仅当 NODE_ENV==='test' 且显式 MYSQL_NO_INIT=1 时跳过顶层建表，
// 供路由级行为测试（tests/id-param-route.test.mjs）在无 MySQL 环境下导入真实路由模块、
// 用 db.select stub 真实运行（不允许静默 skip）。生产 / Docker / 普通 npm test 未设置
// 该组合时行为不变，仍正常执行 initDb。
if (!(process.env.NODE_ENV === 'test' && process.env.MYSQL_NO_INIT === '1')) {
  await initDb()
}

export const db = drizzle(pool, { schema, mode: 'default' })
export { schema }
export type DB = typeof db
