<script setup lang="ts">
// Área de trabajo del documento activo: árbol de visores divididos (specs/09).
import { onBeforeUnmount, ref, watch } from 'vue'
import { useDocumentsStore } from '@/stores/documents'
import type { Workspace } from '@/session/workspace'
import { mirrorViewerFlags } from '@/session/viewer'
import { t } from '@/i18n'
import ViewerNode from './ViewerNode.vue'

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
  off = ws.onLayout(() => tick.value++)
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
  <section v-else class="pt-viewport empty" :aria-label="t('docs.noDocument')">
    <p>{{ t('docs.noDocument') }}</p>
  </section>
</template>

<style scoped>
.root {
  flex: 1;
}
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}
</style>
