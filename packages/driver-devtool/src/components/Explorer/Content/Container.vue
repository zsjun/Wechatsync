<template>
  <div class="container">
    <tab-bar :active="activeItem"></tab-bar>
    <div class="main" v-if="!!this.activeId">
      <split-pane
        class="default-theme split-pane-resizer-content"
        horizontal="true"
        style="height: 100%"
        @resize="recordPanelPercent"
      >
        <pane :size="panelPercent" :min-size="10">
          <code-editor
            :active="activeItem"
            :theme="theme"
            @toggle-terminal="toggleTerminal"
          ></code-editor>
        </pane>
        <pane :size="100 - panelPercent">
          <terminal :theme="theme" @toggle-terminal="toggleTerminal"></terminal>
        </pane>
      </split-pane>
    </div>
  </div>
</template>

<script>
import CodeEditor from './CodeEditor.vue'
import Terminal from './Terminal.vue'
import TabBar from './TabBar.vue'
import { getById } from '@/store/controller/section'
import {
  addThemeChangeListener,
  removeThemeChangeListener,
} from '@/utils/theme'
import { get, set } from '@/utils/localStore'

export default {
  components: { TabBar, CodeEditor, Terminal },
  props: {
    activeId: String,
  },
  data() {
    this.$preferPanelPercent = get('preference_terminal_panel_percent') ?? 70
    return {
      panelPercent: this.$preferPanelPercent,
      theme: window.__theme,
    }
  },
  computed: {
    activeItem() {
      return getById(this.activeId) || {}
    },
  },
  methods: {
    recordPanelPercent(value) {
      if (Array.isArray(value) && value.length > 0) {
        // splitpanes emits an array of pane sizes
        this.panelPercent = value[0].size
        this.$preferPanelPercent = this.panelPercent
        set('preference_terminal_panel_percent', this.$preferPanelPercent)
      }
    },
    toggleTerminal() {
      if (this.panelPercent >= 99) {
        this.panelPercent =
          this.$preferPanelPercent >= 99 ? 70 : this.$preferPanelPercent
      } else {
        this.panelPercent = 100
      }
    },
    onThemeChange(theme) {
      this.theme = theme
    },
  },
  mounted() {
    addThemeChangeListener(this.onThemeChange)
  },
  beforeUnmount() {
    removeThemeChangeListener(this.onThemeChange)
  },
}
</script>

<style lang="scss" scoped>
.container {
  display: flex;
  flex-direction: column;
}
.main {
  flex: 1;
}
</style>

<style>
.split-pane-resizer-content {
  background: transparent !important;
  border-color: transparent !important;
}
</style>
