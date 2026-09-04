import { fileURLToPath } from 'node:url'
import { themeBootstrapScript } from './app/utils/theme-core.mjs'

const devProxyTarget = process.env.HUOBAO_BACKEND_URL || 'http://localhost:5679'

export default defineNuxtConfig({
  srcDir: 'app/',
  ssr: false,
  devtools: { enabled: false },
  experimental: {
    appManifest: false,
  },
  hooks: {
    // 动态路由页面统一放在 app/views/ 手动注册，避免文件路径中出现 [id] 方括号
    // （方括号路径在 git/shell 中需转义，且部分部署环境不兼容）。URL 保持不变。
    'pages:extend'(pages) {
      pages.push(
        {
          name: 'drama-detail',
          path: '/drama/:id',
          file: fileURLToPath(new URL('./app/views/drama/detail.vue', import.meta.url)),
        },
        {
          name: 'drama-episode',
          path: '/drama/:id/episode/:episodeNumber',
          file: fileURLToPath(new URL('./app/views/drama/episode.vue', import.meta.url)),
        },
      )
    },
  },
  app: {
    head: {
      title: '火宝短剧',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'shortcut icon', type: 'image/png', href: '/favicon.png' },
      ],
      // C4 暗色主题：首帧防闪 bootstrap 经 app.head 内联进 SPA HTML 的 <head>，
      // 确保位于样式表与入口脚本之前执行（SSR:false 下 useHead 注入发生在客户端启动后，会闪白）。
      // 脚本源码见 app/utils/theme-core.mjs；运行时跟随/手动覆盖在 app/plugins/theme.client.ts。
      script: [{ innerHTML: themeBootstrapScript }],
    },
  },
  vite: {
    server: {
      proxy: {
        '/api': { target: devProxyTarget, changeOrigin: true },
        '/static': { target: devProxyTarget, changeOrigin: true },
      },
    },
  },
  compatibilityDate: '2025-05-15',
})
