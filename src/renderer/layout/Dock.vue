<script setup lang="ts">
// Dock derecho del workspace Esenciales: Propiedades · Capas/Apariencia · Color/Muestras.
import Panel, { type PanelTab } from './Panel.vue'
import ActionButton from '@/components/ActionButton.vue'
import AlignPanel from '@/panels/AlignPanel.vue'
import ColorPanel from '@/panels/ColorPanel.vue'
import GradientPanel from '@/panels/GradientPanel.vue'
import HistoryPanel from '@/panels/HistoryPanel.vue'
import AppearancePanel from '@/panels/AppearancePanel.vue'
import LayersPanel from '@/panels/LayersPanel.vue'
import PropertiesPanel from '@/panels/PropertiesPanel.vue'
import NavigatorPanel from '@/panels/NavigatorPanel.vue'
import SwatchesPanel from '@/panels/SwatchesPanel.vue'
import { t } from '@/i18n'

const properties: PanelTab[] = [
  { id: 'properties', label: 'panels.properties', empty: 'panels.emptyProperties' },
  { id: 'navigator', label: 'panels.navigator', empty: 'panels.emptyGeneric' },
  { id: 'history', label: 'panels.history', empty: 'panels.emptyGeneric' }
]
const layers: PanelTab[] = [
  { id: 'layers', label: 'panels.layers', empty: 'panels.emptyLayers' },
  { id: 'appearance', label: 'panels.appearance', empty: 'panels.emptyAppearance' },
  { id: 'align', label: 'panels.align', empty: 'panels.emptyGeneric' }
]
const color: PanelTab[] = [
  { id: 'color', label: 'panels.color', empty: 'panels.emptyColor' },
  { id: 'swatches', label: 'panels.swatches', empty: 'panels.emptySwatches' },
  { id: 'gradient', label: 'panels.gradient', empty: 'panels.emptyGeneric' }
]
</script>

<template>
  <aside class="pt-dock" :aria-label="t('dock.label')">
    <Panel :tabs="properties" :body-height="150">
      <template #properties><PropertiesPanel /></template>
      <template #navigator><NavigatorPanel /></template>
      <template #history><HistoryPanel /></template>
    </Panel>
    <Panel :tabs="layers">
      <template #layers><LayersPanel /></template>
      <template #appearance><AppearancePanel /></template>
      <template #align><AlignPanel /></template>
      <template #foot>
        <div class="pt-pfoot">
          <span class="pt-spacer" />
          <ActionButton id="layer.new" />
          <ActionButton id="layer.delete" />
        </div>
      </template>
    </Panel>
    <Panel :tabs="color" :body-height="300">
      <template #color><ColorPanel /></template>
      <template #swatches><SwatchesPanel /></template>
      <template #gradient><GradientPanel /></template>
    </Panel>
  </aside>
</template>
