import fs from 'node:fs'
import path from 'node:path'

const root = 'f:/JisuVideo/JisuVideo-ai/frontend/app'
const files = []
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) {
      if (!['node_modules', '.nuxt', '.output'].includes(name)) walk(p)
    } else if (/\.(vue|css)$/.test(name)) files.push(p)
  }
}
walk(root)

const fontVals = new Map() // 字号 -> 次数
const colorVals = new Map()
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  // 只统计 <style> 块内
  const styleBlocks = [...src.matchAll(/<style[\s\S]*?<\/style>/g)].map(m => m[0])
  for (const css of styleBlocks) {
    for (const m of css.matchAll(/font(?:-size)?\s*:\s*([\d.]+)px/g)) {
      const v = m[1]
      fontVals.set(v, (fontVals.get(v) || 0) + 1)
    }
    for (const m of css.matchAll(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g)) {
      colorVals.set(m[0], (colorVals.get(m[0]) || 0) + 1)
    }
  }
}
console.log('=== style 块字号分布（px → 次数） ===')
for (const [v, n] of [...fontVals.entries()].sort((a, b) => a[0] - b[0])) console.log(`${v}px: ${n}`)
console.log('\n=== style 块颜色 Top 25 ===')
for (const [c, n] of [...colorVals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${n.toString().padStart(4)}  ${c}`)
