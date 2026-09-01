export function isServerPlanGenerated({ dirty, currentFingerprint, generatedFingerprint, actualEpisodeCount, plannedEpisodeCount }) {
  return !dirty
    && Boolean(currentFingerprint)
    && currentFingerprint === generatedFingerprint
    && Number(actualEpisodeCount) === Number(plannedEpisodeCount)
}
