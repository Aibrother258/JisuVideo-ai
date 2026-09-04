import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/**
 * 挂载级交互测试配置（C4 第三批评审 P2-2）。
 *
 * 仅服务 tests/ui 下的 .test.ts（与 node:test 的 tests/*.test.mjs 互不干扰）：
 * 真实编译 .vue 组件 + happy-dom DOM，验证「设置页外观面板三态切换」的
 * Vue 响应式接线真实可用——不只是源文件正则存在。
 * 运行方式：`npm run test:ui`（CI 强制执行）。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/ui/**/*.test.ts'],
  },
})
