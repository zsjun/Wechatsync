import { OhVueIcon, addIcons } from 'oh-vue-icons'
import {
  FaChevronDown,
  FaPlus,
  FaFolderOpen,
  FaMarkdown,
  FaJsSquare,
  FaStream,
  FaCircle,
  FaTimes,
  FaCode,
  FaCheck,
  FaSun,
  FaMoon,
  FaSyncAlt,
  FaImages,
  FaUserCircle,
  FaBolt,
  FaBan,
  FaEye,
  FaEyeSlash,
  FaQuestionCircle,
} from 'oh-vue-icons/icons'

addIcons(
  FaChevronDown,
  FaPlus,
  FaFolderOpen,
  FaMarkdown,
  FaJsSquare,
  FaStream,
  FaCircle,
  FaTimes,
  FaCode,
  FaCheck,
  FaSun,
  FaMoon,
  FaSyncAlt,
  FaImages,
  FaUserCircle,
  FaBolt,
  FaBan,
  FaEye,
  FaEyeSlash,
  FaQuestionCircle
)

export default (app) => {
  app.component('v-icon', OhVueIcon)
}
