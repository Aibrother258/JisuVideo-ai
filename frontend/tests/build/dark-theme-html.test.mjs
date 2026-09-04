/**
 * C4 P1-1 build integration test (run via `npm run test:build`; enforced by CI).
 *
 * Does NOT trust a stale .output or source-text regexes:
 *   1. always generates a fresh production build from current sources;
 *   2. boots the built nitro server with NITRO_PORT=0 — the OS assigns a free
 *      port, so a foreign service squatting on a fixed port can never be
 *      mistaken for our server;
 *   3. parses the server's own "Listening on http://127.0.0.1:<port>" line and
 *      only ever probes THAT url — the probe is tied to the process we spawned;
 *   4. a spawn error or an early exit BEFORE the server becomes ready rejects
 *      the wait (the test fails instead of silently probing a stale service);
 *   5. after the run the child is killed and its exit awaited — no orphan
 *      processes or port reuse between runs.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const frontend = fileURLToPath(new URL('../..', import.meta.url)) // tests/build → frontend/
const BOOTSTRAP = "setAttribute('data-theme',d?'dark':'light')"
const READY_TIMEOUT_MS = 120_000
const LISTENING_RE = /Listening on (https?:\/\/[^\s]+)/
const SERVER_ENTRY = '.output/server/index.mjs'

function runBuild() {
  const res = spawnSync('npm', ['run', 'build'], {
    cwd: frontend,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })
  assert.equal(res.status, 0, `npm run build failed (exit ${res.status})`)
}

let server
let baseUrl
let stderrTail = ''
let stdoutBuf = ''

/** Resolves with the server's real base URL, rejects on any startup failure. */
function waitForListening() {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error(
          `nitro did not print a listening address within ${READY_TIMEOUT_MS}ms; ` +
          `stdout tail: ${stdoutBuf.slice(-400)}; stderr tail: ${stderrTail.slice(-400)}`))
      }
    }, READY_TIMEOUT_MS)

    const fail = (message) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(new Error(`${message}; stderr tail: ${stderrTail.slice(-400)}`))
      }
    }

    server.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString()
      const m = LISTENING_RE.exec(stdoutBuf)
      if (m && !settled) {
        settled = true
        clearTimeout(timer)
        resolve(m[1])
      }
    })
    // A spawn failure or an exit before "Listening on ..." means our server is
    // NOT the thing a probe would hit — the test must abort, never pass.
    server.on('error', (err) => fail(`nitro failed to spawn: ${err.message}`))
    server.once('exit', (code, signal) => fail(
      `nitro exited before becoming ready (code=${code}, signal=${signal})`))
  })
}

before(async () => {
  runBuild() // fresh production build from current sources — stale artifacts can never fake the check
  server = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: frontend,
    env: { ...process.env, NITRO_PORT: '0', NITRO_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stderr.on('data', (chunk) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-2000)
  })
  baseUrl = await waitForListening()
})

after(async () => {
  if (!server) return
  // Ensure the child has fully exited so no orphan process / port lingers.
  if (server.exitCode === null && server.signalCode === null) {
    const exited = new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve() // last-resort guard: never hang the suite on a stuck child
      }, 5000)
      server.once('exit', () => {
        clearTimeout(timer) // normal path: do not keep the process alive for the fallback window
        resolve()
      })
    })
    server.kill()
    await exited
  }
  if (server.stdout) server.stdout.destroy()
  if (server.stderr) server.stderr.destroy()
})

test('C4 P1-1: served SPA html embeds the theme bootstrap before stylesheet and module entry', async () => {
  const res = await fetch(`${baseUrl}/`)
  assert.ok(res.ok, `expected HTTP 200 from ${baseUrl}, got ${res.status}`)
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
