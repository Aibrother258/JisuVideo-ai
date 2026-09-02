import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// 仓库根：frontend/tests -> repo root（scripts/ 位于仓库根）
const repoRoot = new URL('../../', import.meta.url)
const scriptsDir = new URL('scripts/', repoRoot)
const read = (p) => readFileSync(new URL(p, scriptsDir), 'utf8')

test('scan scripts derive repo root from their own path (portable, no machine paths)', () => {
  // 评审 P1：scan-tokens / scan-hardcoded 曾写死 f:/JisuVideo/JisuVideo-ai，其它检出目录下复现 ENOENT。
  // 必须改为从脚本自身位置（fileURLToPath(import.meta.url) + path.resolve/join）推导仓库根。
  for (const f of ['scan-tokens.mjs', 'scan-hardcoded.mjs']) {
    const src = read(f)
    assert.match(src, /fileURLToPath\(import\.meta\.url\)/, `${f} 应使用 import.meta.url 定位脚本`)
    assert.match(src, /path\.resolve\(/, `${f} 应基于脚本位置计算仓库根`)
    // 不允许再出现写死的本机盘符 / 绝对路径字面量
    assert.doesNotMatch(src, /['"`][A-Za-z]\s*:\s*[\\/]/i, `${f} 不应包含机器绝对路径`)
  }
})
