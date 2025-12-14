import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  // IMPORTANT:
  // We rely on adapter class/function `.name` in `@wechatsync/drivers/index.js` to build the driver map.
  // If esbuild minifies names, code like `drivers[module.default.name] = module.default` will break,
  // causing runtime errors like "rn is not a constructor" when `SegmentfaultAdapter` becomes undefined.
  esbuild: {
    keepNames: true,
  },
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
      // Fix for PouchDB in Vite (ESM build issues)
      pouchdb: path.resolve(__dirname, 'src/pouchdb-shim.js'),
      'pouchdb-find': path.resolve(
        __dirname,
        'node_modules/pouchdb/dist/pouchdb.find.js'
      ),
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
    // Service worker environment has no document; disable modulepreload polyfill injection.
    modulePreload: false,
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
        // MV3 Service Worker has no `window`/`DOMParser`. Some bundled deps (e.g. turndown)
        // fall back to Node-only `require("jsdom")` when DOMParser is missing, causing:
        // "Uncaught ReferenceError: require is not defined".
        //
        // Inject a small banner into *every chunk* so the check passes before module init runs.
        banner: `;(() => {
  try {
    if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
    if (typeof globalThis.DOMParser === 'undefined') {
      globalThis.DOMParser = class DOMParser {
        parseFromString() { return {}; }
      };
    }
    // MV3: provide a global modifyRequestHeaders for legacy drivers.
    // Implemented via declarativeNetRequest dynamic rules (no blocking webRequest in MV3).
    if (typeof globalThis.modifyRequestHeaders === 'undefined') {
      const stableRuleId = (input) => {
        let h = 2166136261;
        for (let i = 0; i < input.length; i++) {
          h ^= input.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        return (h >>> 0) % 2147483646 + 1;
      };
      globalThis.modifyRequestHeaders = (urlPrefix, headers) => {
        try {
          const dnr = globalThis.chrome && globalThis.chrome.declarativeNetRequest;
          if (!dnr || !dnr.updateDynamicRules) return;
          const keys = headers ? Object.keys(headers).sort() : [];
          const ruleId = stableRuleId('hdr:' + urlPrefix + ':' + keys.join(','));
          const requestHeaders = keys.map((k) => ({ header: k, operation: 'set', value: String(headers[k]) }));
          const rule = {
            id: ruleId,
            priority: 1,
            action: { type: 'modifyHeaders', requestHeaders },
            condition: { urlFilter: urlPrefix, resourceTypes: ['xmlhttprequest'] },
          };
          dnr.updateDynamicRules({ removeRuleIds: [ruleId], addRules: [rule] }, () => {});
        } catch (e) {}
      };
    }
  } catch (e) {}
})();\n`,
      },
    },
  },
})
