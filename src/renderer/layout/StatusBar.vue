<script setup lang="ts">
import { computed } from 'vue'
import { shapesPixelSize } from '@core/index'
import { rgbaToHex } from '@/stores/colorUtil'
import PtIcon from '@/components/PtIcon.vue'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { actionLabel } from '@/actions/registry'
import { t, type I18nKey } from '@/i18n'

const docs = useDocumentsStore()
const ui = useUiStore()
/** Tamaño de la imagen activa; depende de `rev` porque la sesión no es reactiva. */
const imageSize = computed(() => {
  void docs.rev
  const i = docs.session?.image
  return i ? { w: i.width, h: i.height } : null
})
const imageIndex = computed(() => {
  void docs.rev
  const s = docs.session
  return s ? s.doc.images.findIndex((i) => i.id === s.activeImageId) + 1 : 1
})

/** Tamaño en píxeles de la forma que se dibuja o, si no hay ninguna, de la selección. */
const shapeSize = computed(() => {
  void docs.rev
  if (docs.drawingSize) return docs.drawingSize
  const s = docs.session
  return s && s.selectedShapes.length ? shapesPixelSize(s, s.selectedShapes) : null
})

/** Color del píxel bajo el cursor en la capa activa (#RRGGBB[AA]). */
const pixelColor = computed(() => {
  const s = docs.session
  const c = docs.cursor
  if (!s || !c) return null
  const img = s.image
  if (c.x < 0 || c.y < 0 || c.x >= img.width || c.y >= img.height) return null
  const v = s.bitmapOf(s.activeLayerId).get(c.x, c.y)
  return (v & 255) === 0 ? null : rgbaToHex(v)
})

type SnapKey = keyof typeof ui.snap
const SNAPS: { key: SnapKey; icon: string; label: I18nKey }[] = [
  { key: 'grid', icon: 'gridPx', label: 'status.snapGrid' },
  { key: 'anchor', icon: 'snapAnchor', label: 'status.snapAnchor' },
  { key: 'paths', icon: 'paths', label: 'status.snapPaths' },
  { key: 'guides', icon: 'snapGuide', label: 'status.snapGuides' },
  { key: 'canvas', icon: 'snapCanvas', label: 'status.snapCanvas' }
]
</script>

<template>
  <footer class="pt-status" :aria-label="t('status.label')">
    <div class="pt-seg first" :data-tip="t('status.size')">
      <span class="pt-mono small"
        ><b>{{ imageSize?.w ?? t('status.none') }} × {{ imageSize?.h ?? t('status.none') }}</b>
        px</span
      >
    </div>
    <div v-if="shapeSize" class="pt-seg" :data-tip="t('status.shapeSize')">
      <PtIcon name="rect" class="tiny" />
      <span class="pt-mono small"
        ><b>{{ shapeSize.w }} × {{ shapeSize.h }}</b> px</span
      >
    </div>
    <div class="pt-seg" :data-tip="t('status.cursor')">
      <PtIcon name="cursor" class="tiny" />
      <span class="pt-mono small"
        >x <b>{{ docs.cursor?.x ?? t('status.none') }}</b> y
        <b>{{ docs.cursor?.y ?? t('status.none') }}</b></span
      >
    </div>
    <div class="pt-seg" :data-tip="t('status.color')">
      <span
        class="pt-sw pt-sw--sm"
        :class="{ 'pt-sw--none': !pixelColor }"
        :style="pixelColor ? { background: pixelColor } : undefined"
      />
      <span class="pt-mono small"
        ><b>{{ pixelColor ?? t('status.none') }}</b></span
      >
    </div>
    <div class="pt-seg">
      {{ t('status.layer') }}: <b>{{ docs.session?.activeLayer.name ?? t('status.none') }}</b>
    </div>
    <div class="pt-seg">
      {{ t('status.image') }} <b>{{ imageIndex }}</b
      >/{{ docs.session?.doc.images.length ?? 1 }}
    </div>
    <div v-if="ui.fxBusy" class="pt-seg" role="status">{{ t('status.calculating') }}</div>
    <div class="pt-spacer" />
    <div class="pt-seg pt-seg--r snaps" role="group" :aria-label="t('status.snapLabel')">
      <button
        v-for="s in SNAPS"
        :key="s.key"
        type="button"
        class="pt-snap"
        :class="{ 'is-on': ui.snap[s.key] }"
        :aria-pressed="ui.snap[s.key]"
        :data-tip="t(s.label)"
        :aria-label="t(s.label)"
        @click="ui.snap[s.key] = !ui.snap[s.key]"
      >
        <PtIcon :name="s.icon" />
      </button>
      <button
        type="button"
        class="pt-snap pt-snap--smart"
        :class="{ 'is-on': ui.snap.smart }"
        :aria-pressed="ui.snap.smart"
        :aria-label="actionLabel('view.smartGuides')"
        :data-tip="actionLabel('view.smartGuides')"
        data-action="view.smartGuides"
        @click="ui.snap.smart = !ui.snap.smart"
      >
        <PtIcon name="magnet" />
      </button>
    </div>
  </footer>
</template>

<style scoped>
.first {
  padding-left: var(--space-3);
}
.small {
  font-size: 10.5px;
}
.tiny {
  width: 12px;
  height: 12px;
}
.snaps {
  gap: var(--space-1);
  padding: 0 var(--space-3);
}
</style>
