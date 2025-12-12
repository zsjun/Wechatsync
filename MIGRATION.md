# 2025 迁移计划文档

## 📋 概述

本项目是 2021 年的代码库，需要升级到 2025 年的技术栈。主要迁移目标：
- **Manifest V2 → Manifest V3** (Chrome 扩展)
- **Vue 2 → Vue 3**
- **Webpack → Vite**
- **依赖现代化**

## 🎯 迁移阶段

### 阶段 1：环境准备 (Foundation)

#### 1.1 验证 Node.js 版本
```bash
node --version  # 需要 Node.js 18+ (推荐 20 LTS)
```

#### 1.2 创建迁移分支
```bash
git checkout -b migration/2025-upgrade
git push -u origin migration/2025-upgrade
```

#### 1.3 依赖安全审计
```bash
npm audit
# 或
pnpm audit
```

#### 1.4 迁移到 pnpm (推荐)
```bash
# 安装 pnpm
npm install -g pnpm

# 创建 pnpm-workspace.yaml
cat > pnpm-workspace.yaml << EOF
packages:
  - 'packages/*'
  - 'packages/@wechatsync/*'
EOF

# 删除旧锁文件
rm -rf node_modules yarn.lock package-lock.json
rm -rf packages/*/node_modules

# 安装依赖
pnpm install
```

---

### 阶段 2：Manifest V3 迁移 (Critical)

#### 2.1 基础 Manifest 文件修改

**文件**: `packages/web-extension/src/copied/manifest.json`

**关键变更**:
```json
{
  "manifest_version": 3,  // 从 2 改为 3
  "action": {              // browser_action 改为 action
    "default_popup": "index.html",
    "default_icon": "icon.png"
  },
  "background": {
    "service_worker": "background.js",  // scripts 数组改为单个 service_worker
    "type": "module"                    // 支持 ES 模块
  },
  "host_permissions": [     // 从 permissions 中分离
    "http://*/*",
    "https://*/*"
  ],
  "permissions": [          // 移除 webRequestBlocking
    "contextMenus",
    "storage",
    "notifications"
  ]
}
```

#### 2.2 后台脚本 Service Worker 化

**问题**: `background.js` 中使用了 jQuery，但 Service Worker 没有 DOM。

**解决方案**:
1. 移除所有 jQuery 依赖
2. 使用原生 `fetch` API
3. 使用 `chrome.storage` 替代 localStorage
4. 移除所有 DOM 操作

**示例转换**:
```javascript
// ❌ 旧代码 (MV2)
const $ = require('./libs/jquery.js')
$.ajax({ url, method: 'POST', data })

// ✅ 新代码 (MV3)
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
```

#### 2.3 网络请求 API 迁移

**移除**: `webRequestBlocking` 权限

**替代方案**:
- 如果只需要监听：使用 `webRequest` (仍可用)
- 如果需要拦截：使用 `declarativeNetRequest` API

#### 2.4 CSP 策略更新

**问题**: `sval` 库需要 `unsafe-eval`，但 MV3 禁止。

**解决方案**:
1. 评估 `sval` 的使用场景
2. 如果必须动态执行代码，考虑：
   - Chrome User Scripts API (Chrome 120+)
   - 将逻辑固化在扩展包内
   - 使用 WebAssembly 替代

---

### 阶段 3：Vue 3 升级

#### 3.1 根目录依赖升级

**文件**: `package.json`

```json
{
  "devDependencies": {
    "vue": "^3.4.0",                    // 升级
    "@vitejs/plugin-vue": "^5.0.0",    // 新增
    // 移除: vue-template-compiler
    // 移除: vue-loader (Vite 内置)
  }
}
```

#### 3.2 Vue 组件语法更新

**主要变更**:
1. **组件定义**:
   ```javascript
   // Vue 2
   export default {
     data() { return {} }
   }
   
   // Vue 3 (Composition API 推荐)
   import { ref } from 'vue'
   export default {
     setup() {
       const count = ref(0)
       return { count }
     }
   }
   ```

2. **Element UI → Element Plus**:
   ```javascript
   // 旧
   import { Button } from 'element-ui'
   
   // 新
   import { ElButton } from 'element-plus'
   ```

3. **Vue Router 4**:
   ```javascript
   // Vue Router 3
   new VueRouter({ routes })
   
   // Vue Router 4
   createRouter({ history: createWebHistory(), routes })
   ```

#### 3.3 状态管理迁移

**选项 A**: 升级到 Vuex 4
```bash
pnpm add vuex@^4.1.0
```

**选项 B**: 迁移到 Pinia (推荐)
```bash
pnpm add pinia
```

---

### 阶段 4：Vite 迁移

#### 4.1 安装 Vite 和相关插件

```bash
pnpm add -D -w vite @vitejs/plugin-vue @crxjs/vite-plugin
```

#### 4.2 创建 Vite 配置

**文件**: `packages/web-extension/vite.config.js`

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/copied/manifest.json'

export default defineConfig({
  plugins: [
    vue(),
    crx({ manifest })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: 'src/background.js',
        popup: 'src/popup.js',
        content: 'src/content.js',
        // ... 其他入口
      }
    }
  }
})
```

#### 4.3 更新 package.json 脚本

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

---

### 阶段 5：清理和优化

#### 5.1 移除旧工具
- 删除 `babel.config.json` (Vite 内置支持)
- 删除所有 `webpack.config.js`
- 清理 webpack 相关依赖

#### 5.2 依赖升级
```bash
# 升级 axios
pnpm add axios@^1.7.0

# 考虑替换 moment (体积大)
pnpm add date-fns  # 或 dayjs
```

#### 5.3 测试验证
1. 在 Chrome 中加载未打包的扩展 (`chrome://extensions`)
2. 测试所有核心功能
3. 检查控制台错误
4. 验证 Manifest V3 兼容性

---

## 📝 迁移检查清单

### Manifest V3
- [ ] manifest_version 改为 3
- [ ] browser_action 改为 action
- [ ] background.scripts 改为 service_worker
- [ ] 移除 webRequestBlocking
- [ ] 更新 CSP 策略
- [ ] 移除 background.js 中的 jQuery
- [ ] 所有 DOM 操作已移除

### Vue 3
- [ ] 根目录 vue 升级到 3.x
- [ ] web-extension 包升级完成
- [ ] driver-devtool 包升级完成
- [ ] markdown-editor 包升级完成
- [ ] element-ui 替换为 element-plus
- [ ] vue-router 升级到 4.x
- [ ] vuex 升级或迁移到 Pinia

### Vite
- [ ] 根目录安装 Vite
- [ ] web-extension 包迁移完成
- [ ] drivers 包迁移完成
- [ ] driver-devtool 包迁移完成
- [ ] markdown-editor 包迁移完成
- [ ] 所有 webpack 配置已删除

### 依赖
- [ ] axios 升级到 1.x
- [ ] moment 替换为 date-fns/dayjs
- [ ] sval 库问题已解决
- [ ] 所有安全漏洞已修复

---

## 🚨 已知问题和风险

1. **sval 库**: 需要评估在 MV3 下的可行性
2. **jQuery 依赖**: background.js 中大量使用，需要完全重写
3. **webRequestBlocking**: 如果必须拦截请求，需要重写为 declarativeNetRequest
4. **Vue 2 组件**: 可能有大量组件需要手动更新语法

---

## 📚 参考资源

- [Chrome Extension MV3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Vue 3 Migration Guide](https://v3-migration.vuejs.org/)
- [Vite Guide](https://vitejs.dev/)
- [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)

---

## 🎯 下一步

开始执行阶段 1，创建迁移分支并准备环境。

