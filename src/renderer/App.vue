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
import { registerAppActions } from '@/actions/bindings'
import { handleKeydown } from '@/actions/registry'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
registerAppActions()

// Tab oculta todos los paneles; Mayús+Tab todos menos la barra de herramientas.
const showTools = computed(() => ui.panelsHidden !== 'all')
const showPanels = computed(() => ui.panelsHidden === 'none')

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  void ui.loadSettings()
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
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
  </div>
</template>
