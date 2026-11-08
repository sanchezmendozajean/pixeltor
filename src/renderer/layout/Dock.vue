<script setup lang="ts">
// Dock derecho del workspace Esenciales: Propiedades · Capas/Apariencia · Color/Muestras.
import Panel, { type PanelTab } from './Panel.vue'
import ActionButton from '@/components/ActionButton.vue'
import EffectsPanel from '@/panels/EffectsPanel.vue'
import AlignPanel from '@/panels/AlignPanel.vue'
import ColorPanel from '@/panels/ColorPanel.vue'
import GradientPanel from '@/panels/GradientPanel.vue'
import HistoryPanel from '@/panels/HistoryPanel.vue'
import AppearancePanel from '@/panels/AppearancePanel.vue'
import LayersPanel from '@/panels/LayersPanel.vue'
import PropertiesPanel from '@/panels/PropertiesPanel.vue'
import NavigatorPanel from '@/panels/NavigatorPanel.vue'
import SwatchesPanel from '@/panels/SwatchesPanel.vue'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

const ui = useUiStore()

/** Arrastre de un divisor: `sign` indica hacia dónde crece la medida al mover el puntero. */
function drag(
  e: PointerEvent,
  key: 'width' | 'propsH' | 'colorH',
  axis: 'x' | 'y',
  sign: 1 | -1
): void {
  const el = e.currentTarget as HTMLElement
  const start = axis === 'x' ? e.clientX : e.clientY
  const base = ui.dock[key]
  try {
    el.setPointerCapture(e.pointerId)
  } catch {
    /* puntero sintético */
  }
  const move = (ev: PointerEvent): void => {
    const d = ((axis === 'x' ? ev.clientX : ev.clientY) - start) * sign
    ui.setDockSize(key, base + d)
  }
  const up = (): void => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
    ui.saveDockSize()
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}
/** Pestañas visibles según el espacio de trabajo; un grupo sin pestañas no se dibuja. */
const shown = (tabs: PanelTab[]): PanelTab[] =>
  tabs.filter((x) => ui.panelsVisible.includes(x.id as never))

const properties: PanelTab[] = [
  { id: 'properties', label: 'panels.properties', empty: 'panels.emptyProperties' },
  { id: 'navigator', label: 'panels.navigator', empty: 'panels.emptyGeneric' },
  { id: 'history', label: 'panels.history', empty: 'panels.emptyGeneric' }
]
const layers: PanelTab[] = [
  { id: 'layers', label: 'panels.layers', empty: 'panels.emptyLayers' },
  { id: 'appearance', label: 'panels.appearance', empty: 'panels.emptyAppearance' },
  { id: 'align', label: 'panels.align', empty: 'panels.emptyGeneric' },
  { id: 'effects', label: 'panels.effects', empty: 'panels.emptyGeneric' }
]
const color: PanelTab[] = [
  { id: 'color', label: 'panels.color', empty: 'panels.emptyColor' },
  { id: 'swatches', label: 'panels.swatches', empty: 'panels.emptySwatches' },
  { id: 'gradient', label: 'panels.gradient', empty: 'panels.emptyGeneric' }
]
</script>

<template>
  <aside class="pt-dock" :style="{ width: `${ui.dock.width}px` }" :aria-label="t('dock.label')">
    <div
      class="pt-dock__edge"
      data-testid="dock-edge"
      @pointerdown.prevent="drag($event, 'width', 'x', -1)"
    />
    <Panel v-if="shown(properties).length" :tabs="shown(properties)" :body-height="ui.dock.propsH">
      <template #properties><PropertiesPanel /></template>
      <template #navigator><NavigatorPanel /></template>
      <template #history><HistoryPanel /></template>
    </Panel>
    <div
      v-if="shown(properties).length && shown(layers).length"
      class="pt-dock__split"
      data-testid="dock-split-props"
      @pointerdown.prevent="drag($event, 'propsH', 'y', 1)"
    />
    <Panel v-if="shown(layers).length" :tabs="shown(layers)">
      <template #layers><LayersPanel /></template>
      <template #appearance><AppearancePanel /></template>
      <template #align><AlignPanel /></template>
      <template #effects><EffectsPanel /></template>
      <template #foot="{ active }">
        <!-- los botones de capa sólo acompañan a la pestaña Capas -->
        <div v-if="active === 'layers'" class="pt-pfoot">
          <span class="pt-spacer" />
          <ActionButton id="layer.new" />
          <ActionButton id="layer.duplicate" />
          <ActionButton id="layer.delete" />
        </div>
      </template>
    </Panel>
    <div
      v-if="shown(color).length && (shown(layers).length || shown(properties).length)"
      class="pt-dock__split"
      data-testid="dock-split-color"
      @pointerdown.prevent="drag($event, 'colorH', 'y', -1)"
    />
    <Panel v-if="shown(color).length" :tabs="shown(color)" :body-height="ui.dock.colorH">
      <template #color><ColorPanel /></template>
      <template #swatches><SwatchesPanel /></template>
      <template #gradient><GradientPanel /></template>
    </Panel>
  </aside>
</template>
