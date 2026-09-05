/**
 * Issue #71 / S1-1：v0.4 原文版本表迁移与 source 行懒生成
 *
 * 契约依据：docs/source-intelligence-episode-planning-v0.4.md rev8
 *   §6.1 source_versions 字段表 + 不变量 I1 / I2 / I7
 *   §6.2 source_anchors 锚点表
 *   §6.3 懒生成并发防重、旧项目零回填、DDL 幂等
 *
 * 覆盖验收项：
 *   - 不变量 I1 / I2 / I7（纯函数 + 代码结构守卫）
 *   - DDL 幂等（CREATE TABLE IF NOT EXISTS + information_schema 判存 ALTER）
 *   - 懒生成防重（事务内锁 dramas 行 → 锁内判定 → INSERT + 回填指针）
 *   - 旧项目零回填（无批量建行语句；指针 NULL 语义保持）
 *   - 契约字段类型对齐（LONGTEXT / VARCHAR(64) / INT / 非 JSON 列）
 *   - analyze-episodes 懒生成接线
 *
 * 真实 MySQL 段（本文件末）：显式配置 MySQL 后真实执行 initMySqlSchema 连续 2 次、
 *   并发 5 次懒生成、指针回填与不变量断言。仅本地显式 SOURCE_DB_TEST=0 时 skip，CI 连接失败直接失败
 *   （与仓库「无 MySQL 两态」约定一致；skip 只限真实 DB 段，纯函数与结构断言永不 skip）。
 *
 * 运行：cd backend && npm test
 */
import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// 必须先设置这两个变量，再动态导入任何 ../src/** 模块：
// db/index.ts 顶层 initDb 在 NODE_ENV==='test' && MYSQL_NO_INIT==='1' 时跳过建表，
// 否则本文件的模块加载会对开发库 huobao_drama 执行 DDL。
// 注意 node --test 会先求值静态 import，故本文件不得用静态 import 引入 src。
process.env.NODE_ENV = 'test'
process.env.MYSQL_NO_INIT = '1'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

// ─── 1. 不变量 I1：content_hash 定义 ──────────────────────────────────────
const { sourceVersionContentHash, SOURCE_BASE_KINDS } = await import('../src/services/source-versions.ts')

test('I1：content_hash = sha256(String(content || "").trim())，与现有 sourceHash 同算法', () => {
  const plain = '第一章 午夜面馆\n\n老板娘掀开布帘的时候，外面已经落雪。'
  assert.equal(sourceVersionContentHash(plain), createHash('sha256').update(plain.trim()).digest('hex'))

  // trim 口径（契约 §6.1 I9 规范化输入）：首尾空白不影响哈希
  assert.equal(sourceVersionContentHash(`  ${plain}  `), sourceVersionContentHash(plain))

  // String(content || '')：null / undefined 归一为空串，不抛错
  assert.equal(sourceVersionContentHash(null), createHash('sha256').update('').digest('hex'))
  assert.equal(sourceVersionContentHash(undefined), sourceVersionContentHash(null))
  assert.equal(sourceVersionContentHash(''), sourceVersionContentHash(null))

  // 非字符串也走 String() 转换
  assert.equal(sourceVersionContentHash(12345), createHash('sha256').update('12345').digest('hex'))
  // 中文按 UTF-8 字节哈希（MySQL utf8mb4 下不能按字符编码）
  assert.equal(sourceVersionContentHash('面馆'), createHash('sha256').update('面馆').digest('hex'))
})

test('I1：哈希算法与 src/services/episode-plan-draft.ts 的 sourceHash 一致（契约 §6.1 指定）', async () => {
  const { sourceHash } = await import('../src/services/episode-plan-draft.ts')
  const samples = ['  正文一  ', '第二章 雨夜', '', '面馆·午夜']
  for (const sample of samples) {
    assert.equal(sourceVersionContentHash(sample), sourceHash(sample), `算法不一致：${sample}`)
  }
})

test('base_kind 枚举与契约 §6.1 一致', () => {
  assert.deepEqual([...SOURCE_BASE_KINDS], ['source', 'cleaned', 'confirmed', 'user-edited'])
})

