import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: '.',
        },
        {
          src: 'rules.json',
          dest: '.',
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      vue: 'vue/dist/vue.esm-bundler.js',
      '@wechatsync/drivers': path.resolve(__dirname, '../@wechatsync/drivers'),
      // Fix for entities deep import issues in juice/cheerio
      'entities/escape': path.resolve(
        __dirname,
        '../../node_modules/entities/lib/encode.js'
      ),
      'entities/encode': path.resolve(
        __dirname,
        '../../node_modules/entities/lib/encode.js'
      ),
      'entities/decode': path.resolve(
        __dirname,
        '../../node_modules/entities/lib/decode.js'
      ),
      'entities/lib/decode_codepoint.js': path.resolve(
        __dirname,
        '../../node_modules/entities/lib/decode_codepoint.js'
      ),
      'entities/lib/decode_codepoint': path.resolve(
        __dirname,
        '../../node_modules/entities/lib/decode_codepoint.js'
      ),
    },
    preserveSymlinks: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'src/index.html'),
        editor: path.resolve(__dirname, 'src/editor.html'),
        view: path.resolve(__dirname, 'src/view.html'),
        templates: path.resolve(__dirname, 'src/templates.html'),
        background: path.resolve(__dirname, 'src/background.js'),
        content: path.resolve(__dirname, 'src/content.js'),
        inject: path.resolve(__dirname, 'src/inject.js'),
        page: path.resolve(__dirname, 'src/page.js'),
        segmenftfault: path.resolve(__dirname, 'src/segmenftfault.js'),
        autoformat: path.resolve(__dirname, 'src/autoformat.js'),
        api: path.resolve(__dirname, 'src/api.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
