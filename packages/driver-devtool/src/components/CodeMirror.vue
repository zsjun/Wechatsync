<template>
  <div class="vue-codemirror" ref="editor"></div>
</template>

<script>
import CodeMirror from 'codemirror'
// We assume modes and addons are imported by the parent or globally
// But for safety we can re-import common ones here or let the parent handle it
// The original CodeEditor.vue imports them.

export default {
  name: 'CodeMirror',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    value: {
      type: String,
      default: ''
    },
    options: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['update:modelValue', 'change', 'input', 'ready'],
  data() {
    return {
      content: '',
      cminstance: null
    }
  },
  mounted() {
    this.content = this.modelValue || this.value
    this.initialize()
  },
  beforeUnmount() {
    this.destroy()
  },
  watch: {
    modelValue(val) {
      if (val !== this.content) {
        this.content = val
        if (this.cminstance) {
          const cur = this.cminstance.getValue()
          if (cur !== val) {
            this.cminstance.setValue(val)
          }
        }
      }
    },
    value(val) {
      if (val !== this.content) {
        this.content = val
        if (this.cminstance) {
          const cur = this.cminstance.getValue()
          if (cur !== val) {
            this.cminstance.setValue(val)
          }
        }
      }
    },
    options: {
      deep: true,
      handler(options) {
        if (this.cminstance) {
          for (const key in options) {
            this.cminstance.setOption(key, options[key])
          }
        }
      }
    }
  },
  methods: {
    initialize() {
      this.cminstance = CodeMirror(this.$refs.editor, {
        value: this.content,
        ...this.options
      })
      
      this.cminstance.on('change', cm => {
        this.content = cm.getValue()
        this.$emit('update:modelValue', this.content)
        this.$emit('input', this.content)
        this.$emit('change', this.content)
      })
      
      this.$emit('ready', this.cminstance)
    },
    destroy() {
      const element = this.cminstance.doc.cm.getWrapperElement()
      element && element.remove && element.remove()
      this.cminstance = null
    },
    refresh() {
      this.$nextTick(() => {
        this.cminstance && this.cminstance.refresh()
      })
    }
  }
}
</script>

<style>
.vue-codemirror {
  height: 100%;
  position: relative;
}
.CodeMirror {
  height: 100%;
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 14px;
}
</style>
