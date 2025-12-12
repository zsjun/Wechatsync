import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/driver.js'),
      name: 'modules',
      fileName: 'code',
      formats: ['umd']
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ['jsdom', 'axios'],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          jsdom: 'jsdom',
          axios: 'axios'
        },
        extend: true
      }
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.WECHAT_ENV': '"production"'
  }
})
