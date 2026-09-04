/**
 * C4 P1-1 build integration test (run via `npm run test:build`).
 *
 * Does NOT trust a stale .output or source-text regexes:
 *   1. always generates a fresh production build from current sources;
 *   2. boots the built nitro server (the SPA html is server-rendered under ssr:false);
 *   3. requests the real html and asserts the theme bootstrap script sits in <head>
 *      BEFORE the stylesheet link and the module entry script.
 *
 * If the build/artifacts are unavailable the test fails loudly (build step above
 * makes artifacts; a build error propagates as a failed test) — never silently skips.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const frontend = fileURLToPath(new URL('../..', import.meta.url)) // tests/build → frontend/
const BOOTSTRAP = "setAttribute('data-theme',d?'dark':'light')"
const PORT = 4417

function runBuild() {
  const res = spawnSync('npm', ['run', 'build'], {
    cwd: frontend,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })
  assert.equal(res.status, 0, `npm run build failed (exit ${res.status})`)
}

async function waitForHttp(url, timeoutMs = 60000) {
  const start = Date.now()
  let lastErr
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`nitro server did not become ready: ${lastErr}`)
}

let server

before(async () => {
  runBuild() // fresh production build from current sources — stale artifacts can never fake the check
  server = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: frontend,
    env: { ...process.env, PORT: String(PORT), NITRO_PORT: String(PORT) },
    stdio: 'ignore',
  })
  await waitForHttp(`http://127.0.0.1:${PORT}/`)
})

after(() => {
  if (server && !server.killed) server.kill()
})

test('C4 P1-1: served SPA html embeds the theme bootstrap before stylesheet and module entry', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/`)
  const html = await res.text()

  const boot = html.indexOf(BOOTSTRAP)
  const stylesheet = html.indexOf('rel="stylesheet"')
  const entry = html.indexOf('type="module"')

  // anchors must exist — otherwise the ordering assertion below is vacuous and the test must not pass
  assert.ok(boot >= 0, 'theme bootstrap script must be embedded in the served SPA html')
  assert.ok(stylesheet > 0, 'stylesheet anchor missing — ordering assertion would be meaningless')
  assert.ok(entry > 0, 'module entry anchor missing — ordering assertion would be meaningless')

  assert.ok(boot < stylesheet,
    `theme bootstrap must execute before the stylesheet (bootstrap@${boot}, stylesheet@${stylesheet})`)
  assert.ok(boot < entry,
    `theme bootstrap must execute before the module entry (bootstrap@${boot}, entry@${entry})`)
})
