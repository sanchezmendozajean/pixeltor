<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import MenuList from '@/components/MenuList.vue'
import { MENUS } from '@/actions/menus'
import { t } from '@/i18n'

const open = ref(-1)
const root = ref<HTMLElement | null>(null)

function close(): void {
  open.value = -1
}

function onPointerDown(e: PointerEvent): void {
  if (!root.value?.contains(e.target as Node)) close()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value >= 0) {
    close()
    e.stopPropagation()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('blur', close)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('keydown', onKey, true)
  window.removeEventListener('blur', close)
})
</script>

<template>
  <nav ref="root" class="menubar" aria-label="Menú principal">
    <div v-for="(menu, i) in MENUS" :key="menu.id" class="slot">
      <button
        type="button"
        class="pt-menuitem"
        :class="{ 'is-open': open === i }"
        aria-haspopup="menu"
        :aria-expanded="open === i"
        @click="open = open === i ? -1 : i"
        @pointerenter="open >= 0 && (open = i)"
      >
        {{ t(menu.label) }}
      </button>
      <MenuList v-if="open === i" class="drop" :items="menu.items" @close="close" />
    </div>
  </nav>
</template>

<style scoped>
.menubar {
  display: flex;
  align-items: center;
}
.slot {
  position: relative;
}
.drop {
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 2px;
  z-index: 60;
}
</style>
