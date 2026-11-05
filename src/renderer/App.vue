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
import ColorPickerDialog from '@/dialogs/ColorPickerDialog.vue'
import ShortcutsDialog from '@/dialogs/ShortcutsDialog.vue'
import WorkspaceDialog from '@/dialogs/WorkspaceDialog.vue'
import CommandPalette from '@/dialogs/CommandPalette.vue'
import DialogHost from '@/dialogs/DialogHost.vue'
import { registerAppActions } from '@/actions/bindings'
import { restoreWorkspace } from '@/app/workspaces'
import { handleKeydown } from '@/actions/registry'
import { handleBeforeClose, listRecovery, openFile, startAutosave } from '@/app/documentOps'
import { useDocumentsStore } from '@/stores/documents'
import { t } from '@/i18n'
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
let offOpen = (): void => {}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  void ui.loadSettings().then(restoreWorkspace)
  offClose = window.pixeltor.onBeforeClose(() => void handleBeforeClose())
  stopAutosave = startAutosave()
  // Documentos pasados por el sistema (doble clic en un .pixeltor).
  offOpen = window.pixeltor.onOpenPaths((paths) => paths.forEach((p) => void openFile(p)))
  for (const p of await window.pixeltor.takePendingOpen()) await openFile(p)
  // Tras un cierre inesperado quedan copias en recovery/.
  if ((await listRecovery()).length) ui.dialog = 'recovery'
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  stopAutosave()
  offClose()
  offOpen()
})
</script>

<template>
  <div class="pt-root pt-app">
    <TitleBar />
    <div v-if="showPanels" role="region" :aria-label="t('controlbar.label')">
      <ControlBar />
    </div>
    <div class="pt-body">
      <ToolBar v-if="showTools" />
      <main class="pt-center">
        <h1 class="pt-sr">{{ t('app.name') }}</h1>
        <DocTabs />
        <div class="pt-viewports"><ViewerArea /></div>
        <FramesStrip v-if="showPanels && !ui.stripHidden" />
      </main>
      <IconColumn v-if="showPanels && ui.dockVisible" />
      <Dock v-if="showPanels && ui.dockVisible" />
    </div>
    <StatusBar />
    <TooltipHost />
    <DialogHost />
    <CommandPalette />
    <ColorPickerDialog />
    <ShortcutsDialog />
    <WorkspaceDialog />
  </div>
</template>
