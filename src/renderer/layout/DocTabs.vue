<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import PtIcon from '@/components/PtIcon.vue'
import { closeAll, closeOthers, closeWorkspace } from '@/app/documentOps'
import { useDocumentsStore } from '@/stores/documents'
import { t } from '@/i18n'

const docs = useDocumentsStore()

/** Menú contextual de una pestaña. */
const menu = ref<{ id: string; x: number; y: number } | null>(null)

function openMenu(id: string, e: MouseEvent): void {
  menu.value = { id, x: e.clientX, y: e.clientY }
}
function run(fn: (id: string) => Promise<boolean>): void {
  const id = menu.value?.id
  menu.value = null
  if (id) void fn(id)
}
function dismiss(e: Event): void {
  if (!menu.value) return
  if (e instanceof KeyboardEvent && e.key !== 'Escape') return
  if (e instanceof PointerEvent && (e.target as HTMLElement).closest('.tabmenu')) return
  menu.value = null
}
onMounted(() => {
  document.addEventListener('pointerdown', dismiss, true)
  document.addEventListener('keydown', dismiss, true)
  window.addEventListener('blur', () => (menu.value = null))
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', dismiss, true)
  document.removeEventListener('keydown', dismiss, true)
})
</script>

<template>
  <div class="pt-doctabs" role="tablist" :aria-label="t('docs.tabs')">
    <button
      v-for="tab in docs.tabs"
      :key="tab.id"
      type="button"
      class="pt-doctab"
      :class="{ 'is-active': tab.id === docs.activeId }"
      role="tab"
      :aria-selected="tab.id === docs.activeId"
      @click="docs.activate(tab.id)"
      @auxclick.middle.prevent="closeWorkspace(tab.id)"
      @contextmenu.prevent="openMenu(tab.id, $event)"
    >
      {{ tab.name }}.pixeltor
      <span v-if="tab.id === docs.activeId" class="pt-doctab__zoom"
        >@ {{ docs.zoomPercent }} %</span
      >
      <span v-if="tab.dirty" class="pt-dirty" :data-tip="t('docs.unsaved')" />
      <span
        class="pt-iconbtn"
        role="button"
        :aria-label="t('docs.close')"
        @click.stop="closeWorkspace(tab.id)"
      >
        <PtIcon name="close" class="x" />
      </span>
    </button>
    <Teleport to="body">
      <div
        v-if="menu"
        class="pt-menu tabmenu"
        role="menu"
        :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      >
        <div class="pt-mi" role="menuitem" @click="run(closeWorkspace)">
          {{ t('docs.menu.close') }}
        </div>
        <div
          class="pt-mi"
          role="menuitem"
          :class="{ 'is-disabled': docs.tabs.length < 2 }"
          @click="docs.tabs.length > 1 && run(closeOthers)"
        >
          {{ t('docs.menu.closeOthers') }}
        </div>
        <div class="pt-mi" role="menuitem" @click="run(() => closeAll())">
          {{ t('docs.menu.closeAll') }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tabmenu {
  position: fixed;
  z-index: 80;
  min-width: 160px;
}
.tabmenu .pt-mi:hover:not(.is-disabled) {
  background: var(--accent-solid);
  color: var(--on-accent);
}
.x {
  width: 12px;
  height: 12px;
}
</style>
