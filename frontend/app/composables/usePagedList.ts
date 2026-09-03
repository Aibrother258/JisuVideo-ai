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
 * - `reload()` 重置并拉取第 1 页（整载：替换 items，loading 置真）；
 * - `loadMore()` 追加拉取下一页（loadingMore 置真），`hasMore` 为假或
 *   已有整载/追加在途时忽略；
 * - `reset()` 清空状态回未加载态；
 * - 后端未返回 pagination（如整表接口）时视为「一次取全」，首页加载后
 *   hasMore 恒为 false，调用方无需特殊分支。
 *
 * 接入边界：分页主列表可直接消费；若页面另有「依赖全量数据」的统计侧栏，
 * 需先裁决数据流（沿用全量接口或改聚合口径）后再接入，hook 本体不承担该决策。
 */

/** 每次请求拼出的查询参数：page/page_size 由 hook 计算，fixed 固定参数随附 */
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
  /** 每次请求固定携带的查询参数（如 status/keyword/type 过滤），调用方改动后需自行 reset+reload */
  fixed?: Record<string, string | number | boolean | null | undefined>
}

export interface UsePagedListReturn<T> {
  /** 已累积的项目列表（reload 替换、loadMore 追加） */
  items: Ref<T[]>
  /** 整载/重载中（首屏与 reload） */
  loading: Ref<boolean>
  /** loadMore 追加中 */
  loadingMore: Ref<boolean>
  /** 最近一次请求的错误文案；成功请求后清空 */
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
  /** 重置并拉取第 1 页（整载） */
  reload: () => Promise<void>
  /** 追加拉取下一页 */
  loadMore: () => Promise<void>
  /** 清空回未加载态（不发起请求） */
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

  const hasMore = computed(() => ready.value && totalPages.value > page.value)

  function buildQuery(p: number): PagedFetchQuery {
    return { page: p, page_size: pageSize, ...fixed }
  }

  function applyMeta(res: PagedResponse<T>) {
    const meta = res.pagination
    total.value = meta?.total ?? 0
    totalPages.value = meta?.total_pages ?? (meta?.total ? Math.ceil(meta.total / pageSize) : 0)
  }

  async function fetchPage(p: number, append: boolean) {
    try {
      const res = await fetcher(buildQuery(p))
      const incoming = res.items || []
      items.value = append ? [...items.value, ...incoming] : incoming
      applyMeta(res)
      page.value = p
      ready.value = true
      loadError.value = ''
    } catch (err: any) {
      loadError.value = err?.message || '加载失败'
      console.error(`[usePagedList] page ${p} load failed`, err)
    }
  }

  async function reload() {
    if (loading.value) return
    loading.value = true
    loadError.value = ''
    try {
      await fetchPage(1, false)
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (loading.value || loadingMore.value) return
    if (!hasMore.value) return
    loadingMore.value = true
    try {
      await fetchPage(page.value + 1, true)
    } finally {
      loadingMore.value = false
    }
  }

  function reset() {
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
