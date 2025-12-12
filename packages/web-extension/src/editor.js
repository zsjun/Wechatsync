import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { store } from './store/store'

import Main from './editor/Main.vue'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import mavonEditor from 'mavon-editor'
import 'mavon-editor/dist/css/index.css'

// Vue.use(VueMoment) // Vue 3 doesn't support VueMoment directly in the same way, need alternative or custom global property

var routes = [
  {
    path: '/',
    component: Main,
    meta: {
      index: 1,
    },
  },
]

// var winBackgroundPage = chrome.extension.getBackgroundPage()
// var db = winBackgroundPage.db
// window.db = db

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const App = {
  template: '<router-view />'
}

const app = createApp(App)
app.use(router)
app.use(store)
app.use(ElementPlus)
app.use(mavonEditor)
app.mount('#app')
