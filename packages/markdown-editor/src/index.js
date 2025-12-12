import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import store from './store'

import Main from './Main.vue'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import './styles/boot.css'

const routes = [
  {
    path: '/',
    component: Main,
    meta: {
      index: 1,
    },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const app = createApp(Main) // Or createApp({ template: '<router-view />' }) if Main is the route component.
// Actually in Vue 2 it was new Vue({ router, store }).$mount('#app') and the template in index.html is <router-view />.
// So we should create an App component that renders router-view.
// But wait, the original index.html has <router-view /> inside #app.
// In Vue 3, we mount the app to #app.
// We can use a root component that renders <router-view>.

// Let's modify this to use a simple App component.
import { h } from 'vue'
const App = {
  render() {
    return h('router-view')
  },
}

const appInstance = createApp(App)

appInstance.use(router)
appInstance.use(store)
appInstance.use(ElementPlus)
appInstance.use(MdEditor)

// VueMoment replacement - global property
// appInstance.config.globalProperties.$moment = moment // if we had moment.
// For now, removing VueMoment as it's not compatible and we might not need it or can use dayjs.

appInstance.mount('#app')
