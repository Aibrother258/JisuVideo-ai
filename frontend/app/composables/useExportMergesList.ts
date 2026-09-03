// useExportMergesList.ts —— EpisodeExportPanel 成片列表加载三态（P1 评审修复，PR #45）
//
// 背景：成片列表存在三路并发读取——面板挂载 initial、主壳 listRev 静默刷新、手动点「刷新」。
// 旧实现直接 await 后写状态，没有取消/序列号/有效性校验；只要网络返回顺序反转：
//   - 后发请求已拿到最新成片，先发请求随后返回旧列表覆盖它（新成片“消失”）；
//   - 旧的 initial 请求在新请求成功后失败，会把 exportListError 错误横幅写回；
//   - 旧 initial 的 finally 会关闭较新 initial 请求仍在进行的 loading。
// 本 composable 以“最新请求获胜”修复：每次读取递增 request revision，并捕获当次
// episodeId；仅当 revision 仍最新、组件仍挂载（active）且 episodeId 未变化时，才允许
// 写 exportMerges / exportListError / loading；旧请求的 finally 不得关闭较新请求的 loading。
import { ref } from 'vue'

export interface ExportMergeRecord {
  id: number | string
  status?: string
  merged_url?: string
  created_at?: string
  duration?: number | string
  error_msg?: string
  [k: string]: unknown
}

export type FetchExportMerges = (episodeId: number) => Promise<ExportMergeRecord[] | null>

export function useExportMergesList(fetchMerges: FetchExportMerges) {
  const exportMerges = ref<ExportMergeRecord[]>([])
  const exportListLoading = ref(false)
  const exportListError = ref('')

  // 组件仍挂载才允许写状态（卸载后迟到的响应直接丢弃）
  let active = true
  // 最新请求序号：发起时自增并捕获；响应回来时非最新即过期，丢弃（最新请求获胜）
  let reqSeq = 0

  function setActive(v: boolean) {
    active = v
  }

  async function loadExportMerges(episodeId: number, initial = false): Promise<void> {
    if (!episodeId) return
    const seq = ++reqSeq
    const ep = episodeId
    // 新 initial 请求乐观清错 + 置 loading；静默刷新不打扰现有列表与 loading
    if (initial) { exportListLoading.value = true; exportListError.value = '' }
    try {
      const list = (await fetchMerges(ep)) || []
      if (!active || seq !== reqSeq || ep !== episodeId) return
      exportMerges.value = list
      // 列表成功刷新后清除过时加载错误横幅（对齐迁移前 doMerge 完成调 loadExportMerges(true) 的语义）
      if (exportListError.value) exportListError.value = ''
    } catch (e) {
      if (!active || seq !== reqSeq || ep !== episodeId) return
      // 初始加载失败 -> 内联错误 + 重试；后台刷新失败保持旧列表不打扰
      if (initial) exportListError.value = (e instanceof Error ? e.message : String(e)) || '成片列表加载失败'
    } finally {
      // 仅当自己仍是全局最新请求才收尾 loading：
      // ① 旧请求的 finally 不得关闭较新 initial 请求仍在进行的 loading（评审 P1 要求）；
      // ② 被静默刷新超越的旧 initial 也不再悬挂——由最新请求（含 silent）统一收尾，
      //    避免 initial 在途期间被 listRev 静默刷新取代后 loading 永远不关闭。
      if (seq === reqSeq && active) exportListLoading.value = false
    }
  }

  return { exportMerges, exportListLoading, exportListError, loadExportMerges, setActive }
}
