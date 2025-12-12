# 激进迁移策略 - 依赖更新总结

## ✅ 已完成的更改

### 1. 移除的 Webpack 相关依赖（共 15 个）

以下依赖已从 `package.json` 中移除，因为 Vite 内置支持或不再需要：

- ❌ `webpack` (^5.25.0)
- ❌ `webpack-cli` (^4.5.0)
- ❌ `webpack-dev-server` (^3.11.2)
- ❌ `webpack-node-externals` (^2.5.2)
- ❌ `babel-loader` (^8.2.2) - Vite 内置支持
- ❌ `css-loader` (^5.1.2) - Vite 内置支持
- ❌ `sass-loader` (^11.0.1) - Vite 内置支持
- ❌ `style-loader` (^2.0.0) - Vite 内置支持
- ❌ `mini-css-extract-plugin` (^1.3.9) - Vite 内置支持
- ❌ `copy-webpack-plugin` (^8.0.0) - 使用 `vite-plugin-static-copy` 替代
- ❌ `html-webpack-plugin` (^5.3.1) - Vite 内置支持
- ❌ `terser-webpack-plugin` (^5.1.1) - Vite 内置支持
- ❌ `ignore-emit-webpack-plugin` (^2.0.6)
- ❌ `zip-webpack-plugin` (^4.0.1) - 使用 `vite-plugin-zip` 替代
- ❌ `dotenv-webpack` (^7.0.1) - Vite 内置支持

### 2. 移除的 Vue 2 相关依赖（共 3 个）

- ❌ `vue-loader` (^15.9.6) - Vue 2 专用，Vue 3 使用 `@vitejs/plugin-vue`
- ❌ `vue-template-compiler` (^2.6.12) - Vue 2 专用，Vue 3 使用 `@vue/compiler-sfc`（由插件提供）
- ❌ `vue-markdown-loader` (^2.4.1) - 需要找 Vite 替代方案

### 3. 移除的 Babel 相关依赖（共 6 个）

Vite 使用 esbuild 进行转译，速度更快，现代浏览器已支持大部分 ES6+ 特性，不再需要 Babel：

- ❌ `@babel/core` (^7.24.0)
- ❌ `@babel/plugin-proposal-class-properties` (^7.24.0)
- ❌ `@babel/plugin-proposal-private-methods` (^7.24.0)
- ❌ `@babel/plugin-transform-runtime` (^7.24.0)
- ❌ `@babel/preset-env` (^7.24.0)
- ❌ `@babel/runtime` (^7.24.0)
- ❌ `babel.config.json` (配置文件已删除)

### 4. 保留的依赖（已更新到 2025 年版本）

#### 代码质量工具

- ✅ `@commitlint/cli`: ^12.0.1 → ^19.0.0
- ✅ `@commitlint/config-conventional`: ^12.0.1 → ^19.0.0
- ✅ `@commitlint/config-lerna-scopes`: ^12.0.1 → ^19.0.0
- ✅ `commitizen`: ^4.2.3 → ^4.3.0
- ✅ `cz-customizable`: ^6.3.0 → ^7.0.0
- ✅ `husky`: ^5.1.3 → ^9.0.0 ⚠️ **需要更新配置**

#### 测试工具

- ✅ `jsdom`: ^11.12.0 → ^24.0.0 ⚠️ **可能有 breaking changes**
- ✅ `jsdom-global`: ^3.0.2 (保持不变)

#### 样式处理

- ✅ `sass`: ^1.32.8 → ^1.80.0

#### 工具类

- ✅ `cross-env`: ^7.0.2 → ^7.0.3
- ✅ `conventional-commit-types`: ^3.0.0 (已是最新)

### 4. 新增的 Vite 相关依赖

- ➕ `vite`: ^6.0.0 - 核心构建工具
- ➕ `@vitejs/plugin-vue`: ^5.0.0 - Vue 3 单文件组件支持
- ➕ `@crxjs/vite-plugin`: ^2.0.0 - Chrome 扩展开发插件
- ➕ `vite-plugin-static-copy`: ^1.0.0 - 替代 copy-webpack-plugin
- ➕ `vite-plugin-zip`: ^1.0.0 - 替代 zip-webpack-plugin

## 📊 统计

- **移除依赖**: 24 个（18 个 Webpack/Vue2 + 6 个 Babel）
- **新增依赖**: 5 个
- **更新依赖**: 9 个
- **净减少**: 19 个依赖
- **删除配置文件**: 1 个（babel.config.json）

## ⚠️ 重要注意事项

### 1. Husky 9.x 配置更新

Husky 9.x 需要新的配置方式。运行以下命令初始化：

```bash
pnpm exec husky init
```

这将创建 `.husky/` 目录并更新配置。

### 2. JSDOM 24.x Breaking Changes

JSDOM 24.x 可能有 breaking changes，需要测试所有使用 jsdom 的测试用例。

### 3. Vue Markdown Loader 替代方案

`vue-markdown-loader` 已被移除，需要找到 Vite 兼容的替代方案：

- 选项 1: 使用 `vite-plugin-markdown` 或类似插件
- 选项 2: 在运行时使用 `marked` 或 `markdown-it` 解析
- 选项 3: 使用 `@vitejs/plugin-vue` 的 `customElement` 功能

### 4. 子包需要同步更新

所有使用 Webpack 的子包（`packages/*`）也需要迁移到 Vite：

- `packages/web-extension`
- `packages/@wechatsync/drivers`
- `packages/driver-devtool`
- `packages/markdown-editor`

## 🚀 下一步

1. **安装依赖**:

   ```bash
   pnpm install
   ```

2. **更新 Husky 配置**:

   ```bash
   pnpm exec husky init
   ```

3. **创建 Vite 配置文件**:

   - 为每个子包创建 `vite.config.js`
   - 配置 `@crxjs/vite-plugin` 用于 web-extension

4. **迁移子包**:

   - 按照 TODO 清单逐步迁移各个子包

5. **测试构建**:
   - 确保所有包都能正常构建
   - 修复可能的兼容性问题
