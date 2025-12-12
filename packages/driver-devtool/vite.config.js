import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { plugin as markdown } from 'vite-plugin-markdown'
import path from 'path'

export default defineConfig({
  plugins: [vue(), markdown({ mode: ['html', 'toc', 'vue'] })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@wechatsync/drivers': path.resolve(__dirname, '../@wechatsync/drivers'),
    },
  },
  server: {
    port: 8080,
  },
})
