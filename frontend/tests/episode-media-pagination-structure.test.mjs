import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('C3/P4 batch: assetLibraryAPI.list and taskAPI.list accept page/page_size and return { items, pagination }', () => {
  const api = read('app/composables/useApi.ts')
  // 素材库列表：分页参数透传 + PagedResponse 返回结构（snake_case，与原全量数组元素一致）
  assert.match(api, /list: \(params\?: \{ drama_id\?: number; episode_id\?: number; type\?: 'image' \| 'video' \| 'audio'; page\?: number; page_size\?: number \}\) => \{/)
  assert.match(api, /if \(params\?\.page\) query\.set\('page', String\(params\.page\)\)/)
  assert.match(api, /if \(params\?\.page_size\) query\.set\('page_size', String\(params\.page_size\)\)/)
  assert.match(api, /GET \/assets：items 字段为 snake_case/)
  assert.match(api, /api\.get<\{ items: any\[\]; pagination\?: \{ page: number; page_size: number; total: number; total_pages: number \} \}>\(`\/assets/)
  // 任务列表：分页参数透传 + PagedResponse 返回结构（camelCase，与 GET /tasks/:id 一致）
  assert.match(api, /list: \(params\?: \{ type\?: 'image' \| 'video'; drama_id\?: number; storyboard_id\?: number; page\?: number; page_size\?: number \}\) => \{/)
  assert.match(api, /GET \/tasks：items 字段为 camelCase/)
  assert.match(api, /api\.get<\{ items: any\[\]; pagination\?: \{ page: number; page_size: number; total: number; total_pages: number \} \}>\(`\/tasks/)
})

test('C3/P4 batch: episode ref-asset picker loads the library via usePagedList (reload first page + load more)', () => {
  const ep = read('app/views/drama/episode.vue')
  // hook 显式引入（组件自包含 import 基线）
  assert.match(ep, /import \{ usePagedList \} from '~\/composables\/usePagedList'/)
  // 素材库 items/loading/loadError 由 usePagedList 统一管理，hasMore/loadMore/reset 一并解构
  assert.match(ep, /items: mediaLibraryAssets/)
  assert.match(ep, /loading: refAssetPickerLoading/)
  assert.match(ep, /loadError: refAssetLibraryError/)
  assert.match(ep, /hasMore: refAssetLibraryHasMore/)
  assert.match(ep, /loadingMore: refAssetLibraryLoadingMore/)
  assert.match(ep, /loadMore: loadMoreRefAssets/)
  assert.match(ep, /reload: reloadRefAssetLibrary/)
  assert.match(ep, /reset: resetRefAssetLibrary/)
  // fetcher 携带当前短剧/集过滤，hook 负责 page/page_size
  assert.match(ep, /usePagedList\(/)
  assert.match(ep, /assetLibraryAPI\.list\(\{ drama_id: dramaId, episode_id: epId\.value, \.\.\.q \}\)/)
  assert.match(ep, /\{ pageSize: 60 \}/)
})

test('C3/P4 batch: picker reset + reload on open, reload after upload, and a load-more control at grid tail', () => {
  const ep = read('app/views/drama/episode.vue')
  // 每次打开从第 1 页重载：作废上次分页累积与在途请求
  assert.match(ep, /async function openRefAssetPicker\(kind\) \{/)
  assert.match(ep, /resetRefAssetLibrary\(\)/)
  assert.match(ep, /await reloadRefAssetLibrary\(\)/)
  // 本地上传成功后刷新素材库（新素材 createdAt 最新，落在第 1 页顶部）
  assert.match(ep, /await reloadRefAssetLibrary\(\)/)
  // 网格尾部「加载更多素材」按钮：hasMore 才渲染，busy 时禁用并显示加载中
  assert.match(ep, /v-if="refAssetLibraryHasMore" class="ref-asset-picker-more"/)
  assert.match(ep, /@click="loadMoreRefAssets"/)
  assert.match(ep, /'加载更多素材'/)
  assert.match(ep, /refAssetLibraryLoadingMore \? '加载中…' : '加载更多素材'/)
  // 加载失败内联错误 + 重试仍指向整载
  assert.match(ep, /@click="reloadRefAssetLibrary"/)
  // 加载更多按钮占满网格整行，不破坏卡片栅格
  assert.match(ep, /\.ref-asset-picker-more \{ grid-column: 1 \/ -1;/)
})

test('C3/P4 batch: storyboard video history consumes { items } from paged task list', () => {
  const ep = read('app/views/drama/episode.vue')
  // GET /tasks 返回 { items, pagination }；单分镜历史量级小，一次取足 page_size=100 保持全量语义
  assert.match(ep, /taskAPI\.list\(\{ type: 'video', storyboard_id: selectedSb\.value\.id, page: 1, page_size: 100 \}\)/)
  assert.match(ep, /sbVideoHistory\.value = \(res\?\.items \|\| \[\]\)/)
})
