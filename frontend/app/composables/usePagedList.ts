import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

/**
 * usePagedList — 列表分页拉取 hook（P2-B3）
 *
 * 对齐后端 GET /dramas 契约：
 *   GET /dramas?page=1&page_size=20
 *   → { items, pagination: { page, page_size, total, total_pages } }
 *
 * 行为约定：
 * - `reload()` 拉取第 1 页整载（替换 items，loading 置真），可打断在途 loadMore；
 * - `loadMore()` 追加拉取下一页（loadingMore 置真），`hasMore` 为假或在途时忽略；
 * - `reset()` 清空状态回未加载态，并使所有在途请求立即过期失效；
 * - 请求采用递增序号（requestSeq）：后发请求（含 reload/reset）会让更早的在途
 *   响应过期，过期响应（无论成功或失败）一律丢弃，不写 items/meta/page/error，
 *   也不碰 flag——避免「第 2 页在途时 reload，旧第 2 页返回后追加污染新列表」；
 * - fixed 固定筛选先展开、page/page_size 后写入覆盖，固定筛选无法篡改分页参数；
 * - 后端未返回 pagination（如整表接口）时视为「一次取全」，首页加载后
 *   hasMore 恒为 false，调用方无需特殊分支。
 *
 * 接入边界：分页主列表可直接消费；若页面另有「依赖全量数据」的统计侧栏，
 * 需先裁决数据流（沿用全量接口或改聚合口径）后再接入，hook 本体不承担该决策。
 */

/** 每次请求拼出的查询参数：page/page_size 恒为 hook 计算的最终值（覆盖 fixed 同名键） */
export interface PagedFetchQuery {
  page: number
  page_size: number
  [extra: string]: string | number | boolean | null | undefined
}

export interface PagedPagination {
  page?: number
  page_size?: number
  total?: number
  total_pages?: number
}

export interface PagedResponse<T> {
  items: T[]
  pagination?: PagedPagination
}

/** 列表拉取函数：由调用方注入 API（如 dramaAPI.list），hook 负责页码推进 */
export type PagedFetcher<T> = (query: PagedFetchQuery) => Promise<PagedResponse<T>>

export interface UsePagedListOptions {
  /** 每页条数，默认 20（对齐后端 GET /dramas 默认 page_size） */
  pageSize?: number
  /** 每次请求固定携带的查询参数（如 status/keyword/type 过滤），调用方改动后需自行 reset+reload；同名 page/page_size 以 hook 计算为准 */
  fixed?: Record<string, string | number | boolean | null | undefined>
}

export interface UsePagedListReturn<T> {
  /** 已累积的项目列表（reload 替换、loadMore 追加） */
  items: Ref<T[]>
  /** 整载/重载中（首屏与 reload） */
  loading: Ref<boolean>
  /** loadMore 追加中 */
  loadingMore: Ref<boolean>
  /** 最近一次有效请求的错误文案；成功请求后清空 */
  loadError: Ref<string>
  /** 已加载的页码（1 起；未加载为 0） */
  page: Ref<number>
  pageSize: number
  /** 后端返回的总条数（无 pagination 时为 0） */
  total: Ref<number>
  /** 后端返回的总页数（无 pagination 时为 0） */
  totalPages: Ref<number>
  /** 是否还有下一页可加载（首载后由 total_pages 判定；无 pagination 恒 false） */
  hasMore: ComputedRef<boolean>
  /** 拉取第 1 页整载（可打断在途 loadMore） */
  reload: () => Promise<void>
  /** 追加拉取下一页 */
  loadMore: () => Promise<void>
  /** 清空回未加载态并作废在途请求（不发起请求） */
  reset: () => void
}

export function usePagedList<T>(fetcher: PagedFetcher<T>, options: UsePagedListOptions = {}): UsePagedListReturn<T> {
  const pageSize = options.pageSize ?? 20
  const fixed = options.fixed ?? {}
  const items = ref<T[]>([]) as Ref<T[]>
  const page = ref(0)
  const total = ref(0)
  const totalPages = ref(0)
  const loading = ref(false)
  const loadingMore = ref(false)
  const loadError = ref('')
  const ready = ref(false)
  // 请求代次：每次发起请求递增；reset 再递增以作废全部在途请求
  let requestSeq = 0

  const hasMore = computed(() => ready.value && totalPages.value > page.value)

  function buildQuery(p: number): PagedFetchQuery {
    // fixed 先展开、page/page_size 后写覆盖：固定筛选不能覆盖 hook 计算的页码/页大小
    return { ...fixed, page: p, page_size: pageSize }
  }

  function applyMeta(res: PagedResponse<T>) {
    const meta = res.pagination
    total.value = meta?.total ?? 0
    totalPages.value = meta?.total_pages ?? (meta?.total ? Math.ceil(meta.total / pageSize) : 0)
  }

  async function fetchPage(p: number, append: boolean, flag: Ref<boolean>) {
    const seq = ++requestSeq
    flag.value = true
    try {
      const res = await fetcher(buildQuery(p))
      if (seq !== requestSeq) return // 过期响应（期间已 reload/reset/更新请求）→ 丢弃
      const incoming = res.items || []
      items.value = append ? [...items.value, ...incoming] : incoming
      applyMeta(res)
      page.value = p
      ready.value = true
      loadError.value = ''
    } catch (err: any) {
      if (seq !== requestSeq) return // 过期失败同样丢弃，不覆盖新请求的错误态
      loadError.value = err?.message || '加载失败'
      console.error(`[usePagedList] page ${p} load failed`, err)
    } finally {
      // 仅当自己仍是最新请求时才复位 flag；过期请求的 flag 由接管方（reload/reset）复位
      if (seq === requestSeq) flag.value = false
    }
  }

  async function reload() {
    if (loading.value) return
    loadingMore.value = false // 接管在途 loadMore：其过期响应被丢弃，此处复位其 flag
    loadError.value = ''
    await fetchPage(1, false, loading)
  }

  async function loadMore() {
    if (loading.value || loadingMore.value) return
    if (!hasMore.value) return
    await fetchPage(page.value + 1, true, loadingMore)
  }

  function reset() {
    requestSeq++ // 使所有在途请求过期
    items.value = []
    page.value = 0
    total.value = 0
    totalPages.value = 0
    loading.value = false
    loadingMore.value = false
    loadError.value = ''
    ready.value = false
  }

  return { items, loading, loadingMore, loadError, page, pageSize, total, totalPages, hasMore, reload, loadMore, reset }
}
