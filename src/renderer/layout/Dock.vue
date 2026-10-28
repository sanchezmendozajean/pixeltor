<script setup lang="ts">
// Dock derecho del workspace Esenciales: Propiedades · Capas/Apariencia · Color/Muestras.
import Panel, { type PanelTab } from './Panel.vue'
import ActionButton from '@/components/ActionButton.vue'
import { t } from '@/i18n'

const properties: PanelTab[] = [
  { id: 'properties', label: 'panels.properties', empty: 'panels.emptyProperties' }
]
const layers: PanelTab[] = [
  { id: 'layers', label: 'panels.layers', empty: 'panels.emptyLayers' },
  { id: 'appearance', label: 'panels.appearance', empty: 'panels.emptyAppearance' }
]
const color: PanelTab[] = [
  { id: 'color', label: 'panels.color', empty: 'panels.emptyColor' },
  { id: 'swatches', label: 'panels.swatches', empty: 'panels.emptySwatches' }
]
</script>

<template>
  <aside class="pt-dock" :aria-label="t('dock.label')">
    <Panel :tabs="properties" :body-height="150" />
    <Panel :tabs="layers">
      <template #foot>
        <div class="pt-pfoot">
          <span class="pt-spacer" />
          <ActionButton id="layer.new" />
          <ActionButton id="layer.delete" />
        </div>
      </template>
    </Panel>
    <Panel :tabs="color" :body-height="110" />
  </aside>
</template>
