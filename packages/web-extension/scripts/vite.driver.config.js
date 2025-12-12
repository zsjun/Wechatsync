import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, '../src/drivers/driver.js'),
      name: 'modules',
      fileName: () => 'driverCodePack.temp.js',
      formats: ['umd']
    },
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      output: {
        extend: true
      }
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.WECHAT_ENV': '"production"'
  }
})
