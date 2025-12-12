# package.json 依赖分析报告 (2025 年更新)

## 📊 依赖分类分析

### 1. 需要移除的依赖（Webpack 相关 → 迁移到 Vite）

这些依赖在迁移到 Vite 后不再需要：

- ❌ `webpack` (^5.25.0) → 移除，使用 Vite
- ❌ `webpack-cli` (^4.5.0) → 移除
- ❌ `webpack-dev-server` (^3.11.2) → 移除，Vite 内置 dev server
- ❌ `webpack-node-externals` (^2.5.2) → 移除
- ❌ `babel-loader` (^8.2.2) → 移除，Vite 内置支持
- ❌ `css-loader` (^5.1.2) → 移除，Vite 内置支持
- ❌ `sass-loader` (^11.0.1) → 移除，Vite 内置支持
- ❌ `style-loader` (^2.0.0) → 移除，Vite 内置支持
- ❌ `mini-css-extract-plugin` (^1.3.9) → 移除，Vite 内置支持
- ❌ `copy-webpack-plugin` (^8.0.0) → 移除，Vite 使用 vite-plugin-static-copy 或原生支持
- ❌ `html-webpack-plugin` (^5.3.1) → 移除，Vite 内置支持
- ❌ `terser-webpack-plugin` (^5.1.1) → 移除，Vite 使用 esbuild/terser
- ❌ `ignore-emit-webpack-plugin` (^2.0.6) → 移除
- ❌ `zip-webpack-plugin` (^4.0.1) → 移除，使用 vite-plugin-zip 或单独脚本
- ❌ `dotenv-webpack` (^7.0.1) → 移除，Vite 内置支持
- ❌ `vue-loader` (^15.9.6) → 移除，Vue 2 专用
- ❌ `vue-template-compiler` (^2.6.12) → 移除，Vue 2 专用
- ❌ `vue-markdown-loader` (^2.4.1) → 移除，需要找 Vite 替代方案

### 2. 需要更新的依赖（保持但升级版本）

- ✅ `@babel/core` (^7.13.10) → ^7.24.0 (Vite 内置支持，但某些场景可能还需要)
- ✅ `@babel/plugin-proposal-class-properties` (^7.13.0) → ^7.24.0 (已合并到 preset-env，但保留以防万一)
- ✅ `@babel/plugin-proposal-private-methods` (^7.13.0) → ^7.24.0 (已合并到 preset-env)
- ✅ `@babel/plugin-transform-runtime` (^7.13.10) → ^7.24.0
- ✅ `@babel/preset-env` (^7.13.10) → ^7.24.0
- ✅ `@babel/runtime` (^7.13.10) → ^7.24.0
- ✅ `@commitlint/cli` (^12.0.1) → ^19.0.0
- ✅ `@commitlint/config-conventional` (^12.0.1) → ^19.0.0
- ✅ `@commitlint/config-lerna-scopes` (^12.0.1) → ^19.0.0
- ✅ `commitizen` (^4.2.3) → ^4.3.0
- ✅ `conventional-commit-types` (^3.0.0) → ^3.0.0 (已是最新)
- ✅ `cz-customizable` (^6.3.0) → ^7.0.0
- ✅ `cross-env` (^7.0.2) → ^7.0.3
- ✅ `husky` (^5.1.3) → ^9.0.0 (重大版本升级，需要更新配置)
- ✅ `jsdom` (^11.12.0) → ^24.0.0 (重大版本升级)
- ✅ `jsdom-global` (^3.0.2) → ^3.0.2 (检查是否有更新)
- ✅ `sass` (^1.32.8) → ^1.80.0

### 3. 需要添加的依赖（Vite 生态）

- ➕ `vite` → ^6.0.0 (最新稳定版)
- ➕ `@vitejs/plugin-vue` → ^5.0.0 (Vue 3 支持)
- ➕ `@crxjs/vite-plugin` → ^2.0.0 (Chrome 扩展开发)
- ➕ `vite-plugin-static-copy` → ^1.0.0 (替代 copy-webpack-plugin，如需要)
- ➕ `vite-plugin-zip` → ^1.0.0 (替代 zip-webpack-plugin，如需要)

## 🎯 更新策略

### 策略 A：激进迁移（推荐，但需要同时更新所有包）

- 立即移除所有 Webpack 依赖
- 添加 Vite 依赖
- 更新所有可更新的依赖

### 策略 B：渐进式迁移（当前采用）

- 保留 Babel 相关依赖（某些包可能暂时还需要）
- 添加 Vite 依赖（准备迁移）
- 更新工具类依赖（husky, commitlint 等）
- Webpack 依赖暂时保留，等迁移完成后再移除

## ⚠️ 注意事项

1. **husky 9.x** 需要更新配置方式（从 `.husky/` 目录改为新的配置格式）
2. **jsdom 24.x** 可能有 breaking changes，需要测试
3. **commitlint 19.x** 需要检查配置兼容性
4. **Vue 2 → Vue 3** 迁移需要单独处理（在子包中）
