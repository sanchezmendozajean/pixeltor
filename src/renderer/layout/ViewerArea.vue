<script setup lang="ts">
// Área de trabajo del documento activo: árbol de visores divididos (specs/09).
import { onBeforeUnmount, ref, watch } from 'vue'
import { useDocumentsStore } from '@/stores/documents'
import type { Workspace } from '@/session/workspace'
import { mirrorViewerFlags } from '@/session/viewer'
import ViewerNode from './ViewerNode.vue'
import WelcomeScreen from './WelcomeScreen.vue'

const docs = useDocumentsStore()
// La disposición no es reactiva: cada cambio sube este contador.
const tick = ref(0)
let off: (() => void) | null = null

function bind(ws: Workspace | null): void {
  off?.()
  off = null
  tick.value++
  if (!ws) return
  mirrorViewerFlags(ws)
  // cualquier cambio de disposición (cerrar un visor, cambiar el activo…) puede cambiar el visor activo
  off = ws.onLayout(() => {
    mirrorViewerFlags(ws)
    tick.value++
  })
}

watch(() => docs.active, bind, { immediate: true })
onBeforeUnmount(() => off?.())
</script>

<template>
  <ViewerNode
    v-if="docs.active"
    :key="docs.active.id"
    :node="docs.active.layout"
    :ws="docs.active"
    :tick="tick"
    class="root"
  />
  <WelcomeScreen v-else />
</template>

<style scoped>
.root {
  flex: 1;
}
</style>