// ─── 2. DDL 幂等与字段类型（契约 §6.1 / §6.2 / §6.3）─────────────────────
test('DDL 幂等：source_versions / source_anchors 用 CREATE TABLE IF NOT EXISTS', () => {
  const schema = read('src/db/mysql-schema.ts')
  assert.match(schema, /CREATE TABLE IF NOT EXISTS source_versions /)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS source_anchors /)
})

test('DDL 幂等：dramas 新列用 information_schema.COLUMNS 判存的幂等 ALTER（沿用 sys_task 模式）', () => {
  const schema = read('src/db/mysql-schema.ts')
  // 一次查询同时判存两列，避免两次 information_schema 往返
  assert.match(schema, /SELECT COLUMN_NAME FROM information_schema\.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = 'dramas' AND COLUMN_NAME IN \('current_source_version_id','source_skip_at'\)/)
  assert.match(schema, /if \(!sourceVersionCols\.has\('current_source_version_id'\)\)/)
  assert.match(schema, /if \(!sourceVersionCols\.has\('source_skip_at'\)\)/)
  assert.match(schema, /ALTER TABLE dramas ADD COLUMN current_source_version_id INT AFTER metadata/)
  assert.match(schema, /ALTER TABLE dramas ADD COLUMN source_skip_at VARCHAR\(64\) AFTER current_source_version_id/)
})

test('DDL 幂等：新 DDL 追加在 initMySqlSchema 内（不引入独立迁移工具）', () => {
  const schema = read('src/db/mysql-schema.ts')
  const fnStart = schema.indexOf('export async function initMySqlSchema')
  const ddlPos = schema.indexOf('CREATE TABLE IF NOT EXISTS source_versions')
  assert.ok(fnStart > 0 && ddlPos > fnStart, 'source_versions DDL 必须位于 initMySqlSchema 内')
})

test('字段类型对齐契约 §6.1（LONGTEXT 非 TEXT、VARCHAR(64) 非 CHAR/TIMESTAMP、INT 非 BIGINT、非 JSON 列）', () => {
  const schema = read('src/db/mysql-schema.ts')
  const versionsDdl = schema.slice(
    schema.indexOf('CREATE TABLE IF NOT EXISTS source_versions'),
    schema.indexOf('ENGINE=InnoDB', schema.indexOf('CREATE TABLE IF NOT EXISTS source_versions')),
  )
  assert.match(versionsDdl, /id INT NOT NULL AUTO_INCREMENT PRIMARY KEY/)
  assert.match(versionsDdl, /drama_id INT NOT NULL/)
  assert.match(versionsDdl, /base_kind VARCHAR\(16\) NOT NULL/)
  assert.match(versionsDdl, /content LONGTEXT NOT NULL/)
  assert.match(versionsDdl, /content_hash VARCHAR\(64\) NOT NULL/)
  // I2：source 首行 base_hash = 自身 content_hash，故 NOT NULL（不落库 NULL）
  assert.match(versionsDdl, /base_hash VARCHAR\(64\) NOT NULL/)
  assert.match(versionsDdl, /parent_version_id INT/)
  assert.match(versionsDdl, /diff LONGTEXT/)
  assert.match(versionsDdl, /stats TEXT/)
  assert.match(versionsDdl, /created_at VARCHAR\(64\) NOT NULL/)
  // 明确否定项：不得用 MySQL JSON 列（对齐 plan_json 的 LONGTEXT 既有写法）、
  // 不得用 TIMESTAMP（契约 §6.1「与现有表时间格式一致，ISO 字符串」）、不得用 BIGINT
  assert.doesNotMatch(versionsDdl, /\bJSON\b/)
  assert.doesNotMatch(versionsDdl, /TIMESTAMP/)
  assert.doesNotMatch(versionsDdl, /BIGINT/)
  // rev2：不设 (drama_id, base_kind, …) 类唯一键 —— 同一 kind 多行历史是常态
  assert.doesNotMatch(versionsDdl, /UNIQUE/i)
  // rev2：不设 version_seq 列（版本序号 = 自增主键 id，废除 MAX(version_seq)+1）
  assert.doesNotMatch(versionsDdl, /version_seq/)
  // 普通索引（非唯一）
  assert.match(versionsDdl, /INDEX idx_source_versions_drama \(drama_id\)/)
  assert.match(versionsDdl, /INDEX idx_source_versions_parent \(parent_version_id\)/)
})

