import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/_AMapService': {
        target: 'https://earthlifeonlie.cn',
        changeOrigin: true,
      },
      '/api': {
        target: 'https://earthlifeonlie.cn',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'https://earthlifeonlie.cn',
        changeOrigin: true,
      },
    },
  },
})
