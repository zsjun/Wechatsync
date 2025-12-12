import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { store } from './store/store'
import Store from './db/store'
import App from './App.vue'
import EntryView from './views/EntryView.vue'
import Option from './views/Option.vue'
import AddAccount from './views/AddAccount.vue'
import TaskDetail from './views/TaskDetail.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import {
  initializeDriver,
  getDriverProvider,
  initDevRuntimeEnvironment,
} from '@/runtime'

initDevRuntimeEnvironment()

var db = new Store()
window.db = db

const routes = [
  {
    path: '/options',
    component: Option,
  },
  {
    path: '/',
    component: EntryView,
    meta: {
      index: 1,
    },
  },
  {
    name: 'AddAccount',
    path: '/add-account',
    component: AddAccount,
    meta: {
      index: 1,
    },
  },
  {
    name: 'TaskDetail',
    path: '/task-detail',
    component: TaskDetail,
    meta: {
      index: 1,
    },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const app = createApp(App)

app.use(router)
app.use(store)
app.use(ElementPlus)

app.mount('#app')
