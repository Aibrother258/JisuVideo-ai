import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractReadableText } from '../src/services/source-import.ts'
import { splitSourceIntoEpisodes } from '../src/services/episode-planning.ts'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('HTML novel import removes executable and navigation content', () => {
  const result = extractReadableText(`<!doctype html><html><head><title>测试小说</title><style>.x{}</style></head><body><nav>目录</nav><article><h1>第一章</h1><p>夜里十点，他重新打开电脑。</p><p>屏幕上的光照亮了桌面。</p></article><script>alert('x')</script></body></html>`, 'text/html; charset=utf-8')
  assert.equal(result.title, '测试小说')
  assert.match(result.content, /第一章/)
  assert.match(result.content, /夜里十点/)
  assert.doesNotMatch(result.content, /目录|alert|\.x/)
})

test('episode splitting keeps source order and creates reviewable content for every episode', () => {
  const paragraphs = Array.from({ length: 12 }, (_, index) => `第${index + 1}段：这是按顺序保留的原文内容。`)
  const source = paragraphs.join('\n\n')
  const result = splitSourceIntoEpisodes(source, 4, [
    { title: '起点' }, { title: '推进' }, { title: '转折' }, { title: '收束' },
  ])
  assert.equal(result.length, 4)
  assert.deepEqual(result.map(item => item.title), ['起点', '推进', '转折', '收束'])
  assert.equal(result.map(item => item.content).join(''), source)
  assert.ok(result.every(item => item.content && item.character_count > 0))
})

test('episode splitting never drops a long unpunctuated prefix before punctuation', () => {
  const source = `${'甲'.repeat(1317)}。${'乙'.repeat(2300)}！结尾`
  const result = splitSourceIntoEpisodes(source, 4)
  assert.equal(result.map(item => item.content).join(''), source)
  assert.equal(result.reduce((sum, item) => sum + item.character_count, 0), source.length)
})

test('oversized source is rejected explicitly instead of being silently truncated', () => {
  assert.throws(
    () => extractReadableText('字'.repeat(200_001), 'text/plain'),
    /超过20万字.*未保存任何截断内容/,
  )
})

test('drama routes expose safe link import, AI episode planning and controlled draft sync', () => {
  const route = read('src/routes/dramas.ts')
  const importer = read('src/services/source-import.ts')
  const agents = read('src/agents/index.ts')

  assert.match(route, /app\.post\('\/import-source'/)
  assert.match(route, /app\.post\('\/:id\/analyze-episodes'/)
  assert.match(route, /app\.get\('\/:id\/episode-plan'/)
  assert.match(route, /app\.put\('\/:id\/episode-plan'/)
  assert.match(route, /app\.post\('\/:id\/episodes\/from-plan'/)
  assert.match(route, /generated_episode_ids/)
  assert.match(route, /VERSION_CONFLICT/)
  assert.match(route, /FOR UPDATE/)
  assert.match(route, /sourceHash\(drama\.description\)/)
  assert.match(route, /已经进入剧本、分镜或制作阶段/)
  assert.match(route, /getActiveConfigId\('image'\)/)
  assert.match(route, /review_notes/)
  assert.match(route, /请先综合所有意见，再重新判断集数和分集边界/)
  assert.match(importer, /不能读取本机或局域网链接/)
  assert.match(importer, /MAX_SOURCE_BYTES/)
  assert.match(importer, /requestPinnedPage/)
  assert.match(agents, /episode_planner/)
})
