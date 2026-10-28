<script setup lang="ts">
// Botón de herramienta con flyout: pulsación larga (300 ms) o clic derecho despliega las variantes.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ActionButton from '@/components/ActionButton.vue'
import { useToolsStore } from '@/stores/tools'

const props = defineProps<{ groupId: string; tools: string[] }>()

const LONG_PRESS_MS = 300
const store = useToolsStore()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let longPressed = false

const shown = () => store.shown[props.groupId] ?? props.tools[0]!
const isActive = () => props.tools.includes(store.active)
const hasFlyout = () => props.tools.length > 1

function down(e: PointerEvent): void {
  if (e.button !== 0 || !hasFlyout()) return
  longPressed = false
  timer = setTimeout(() => {
    longPressed = true
    open.value = true
  }, LONG_PRESS_MS)
}

function cancel(): void {
  clearTimeout(timer)
}

function onContext(): void {
  if (hasFlyout()) open.value = true
}

function onClickCapture(e: MouseEvent): void {
  // Tras una pulsación larga el clic solo abre el flyout, no activa la herramienta.
  if (longPressed) {
    e.stopPropagation()
    longPressed = false
  }
}

function pick(tool: string): void {
  store.activate(tool)
  open.value = false
}

function outside(e: PointerEvent): void {
  if (open.value && !root.value?.contains(e.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('pointerdown', outside, true))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside, true)
  clearTimeout(timer)
})
</script>

<template>
  <div ref="root" class="wrap">
    <span
      @pointerdown="down"
      @pointerup="cancel"
      @pointerleave="cancel"
      @contextmenu.prevent="onContext"
      @click.capture="onClickCapture"
    >
      <ActionButton
        :id="`tool.${shown()}`"
        variant="tool"
        :active="isActive()"
        :class="{ 'has-fly': hasFlyout() }"
        @click="open = false"
      />
    </span>
    <div v-if="open" class="pt-fly fly" role="menu">
      <ActionButton
        v-for="tool in tools"
        :id="`tool.${tool}`"
        :key="tool"
        variant="tool"
        :active="store.active === tool"
        @click="pick(tool)"
      />
    </div>
  </div>
</template>

<style scoped>
.wrap {
  position: relative;
}
.fly {
  left: 38px;
  top: -2px;
  background: var(--bg-panel-raised);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-popover);
}
</style>
