import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isServerPlanGenerated } from '../app/utils/episode-plan-state.mjs'

test('generated state requires matching server fingerprints and episode counts', () => {
  const base = {
    dirty: false,
    currentFingerprint: 'server-current',
    generatedFingerprint: 'server-current',
    actualEpisodeCount: 4,
    plannedEpisodeCount: 4,
  }
  assert.equal(isServerPlanGenerated(base), true)
  assert.equal(isServerPlanGenerated({ ...base, dirty: true }), false)
  assert.equal(isServerPlanGenerated({ ...base, generatedFingerprint: 'old-local-cache' }), false)
  assert.equal(isServerPlanGenerated({ ...base, actualEpisodeCount: 3 }), false)
})
