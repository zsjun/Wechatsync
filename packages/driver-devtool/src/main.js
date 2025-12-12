import registerIcons from './register-icons'
import registerComponents from './register-components'
import registerDirectives from './register-directives'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)

registerIcons(app)
registerComponents(app)
registerDirectives(app)

app.use(router)
app.mount('#app')
