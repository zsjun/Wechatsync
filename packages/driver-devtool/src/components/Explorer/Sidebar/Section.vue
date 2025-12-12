<template>
  <section :style="sectionStyleObject">
    <collapse :title="title" @collapse-toggle="adjustHeight">
      <template v-slot:header>
        <div class="actions">
          <v-icon
            name="plus"
            class="action-icon"
            @click.stop="isAdding = !isAdding"
          />
          <label class="file-import" @click.stop>
            <v-icon name="folder-open" class="action-icon" />
            <input type="file" @change="importFile" accept="text/*" />
          </label>
        </div>
      </template>
      <template v-slot:default>
        <ul class="select-list">
          <sidebar-section-item
            v-for="item in items"
            :key="item.id"
            :name="item.name"
            :id="item.id"
            :active="activeId === item.id"
            :ref="(el) => setItemRef(el, item.id)"
            @contextmenu.prevent="onContextMenu($event, item.id)"
          >
            <slot name="item" v-bind="{ id: item.id }" />
          </sidebar-section-item>
        </ul>
        <sidebar-section-item
          v-if="isAdding"
          isNew
          @submit="createNewFile"
          @cancel="isAdding = false"
        />
      </template>
    </collapse>
  </section>
</template>

<script>
import SidebarSectionItem from './SectionItem.vue'
import { create } from '@/store/controller/section'
import { setId as setActiveId } from '@/store/controller/activeItem'
import ContextMenu from '@imengyu/vue3-context-menu'

export default {
  components: { SidebarSectionItem },
  data() {
    return {
      isAdding: false,
      sectionStyleObject: {},
      itemRefs: {},
    }
  },
  props: {
    title: String,
    items: Array,
    activeId: String,
    idPrefix: String,
  },
  methods: {
    setItemRef(el, id) {
      if (el) {
        this.itemRefs[id] = el
      }
    },
    onContextMenu(e, id) {
      const itemComponent = this.itemRefs[id]
      if (!itemComponent) return

      ContextMenu.showContextMenu({
        x: e.x,
        y: e.y,
        items: [
          {
            label: '重命名',
            onClick: () => {
              itemComponent.startRename()
            },
          },
          {
            label: '删除',
            onClick: () => {
              itemComponent.confirmDelete()
            },
          },
        ],
      })
    },
    adjustHeight(isOpen) {
      this.sectionStyleObject.flex = isOpen ? 1 : 0
    },
    createNewFile({ name }) {
      const newId = create({
        idPrefix: this.idPrefix,
        name,
        content: '',
      })
      this.isAdding = false
      setActiveId(newId)
    },
    importFile(event) {
      const { idPrefix } = this
      const input = event.target
      const fileObject = input.files[0]
      const newFilePayload = {}
      if (fileObject) {
        const fileName = fileObject.name
        const fileReader = new FileReader()

        fileReader.onload = () => {
          try {
            Object.assign(newFilePayload, {
              idPrefix,
              name: fileName || `Untitled-${+new Date()}`,
              content: fileReader.result,
            })
            setActiveId(create(newFilePayload))
          } catch (e) {
            if (e.message === 'Name Duplicate') {
              Object.assign(newFilePayload, {
                idPrefix,
                name: `${fileName}-${+new Date()}`,
                content: fileReader.result,
              })
              setActiveId(create(newFilePayload))
            }
          }
        }
        fileReader.readAsText(fileObject)
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.actions {
  display: flex;
  align-items: center;
  svg {
    fill: var(--icon-default-color);
    height: 0.8em;
    margin-left: 0.4em;
  }
}
.select-list {
  margin: 0;
  padding: 0;
}
.file-import {
  cursor: inherit;
  svg {
    vertical-align: 0;
  }
  input {
    display: none;
  }
}
</style>
