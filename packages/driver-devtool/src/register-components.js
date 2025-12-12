import 'codemirror/lib/codemirror.css'

// splitPane
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

// contextmenu
import ContextMenu from '@imengyu/vue3-context-menu'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'

// prefect-scrollbar
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'
import 'vue3-perfect-scrollbar/style.css'

const modules = import.meta.glob('./ui/*.vue', { eager: true })

export default (app) => {
  // vue-codemirror replacement - we will use a custom component or manual integration
  // For now, we assume CodeEditor.vue is handling it directly with codemirror package

  app.component('split-pane', Splitpanes)
  app.component('pane', Pane)

  app.use(ContextMenu)
  app.component('PerfectScrollbar', PerfectScrollbar)

  for (const path in modules) {
    const componentConfig = modules[path]
    const componentName = path
      .split('/')
      .pop()
      .replace(/\.\w+$/, '')

    app.component(componentName, componentConfig.default || componentConfig)
  }
}
