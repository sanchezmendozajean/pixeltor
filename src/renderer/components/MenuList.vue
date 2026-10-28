<script setup lang="ts">
// Lista de menú recursiva (submenús con retraso de 150 ms, atajos a la derecha).
import { onBeforeUnmount, ref } from 'vue'
import PtIcon from './PtIcon.vue'
import type { MenuNode } from '@/actions/menus'
import {
  actionIcon,
  actionLabel,
  actionShortcut,
  execute,
  isChecked,
  isEnabled
} from '@/actions/registry'
import { t } from '@/i18n'

defineProps<{ items: MenuNode[] }>()
const emit = defineEmits<{ close: [] }>()

const SUBMENU_DELAY_MS = 150
const hovered = ref(-1)
const openSub = ref(-1)
let timer: ReturnType<typeof setTimeout> | undefined

function enter(index: number, isSub: boolean): void {
  hovered.value = index
  clearTimeout(timer)
  timer = setTimeout(() => (openSub.value = isSub ? index : -1), SUBMENU_DELAY_MS)
}

function run(id: string): void {
  if (execute(id)) emit('close')
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="pt-menu" role="menu">
    <template v-for="(node, i) in items" :key="i">
      <div v-if="node.type === 'sep'" class="pt-msep" role="separator" />

      <div
        v-else-if="node.type === 'action'"
        class="pt-mi"
        role="menuitem"
        :class="{ 'is-hover': hovered === i, 'is-disabled': !isEnabled(node.id) }"
        @pointerenter="enter(i, false)"
        @click="run(node.id)"
      >
        <span class="pt-mi__ic">
          <PtIcon v-if="isChecked(node.id)" name="check" />
          <PtIcon v-else-if="actionIcon(node.id)" :name="actionIcon(node.id)!" />
        </span>
        {{ actionLabel(node.id) }}
        <span v-if="actionShortcut(node.id)" class="pt-mi__kbd">{{ actionShortcut(node.id) }}</span>
      </div>

      <div
        v-else
        class="pt-mi"
        role="menuitem"
        aria-haspopup="menu"
        :class="{ 'is-hover': hovered === i && openSub !== i, 'is-open': openSub === i }"
        @pointerenter="enter(i, true)"
      >
        {{ t(node.label) }}
        <span class="pt-mi__sub"><PtIcon name="chevRight" /></span>
        <MenuList v-if="openSub === i" class="sub" :items="node.items" @close="emit('close')" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.sub {
  position: absolute;
  left: 100%;
  top: -4px;
  z-index: 60;
}
</style>
