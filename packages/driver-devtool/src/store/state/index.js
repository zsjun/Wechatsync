import { reactive } from 'vue'
import Articles from './Articles'
import Adapters from './Adapters'
import ActiveItem from './ActiveItem'
import OpenedFiles from './OpenedFiles'

export const articles = reactive(new Articles())
export const adapters = reactive(new Adapters())
export const activeItem = reactive(new ActiveItem())
export const openedFiles = reactive(new OpenedFiles())

