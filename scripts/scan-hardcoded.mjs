import fs from 'node:fs'
import path from 'node:path'

const roots = ['frontend/app', 'frontend/layouts', 'frontend/components', 'frontend/pages']
const root = 'f:/JisuVideo/JisuVideo-ai'
const files = []
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) {
      if (!['node_modules', '.nuxt', '.output'].includes(name)) walk(p)
    } else if (/\.(vue|css)$/.test(name)) files.push(p)
  }
}
walk(root + '/' + roots[0])

const colorRe = /rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g
const fontRe = /font(?:-size)?\s*:\s*[\d.]+px/g
const pxRe = /\b\d+(?:\.\d+)?px\b/g

const stats = files.map(f => {
  const src = fs.readFileSync(f, 'utf8')
  const rel = path.relative(root, f)
  const colors = src.match(colorRe) || []
  const fonts = src.match(fontRe) || []
  // 排除 var() 与 token 定义
  const px = (src.match(pxRe) || []).length
  return { rel, colors: colors.length, fonts: fonts.length, px, sizeKB: Math.round(src.length / 1024) }
}).sort((a, b) => b.colors - a.colors)

console.log('=== 硬编码颜色 / 字号 / px 统计（按颜色数降序） ===')
for (const s of stats) console.log(`${s.rel}  KB=${s.sizeKB}  colors=${s.colors}  fontPx=${s.fonts}  totalPx=${s.px}`)

// 颜色频次 top
const colorCount = new Map()
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(colorRe)) colorCount.set(m[0], (colorCount.get(m[0]) || 0) + 1)
}
console.log('\n=== 出现 ≥3 次的硬编码颜色 ===')
for (const [c, n] of [...colorCount.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])) console.log(`${n.toString().padStart(3)}  ${c}`)
