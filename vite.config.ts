import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    // 5173 被占用时自动递增使用 5174、5175……
    strictPort: false,
  },
  build: {
    target: 'chrome120',
    sourcemap: true,
    rollupOptions: {
      input: {
        devtools: resolve('devtools.html'),
        panel: resolve('panel.html'),
      },
    },
  },
})
