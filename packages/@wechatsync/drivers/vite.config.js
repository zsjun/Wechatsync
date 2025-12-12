import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'index.js'),
      name: 'WechatSyncDrivers',
      fileName: 'index'
    },
    rollupOptions: {
      external: ['axios', 'js-md5', 'juice', 'remarkable', 'turndown', 'vue'],
      output: {
        globals: {
          axios: 'axios',
          'js-md5': 'md5',
          juice: 'juice',
          remarkable: 'Remarkable',
          turndown: 'TurndownService',
          vue: 'Vue'
        }
      }
    }
  }
})
