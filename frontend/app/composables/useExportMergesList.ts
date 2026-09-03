// useExportMergesList.ts —— EpisodeExportPanel 成片列表加载三态（P1/P2 复审修复，PR #45）
//
// 背景：成片列表存在三路并发读取——面板挂载 initial、主壳 listRev 静默刷新、手动点「刷新」。
// 旧实现直接 await 后写状态，没有取消/序列号/有效性校验；只要网络返回顺序反转：
//   - 后发请求已拿到最新成片，先发请求随后返回旧列表覆盖它（新成片“消失”）；
//   - 旧的 initial 请求在新请求成功后失败，会把 exportListError 错误横幅写回；
//   - 旧 initial 的 finally 会关闭较新 initial 请求仍在进行的 loading。
// 复审再补两处缺口（P1/P2）：
//   - 后发 silent 请求一旦失败，会作废仍在途 initial 的有效结果——最终误显示“暂无成片”；
//   - episodeId 校验实为函数参数与其副本自比（恒假），读不到组件“当前”剧集 id，
//     无法覆盖“剧集已切换但第二次请求未发出 / episodeId 置 0”的迟到响应。
// 修复：分开维护「最新发起序号 issued」与「最新成功提交序号 committed」——
//   - 只有更晚的成功提交才淘汰较早成功（最新成功获胜）；失败的 silent 不淘汰在途 initial，
//     其成功照常落盘，且不提前关闭其 loading；
//   - episodeId 改为 getter 传入，响应回来时比对“当前”剧集，剧集切换/置 0 一律作废；
//   - loading 只由成功提交或「仍是最新 initial 的决定者」失败收尾。
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

export function useExportMergesList(
  fetchMerges: FetchExportMerges,
  getEpisodeId: () => number, // 读取组件“当前”episodeId（props 变化即可校验，避免恒假比较）
) {
  const exportMerges = ref<ExportMergeRecord[]>([])
  const exportListLoading = ref(false)
  const exportListError = ref('')

  // 组件仍挂载才允许写状态（卸载后迟到的响应直接丢弃）
  let active = true
  // 最新发起序号：每次读取自增并捕获；用于判断「是否已被更新的成功提交超越」
  let issued = 0
  // 最新成功提交序号：只有更晚的成功结果才淘汰较早成功（最新成功获胜）
  let committed = 0
  // 最近一个 initial 的序号：loading/错误只由「仍是最新 initial 的决定者」收尾，
  // 失败的 silent 不接管、不淘汰在途 initial，也不得提前关闭其 loading
  let lastInitialSeq = 0

  function setActive(v: boolean) {
    active = v
  }

  async function loadExportMerges(episodeId: number, initial = false): Promise<void> {
    const ep = episodeId
    if (!ep) return
    const seq = ++issued
    // initial 是 UI 三态决定者：乐观清错 + 置 loading；静默刷新不打扰现有列表与 loading
    if (initial) { lastInitialSeq = seq; exportListLoading.value = true; exportListError.value = '' }
    try {
      const list = (await fetchMerges(ep)) || []
      if (!active) return
      // 剧集已切换（含切到 0）：本响应已不属于当前剧集，作废；
      // 若自己是被剧集切换抛弃的「最新 initial」且无接管者，回收 loading 防骨架悬挂
      if (ep !== getEpisodeId()) {
        if (initial && seq === lastInitialSeq) exportListLoading.value = false
        return
      }
      // 已被更新的成功提交超越：保持最新列表，旧成功不再落盘
      if (seq < committed) return
      exportMerges.value = list
      committed = seq
      // 列表成功刷新后清除过时加载错误横幅（对齐迁移前 doMerge 完成调 loadExportMerges(true) 的语义）
      if (exportListError.value) exportListError.value = ''
      // 成功提交即 UI 已有决定，收尾 loading（含被 silent 刷新超越而提前落定的 initial）
      exportListLoading.value = false
    } catch (e) {
      if (!active) return
      if (ep !== getEpisodeId()) {
        if (initial && seq === lastInitialSeq) exportListLoading.value = false
        return
      }
      if (seq < committed) return
      // 初始加载失败 -> 内联错误 + 重试；后台刷新失败保持旧列表不打扰。
      // 错误只在「仍是最新 initial 决定者」时写入：更晚 initial 已接管时由其落定呈现
      if (initial && seq === lastInitialSeq) {
        exportListError.value = (e instanceof Error ? e.message : String(e)) || '成片列表加载失败'
        exportListLoading.value = false
      }
    }
  }

  return { exportMerges, exportListLoading, exportListError, loadExportMerges, setActive }
}