test('source_anchors 锚点表不承载正文（契约 §6.2）', () => {
  const schema = read('src/db/mysql-schema.ts')
  const anchorsDdl = schema.slice(
    schema.indexOf('CREATE TABLE IF NOT EXISTS source_anchors'),
    schema.indexOf('ENGINE=InnoDB', schema.indexOf('CREATE TABLE IF NOT EXISTS source_anchors')),
  )
  assert.match(anchorsDdl, /drama_id INT NOT NULL/)
  assert.match(anchorsDdl, /version_id INT NOT NULL/)
  assert.match(anchorsDdl, /para_id VARCHAR\(64\) NOT NULL/)
  assert.match(anchorsDdl, /anchor_text TEXT NOT NULL/)
  assert.match(anchorsDdl, /hash VARCHAR\(64\) NOT NULL/)
  assert.match(anchorsDdl, /start INT NOT NULL/)
  assert.match(anchorsDdl, /end INT NOT NULL/)
  assert.match(anchorsDdl, /sort_order INT NOT NULL DEFAULT 0/)
  // 锚点表不得有 content 列（正文权威为「当前有效正文」）
  assert.doesNotMatch(anchorsDdl, /content\b/)
})

test('schema.ts 类型映射与 DDL 一致（index 非 uniqueIndex，对齐 DDL 的普通 INDEX）', () => {
  const schema = read('src/db/schema.ts')
  assert.match(schema, /export const sourceVersions = mysqlTable\('source_versions'/)
  assert.match(schema, /baseKind: varchar\('base_kind', \{ length: 16 \}\)\.notNull\(\)/)
  assert.match(schema, /content: longtext\('content'\)\.notNull\(\)/)
  assert.match(schema, /baseHash: varchar\('base_hash', \{ length: 64 \}\)\.notNull\(\)/)
  assert.match(schema, /diff: longtext\('diff'\)/)
  const versionMapping = schema.slice(schema.indexOf('export const sourceVersions'), schema.indexOf('export const sourceAnchors'))
  assert.match(versionMapping, /updatedAt: varchar\('updated_at', \{ length: 64 \}\)\.notNull\(\)/)
  assert.match(schema, /export const sourceAnchors = mysqlTable\('source_anchors'/)
  assert.match(schema, /currentSourceVersionId: int\('current_source_version_id'\)/)
  assert.match(schema, /sourceSkipAt: varchar\('source_skip_at', \{ length: 64 \}\)/)
  assert.match(schema, /index\('idx_source_versions_drama'\)\.on\(table\.dramaId\)/)
  assert.match(schema, /index\('idx_source_anchors_para'\)\.on\(table\.versionId, table\.paraId\)/)
})

// ─── 3. 不变量 I7：版本行完全不可变 ──────────────────────────────────────
test('I7：懒生成代码无任何版本行 UPDATE / DELETE 路径', () => {
  const src = read('src/services/source-versions.ts')
  // 只允许 INSERT INTO source_versions，不得有 UPDATE / DELETE source_versions
  assert.match(src, /INSERT INTO source_versions/)
  assert.doesNotMatch(src, /UPDATE\s+source_versions/i, '版本行不可 UPDATE（I7）')
  assert.doesNotMatch(src, /DELETE\s+FROM\s+source_versions/i, '版本行不可删除（I7）')
  assert.doesNotMatch(src, /TRUNCATE\s+source_versions/i)
  // 指针更新只能落在 dramas 表上（切指针 ≠ 改版本行）
  assert.match(src, /UPDATE dramas SET current_source_version_id = \?/)
})

// ─── 4. 懒生成并发防重（契约 §6.3 rev3）───────────────────────────────────
test('懒生成：事务内锁 dramas 行 + 锁内判定已有版本行则跳过', () => {
  const src = read('src/services/source-versions.ts')
  assert.match(src, /await connection\.beginTransaction\(\)/)
  assert.match(src, /SELECT id, description, deleted_at FROM dramas WHERE id = \? FOR UPDATE/)
  assert.match(src, /SELECT id FROM source_versions WHERE drama_id = \? ORDER BY id ASC LIMIT 1/)
  assert.match(src, /await connection\.commit\(\)/)
  assert.match(src, /await connection\.rollback\(\)/)
  assert.match(src, /connection\.release\(\)/)

  // 并发安全的核心：transaction body 内每一个 return 之前都必须 commit（或走 catch→rollback）。
  // 若 beginTransaction 之后直接 return，mysql2 的 release() 不会自动提交/回滚，事务与
  // FOR UPDATE 行锁会泄漏在归还池的连接上，后续并发调用等满 innodb_lock_wait_timeout。
  const start = src.indexOf('await connection.beginTransaction()')
  assert.ok(start >= 0)
  // body = 内层 try 块（不含 catch 错误路径）
  const body = src.slice(start, src.indexOf('} catch (err)', start))
  const returns = [...body.matchAll(/\breturn\b/g)].length
  const commits = [...body.matchAll(/connection\.commit\(\)/g)].length
  assert.ok(returns > 0, 'transaction body 应存在多个提前 return 分支')
  assert.equal(commits, returns, `每个 return 前都必须 commit（避免锁泄漏）：${returns} 个 return，${commits} 个 commit`)
  // 错误路径必须 rollback（在外层 try/catch 内，body 之外）
  assert.match(src.slice(start), /\} catch \(err\)[\s\S]*?await connection\.rollback\(\)/)
})

test('懒生成：不新建业务端点，仅在 analyze-episodes 携带正文处接线（契约 §6.3 触发点）', () => {
  const routes = read('src/routes/dramas.ts')
  assert.match(routes, /import \{ ensureSourceVersion, SourceContentConflict \} from '\.\.\/services\/source-versions\.js'/)
  assert.match(routes, /await ensureSourceVersion\(id, content\)/)
  // Issue #71 明确不做：不得新增 source 业务端点
  assert.doesNotMatch(routes, /source\/versions/, '不得新增 GET /source/versions（归 #72）')
  assert.doesNotMatch(routes, /source\/clean/, '不得新增 /source/clean（归 #72）')
  assert.doesNotMatch(routes, /source\/confirm/, '不得新增 /source/confirm（归 #72）')
  assert.doesNotMatch(routes, /source\/switch/, '不得新增 /source/switch（归 #72）')
})

// ─── 5. 旧项目零回填（契约 §6.3）─────────────────────────────────────────
test('旧项目零回填：不存在为存量项目批量建版本行的语句', () => {
  const schema = read('src/db/mysql-schema.ts')
  const src = read('src/services/source-versions.ts')
  // 不得有针对 dramas 全表的批量 INSERT ... SELECT（会一次性给所有旧项目建 source 行）
  assert.doesNotMatch(schema, /INSERT INTO `?source_versions`?[\s\S]{0,200}SELECT[\s\S]*FROM `?dramas`/i)
  assert.doesNotMatch(schema, /INSERT INTO `?dramas`?[\s\S]{0,120}SELECT[\s\S]*FROM `?dramas`/i)
  // 懒生成必须是「按单个 drama_id」驱动
  assert.doesNotMatch(src, /INSERT INTO source_versions[\s\S]*FROM dramas/i)
  assert.match(src, /WHERE id = \? FOR UPDATE/)
})

test('指针语义保持：NULL = 未整理/旧项目，回退 dramas.description（契约 §6.1 零回填兼容位）', () => {
  const src = read('src/services/source-versions.ts')
  // dramas 新列无 NOT NULL、无 DEFAULT → 旧项目保持 NULL
  const schema = read('src/db/mysql-schema.ts')
  assert.match(schema, /ALTER TABLE dramas ADD COLUMN current_source_version_id INT AFTER metadata/)
  assert.doesNotMatch(schema, /current_source_version_id INT NOT NULL/)
  // 读取路径：指针为空时回退 description
  assert.match(src, /if \(!drama\.currentSourceVersionId\) return String\(drama\.description \|\| ''\)\.trim\(\)/)
})

test('POST /dramas 创建链路不变：懒生成不参与创建（契约 §6.3）', () => {
  const src = read('src/services/source-versions.ts')
  assert.doesNotMatch(src, /INSERT INTO dramas/, '懒生成不得创建项目')
})

// 真实数据库模式：CI 强制执行；本地仅显式 SOURCE_DB_TEST=0 可跳过。
// 每次创建唯一隔离库，不删除/授权任何既有库或用户。
test('真实 MySQL：initMySqlSchema 连续 2 次幂等 + 并发 5 次懒生成只产生 1 行', async (t) => {
  if (process.env.SOURCE_DB_TEST === '0' && !process.env.CI) {
    t.skip('显式无 MySQL 模式 SOURCE_DB_TEST=0')
    return
  }
  const mysql = (await import('mysql2/promise')).default
  const options = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_TEST_ADMIN_USER || process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_TEST_ADMIN_PASSWORD ?? process.env.MYSQL_PASSWORD ?? 'huobao',
    connectTimeout: 5000,
  }
  const admin = await mysql.createConnection(options)
  const testDb = 's1_test_' + randomUUID().replaceAll('-', '')
  let pool
  let created = false
  const MARKER = 'S1TEST-'
  try {
    await admin.query(`CREATE DATABASE \`${testDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    created = true
    pool = mysql.createPool({ ...options, database: testDb, charset: 'utf8mb4', connectionLimit: 20 })
    // 6.1 幂等升级：先在隔离库用「上一版本」的 source_versions 定义建表
    //（故意不含契约 §6.1 要求的 updated_at），再跑生产 initMySqlSchema，
    // 验证既有表能被 information_schema 判存 ALTER 补齐新列——与 sys_task 恢复租约列同模式。
    // 断言对象是生产 mysql-schema.ts 的真实输出，不在此重复书写 schema 文本。
    await pool.query(`CREATE TABLE source_versions (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      drama_id INT NOT NULL,
      base_kind VARCHAR(16) NOT NULL,
      content LONGTEXT NOT NULL,
      content_hash VARCHAR(64) NOT NULL,
      base_hash VARCHAR(64) NOT NULL,
      parent_version_id INT,
      diff LONGTEXT,
      stats TEXT,
      created_at VARCHAR(64) NOT NULL,
      INDEX idx_source_versions_drama (drama_id),
      INDEX idx_source_versions_parent (parent_version_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

    // 生产 schema 流程：建 source_anchors、dramas 补两列、source_versions 补 updated_at
    const { initMySqlSchema } = await import('../src/db/mysql-schema.ts')
    await initMySqlSchema(pool)

    // 幂等：第二次执行不报错、不重复补列
    await initMySqlSchema(pool)
    const [afterSecondRun] = await pool.query(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [testDb, 'source_versions'],
    )
    assert.equal(
      new Set(afterSecondRun.map((r) => r.COLUMN_NAME)).size,
      afterSecondRun.length,
      '重复执行不得产生重复列',
    )

    // 6.2 列定义、可空性（契约 §6.1 字段表）
    const [columns] = await pool.query(
      'SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, DATA_TYPE FROM information_schema.COLUMNS ' +
        `WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'source_versions'`,
      [testDb],
    )
    const colNames = new Map(columns.map((row) => [row.COLUMN_NAME, row]))
    for (const name of ['id', 'drama_id', 'base_kind', 'content', 'content_hash', 'base_hash', 'parent_version_id', 'diff', 'stats', 'created_at', 'updated_at']) {
      assert.ok(colNames.has(name), `source_versions 缺少列 ${name}`)
    }
    assert.equal(colNames.get('content').DATA_TYPE, 'longtext')
    assert.equal(colNames.get('base_kind').COLUMN_TYPE, 'varchar(16)')
    assert.equal(colNames.get('content_hash').COLUMN_TYPE, 'varchar(64)')
    assert.equal(colNames.get('base_hash').COLUMN_TYPE, 'varchar(64)')
    assert.equal(colNames.get('base_hash').IS_NULLABLE, 'NO', 'I2：base_hash 不得为 NULL')
    assert.equal(colNames.get('parent_version_id').IS_NULLABLE, 'YES')
    assert.equal(colNames.get('diff').DATA_TYPE, 'longtext')
    assert.equal(colNames.get('diff').IS_NULLABLE, 'YES')
    assert.equal(colNames.get('created_at').COLUMN_TYPE, 'varchar(64)')
    assert.equal(colNames.get('parent_version_id').DATA_TYPE, 'int')

    // 索引：普通非唯一索引（rev2 明确不设 (drama_id, base_kind) 类唯一键）
    const [indexes] = await pool.query(
      'SELECT INDEX_NAME, NON_UNIQUE FROM information_schema.STATISTICS ' +
        `WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'source_versions' GROUP BY INDEX_NAME, NON_UNIQUE`,
      [testDb],
    )
    const byIndex = new Map(indexes.map((r) => [r.INDEX_NAME, Number(r.NON_UNIQUE)]))
    assert.equal(byIndex.get('PRIMARY'), 0)
    assert.equal(byIndex.get('idx_source_versions_drama'), 1, 'drama 索引应为普通索引')
    assert.equal(byIndex.get('idx_source_versions_parent'), 1, 'parent 索引应为普通索引')
    assert.ok(!indexes.some((r) => r.INDEX_NAME.startsWith('uk_')), '不得建立 (drama_id, base_kind) 类唯一键')

    // dramas 新列类型与可空性（旧项目零回填要求指针可空）
    const [dramaColumns] = await pool.query(
      'SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS ' +
        `WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'dramas' AND COLUMN_NAME IN (?, ?)`,
      [testDb, 'current_source_version_id', 'source_skip_at'],
    )
    assert.deepEqual(
      dramaColumns.map((r) => r.COLUMN_NAME).sort(),
      ['current_source_version_id', 'source_skip_at'],
    )
    assert.equal(dramaColumns.find((r) => r.COLUMN_NAME === 'current_source_version_id').COLUMN_TYPE, 'int')
    assert.equal(dramaColumns.find((r) => r.COLUMN_NAME === 'current_source_version_id').IS_NULLABLE, 'YES', '旧项目零回填：指针必须可空')
    assert.equal(dramaColumns.find((r) => r.COLUMN_NAME === 'source_skip_at').COLUMN_TYPE, 'varchar(64)')

    // 6.2 建测试项目
    const ts = new Date().toISOString()
    const suffix = ts.replace(/[:.]/g, '')
    const title = `${MARKER}${suffix}`
    const sourceText = '  第一章 午夜面馆\n\n老板娘掀开布帘的时候，外面已经落雪。\n\n第二章 雨夜\n\n雨一直下到后半夜。  '
    await pool.query(
      'INSERT INTO dramas (title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [title, sourceText, 'draft', ts, ts],
    )
    const [dramas] = await pool.query('SELECT id FROM dramas WHERE title = ? LIMIT 1', [title])
    const dramaId = Number(dramas[0].id)

    // 6.3 并发 5 次懒生成 → 只产生 1 条 source 行
    const mod = await import('../src/services/source-versions.ts')
    const results = await Promise.all(
      Array.from({ length: 5 }, () => mod.ensureSourceVersion(dramaId, sourceText, pool)),
    )
    assert.ok(results.every((r) => typeof r === 'number'), `所有并发调用都应返回版本行 id，实际：${JSON.stringify(results)}`)
    assert.equal(new Set(results).size, 1, `并发懒生成必须收敛到同一版本行 id，实际：${JSON.stringify(results)}`)

    const [versions] = await pool.query('SELECT * FROM source_versions WHERE drama_id = ? ORDER BY id', [dramaId])
    assert.equal(versions.length, 1, `并发 5 次只应产生 1 条 source 行，实际 ${versions.length} 条`)

    const row = versions[0]
    assert.equal(row.base_kind, 'source')
    assert.equal(row.parent_version_id, null)
    assert.equal(row.diff, null)
    assert.equal(row.stats, null)
    assert.equal(row.content, sourceText.trim(), 'content 应为 canonical trim 后正文')

    // 6.4 不变量 I1 / I2（真库验证）
    const expectedHash = createHash('sha256').update(sourceText.trim()).digest('hex')
    assert.equal(row.content_hash, expectedHash, 'I1：content_hash = sha256(String(content).trim())')
    assert.equal(row.base_hash, expectedHash, 'I2：source 首行 base_hash = 自身 content_hash')

    // 6.5 指针回填与 INSERT 同事务提交，不存在中间态
    const [updated] = await pool.query('SELECT current_source_version_id, source_skip_at FROM dramas WHERE id = ?', [dramaId])
    assert.equal(Number(updated[0].current_source_version_id), Number(row.id), '懒生成后必须回填当前指针')
    assert.equal(updated[0].source_skip_at, null, '懒生成不得设置 skip 标记')

    // 6.6 已存在版本行时不新建（幂等），且不因正文为空而错报
    assert.equal(await mod.ensureSourceVersion(dramaId, sourceText, pool), Number(row.id), '已有版本行时返回既有 id')
    assert.equal(await mod.ensureSourceVersion(dramaId, undefined, pool), Number(row.id), '不携带 expected 正文时幂等返回')
    const [versionsAfter] = await pool.query('SELECT COUNT(*) AS count FROM source_versions WHERE drama_id = ?', [dramaId])
    assert.equal(Number(versionsAfter[0].count), 1, '重复调用不得新增版本行')

    // 6.7 已有版本行的项目不会因 contentOverride 变化而新建（I7 不可变语义）
    const overrideText = '重写后的正文，用于验证 contentOverride 不会改写既有版本行。'
    assert.equal(mod.sourceVersionContentHash(overrideText), createHash('sha256').update(overrideText).digest('hex'))
    await assert.rejects(mod.ensureSourceVersion(dramaId, overrideText, pool), mod.SourceContentConflict)

    // 6.8 旧项目零回填：另建项目，验证指针 NULL、无版本行；显式调用才建行
    const legacyTitle = `${MARKER}legacy-${suffix}`
    await pool.query(
      'INSERT INTO dramas (title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [legacyTitle, '旧项目正文内容，无需回填。', 'draft', ts, ts],
    )
    const [legacy] = await pool.query('SELECT id, current_source_version_id FROM dramas WHERE title = ? LIMIT 1', [legacyTitle])
    assert.equal(legacy[0].current_source_version_id, null, '旧项目指针应保持 NULL')
    const [legacyVersions] = await pool.query('SELECT COUNT(*) AS count FROM source_versions WHERE drama_id = ?', [legacy[0].id])
    assert.equal(Number(legacyVersions[0].count), 0, '旧项目不得被批量回填版本行')
    await assert.rejects(mod.ensureSourceVersion(legacy[0].id, '未保存的正文，不得固化为原版', pool), mod.SourceContentConflict)
    const [rejected] = await pool.query('SELECT current_source_version_id FROM dramas WHERE id = ?', [legacy[0].id])
    assert.equal(rejected[0].current_source_version_id, null)
    const [rejectedVersions] = await pool.query('SELECT COUNT(*) AS count FROM source_versions WHERE drama_id = ?', [legacy[0].id])
    assert.equal(Number(rejectedVersions[0].count), 0)
    const legacyVersionId = await mod.ensureSourceVersion(legacy[0].id, undefined, pool)
    assert.ok(legacyVersionId > 0, '显式调用应为旧项目建立首条 source 行')
    const [legacyAfter] = await pool.query('SELECT current_source_version_id FROM dramas WHERE id = ?', [legacy[0].id])
    assert.equal(Number(legacyAfter[0].current_source_version_id), Number(legacyVersionId))

    // 6.9 空正文项目不建行（避免空 source 行污染指针）
    const emptyTitle = `${MARKER}empty-${suffix}`
    await pool.query('INSERT INTO dramas (title, status, created_at, updated_at) VALUES (?, ?, ?, ?)', [emptyTitle, 'draft', ts, ts])
    const [emptyRow] = await pool.query('SELECT id FROM dramas WHERE title = ? LIMIT 1', [emptyTitle])
    assert.equal(await mod.ensureSourceVersion(Number(emptyRow[0].id), undefined, pool), null, '无正文项目不得建立 source 行')
    const [emptyPointer] = await pool.query('SELECT current_source_version_id FROM dramas WHERE id = ?', [emptyRow[0].id])
    assert.equal(emptyPointer[0].current_source_version_id, null, '空正文项目指针应保持 NULL')

    // 6.10 不存在的项目返回 null，不抛错
    assert.equal(await mod.ensureSourceVersion(-999999, '任意正文', pool), null)

    // 6.11 I7：版本行写入后无任何 UPDATE 语句（真库层面验证数据未被二次修改）
    const [finalRow] = await pool.query('SELECT content_hash, base_hash, content FROM source_versions WHERE id = ?', [row.id])
    assert.equal(finalRow[0].content_hash, expectedHash)
    assert.equal(finalRow[0].base_hash, expectedHash)
    assert.equal(finalRow[0].content, sourceText.trim())
  } finally {
    try {
      if (pool) await pool.end()
    } finally {
      try {
        if (created && /^s1_test_[a-f0-9]{32}$/.test(testDb)) {
          await admin.query(`DROP DATABASE \`${testDb}\``)
        }
      } finally {
        await admin.end()
      }
    }
  }
})
