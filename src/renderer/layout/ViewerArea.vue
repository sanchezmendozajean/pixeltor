<script setup lang="ts">
// Visor 1. En F0 solo la maqueta: cabecera, lienzo vacío con tablero y cuadrícula de píxeles.
// La abstracción Viewport y el render WebGL2 llegan en F1.
import { computed } from 'vue'
import PtIcon from '@/components/PtIcon.vue'
import ActionButton from '@/components/ActionButton.vue'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

/** A partir de este zoom (%) se dibuja la cuadrícula de píxeles (specs/02: pixelGridMinZoom = 8). */
const PIXEL_GRID_MIN_ZOOM = 800

const docs = useDocumentsStore()
const ui = useUiStore()

const scale = computed(() => (docs.active ? docs.active.zoom / 100 : 1))
const canvasStyle = computed(() => ({
  width: `${(docs.active?.width ?? 0) * scale.value}px`,
  height: `${(docs.active?.height ?? 0) * scale.value}px`
}))
const showGrid = computed(() => ui.pixelGrid && (docs.active?.zoom ?? 0) >= PIXEL_GRID_MIN_ZOOM)
</script>

<template>
  <section class="pt-viewport is-current" :aria-label="t('viewer.name', { n: 1 })">
    <div class="pt-vhead pt-vhead--overlay">
      <span class="pt-vhead__lbl">{{ t('viewer.image') }}</span>
      <button type="button" class="pt-select image" :aria-label="t('viewer.image')">
        <span>{{ t('viewer.followsActive') }}</span>
        <PtIcon name="chevDown" />
      </button>
      <span class="pt-sep sep" />
      <button type="button" class="pt-select zoom" :aria-label="t('status.zoom')">
        <span class="pt-mono">{{ docs.active?.zoom }} %</span>
        <PtIcon name="chevDown" />
      </button>
      <span class="pt-sep sep" />
      <ActionButton id="view.pixelGrid" :on="ui.pixelGrid" />
      <ActionButton id="view.hidePaths" :on="ui.showPaths" />
      <ActionButton id="view.onion" />
      <span class="pt-sep sep" />
      <ActionButton id="view.play" />
      <div class="pt-spacer" />
      <button
        type="button"
        class="pt-iconbtn"
        :data-tip="t('viewer.more')"
        :aria-label="t('viewer.more')"
      >
        <PtIcon name="more" />
      </button>
    </div>

    <div v-if="docs.active" class="pt-stage">
      <div
        class="pt-canvas"
        role="img"
        :style="canvasStyle"
        :aria-label="
          t('docs.canvasLabel', {
            w: docs.active.width,
            h: docs.active.height,
            zoom: docs.active.zoom
          })
        "
      >
        <div
          v-if="showGrid"
          class="pt-pxgrid"
          :style="{ backgroundSize: `${scale}px ${scale}px` }"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.image {
  width: 178px;
}
.zoom {
  width: 74px;
}
.sep {
  margin: 5px 2px;
}
</style>
