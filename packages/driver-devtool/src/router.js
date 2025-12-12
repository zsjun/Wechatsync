import { createRouter, createWebHashHistory } from 'vue-router'
import ExplorerMain from "./components/Explorer/Main.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: "explorer",
      component: ExplorerMain
    }
  ]
})

export default router;
