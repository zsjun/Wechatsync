import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { store } from './store/store'
import Main from './tempalte/App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import JsonViewer from 'vue-json-viewer'
import mavonEditor from 'mavon-editor'
import 'mavon-editor/dist/css/index.css'

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

const app = createApp(Main)
app.use(router)
app.use(store)
app.use(ElementPlus)
app.use(JsonViewer)
app.use(mavonEditor)
app.mount('#app')
