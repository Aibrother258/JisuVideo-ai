// useExportMergesList.ts —— EpisodeExportPanel 成片列表加载三态（P1/P2 三轮复审修复，PR #45）
//
// 背景：成片列表存在三路并发读取——面板挂载 initial、主壳 listRev 静默刷新、手动点「刷新」。
// 旧实现直接 await 后写状态，没有取消/序列号/有效性校验；只要网络返回顺序反转：
//   - 后发请求已拿到最新成片，先发请求随后返回旧列表覆盖它（新成片“消失”）；
//   - 旧的 initial 请求在新请求成功后失败，会把 exportListError 错误横幅写回；
//   - 旧 initial 的 finally 会关闭较新 initial 请求仍在进行的 loading。
// 复审修复（第 2 轮）：后发 silent 请求一旦失败，会作废仍在途 initial 的有效结果——
//   最终误显示“暂无成片”；episodeId 校验实为函数参数自比（恒假），读不到“当前”剧集 id。
// 复审修复（第 3 轮）：
//   - 成功分支此前只比较 committed（成功者），较新的 initial/手动刷新失败不构成“决定屏障”，
//     较早的成功响应仍会回写旧列表并清掉新错误——把最新 initial 也视为决策 epoch；
//   - 剧集切换只拦截迟到响应、不清理已提交的上一集列表（切集等待期误显示/误操作上一集成片）——
//     剧集变化先 resetForEpisode 清空三态并作废在途请求，再按新 id initial。
// 状态机语义：
//   - issued        最新发起序号（每次读取自增并捕获）；
//   - committed     最新成功提交序号：只有更晚的成功结果才淘汰较早成功（最新成功获胜）；
//   - lastInitialSeq 最新 initial 序号：更新的 initial 出现后即接管 UI 决策，
//                    早于它的成功/失败一律不得回写（成败屏障 = max(committed, lastInitialSeq)）。
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
  let issued = 0        // 最新发起序号
  let committed = 0     // 最新成功提交序号（只有更晚成功才淘汰较早成功）
  let lastInitialSeq = 0 // 最新 initial 序号（更新的 initial 即决策者，成败都不得被早于它者覆盖）

  function setActive(v: boolean) {
    active = v
  }

  // 剧集切换（组件 watch props.episodeId 时先调用）：作废在途请求并清空上一集已展示的数据。
  // 抬高 decision epoch（issued/committed/lastInitialSeq），即便旧响应绕过 episodeId 校验也无法
  // 回写；随后组件按新 id initial（id 有效）或保持空闲空态（id=0 不发请求）
  function resetForEpisode() {
    issued++
    committed = issued
    lastInitialSeq = issued
    exportMerges.value = []
    exportListError.value = ''
    exportListLoading.value = false
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
      // 决策屏障：早于「最新成功提交」或「最新 initial」的成功一律不得回写——
      // 更新的 initial/手动刷新失败后，旧成功不得落盘并清掉它刚呈现的错误
      if (seq < committed || seq < lastInitialSeq) return
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
      if (seq < committed || seq < lastInitialSeq) return
      // 初始加载失败 -> 内联错误 + 重试；后台刷新失败保持旧列表不打扰。
      // 错误只在「仍是最新 initial 的决定者」时写入：更晚 initial 已接管时由其落定呈现
      if (initial && seq === lastInitialSeq) {
        exportListError.value = (e instanceof Error ? e.message : String(e)) || '成片列表加载失败'
        exportListLoading.value = false
      }
    }
  }

  return { exportMerges, exportListLoading, exportListError, loadExportMerges, setActive, resetForEpisode }
}
