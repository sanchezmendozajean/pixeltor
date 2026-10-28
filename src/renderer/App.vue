<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import TitleBar from '@/layout/TitleBar.vue'
import ControlBar from '@/layout/ControlBar.vue'
import ToolBar from '@/layout/ToolBar.vue'
import DocTabs from '@/layout/DocTabs.vue'
import ViewerArea from '@/layout/ViewerArea.vue'
import FramesStrip from '@/layout/FramesStrip.vue'
import IconColumn from '@/layout/IconColumn.vue'
import Dock from '@/layout/Dock.vue'
import StatusBar from '@/layout/StatusBar.vue'
import TooltipHost from '@/components/TooltipHost.vue'
import DialogHost from '@/dialogs/DialogHost.vue'
import { registerAppActions } from '@/actions/bindings'
import { handleKeydown } from '@/actions/registry'
import { handleBeforeClose, listRecovery, startAutosave } from '@/app/documentOps'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const docs = useDocumentsStore()
registerAppActions()
// Documento inicial de ejemplo (32 × 32), como la maqueta de F0.
docs.newDocument(32, 32)

// Tab oculta todos los paneles; Mayús+Tab todos menos la barra de herramientas.
const showTools = computed(() => ui.panelsHidden !== 'all')
const showPanels = computed(() => ui.panelsHidden === 'none')

let stopAutosave = (): void => {}
let offClose = (): void => {}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  void ui.loadSettings()
  offClose = window.pixeltor.onBeforeClose(() => void handleBeforeClose())
  stopAutosave = startAutosave()
  // Tras un cierre inesperado quedan copias en recovery/.
  if ((await listRecovery()).length) ui.dialog = 'recovery'
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  stopAutosave()
  offClose()
})
</script>

<template>
  <div class="pt-root pt-app">
    <TitleBar />
    <ControlBar v-if="showPanels" />
    <div class="pt-body">
      <ToolBar v-if="showTools" />
      <main class="pt-center">
        <DocTabs />
        <div class="pt-viewports"><ViewerArea /></div>
        <FramesStrip v-if="showPanels" />
      </main>
      <IconColumn v-if="showPanels" />
      <Dock v-if="showPanels" />
    </div>
    <StatusBar />
    <TooltipHost />
    <DialogHost />
  </div>
</template>
