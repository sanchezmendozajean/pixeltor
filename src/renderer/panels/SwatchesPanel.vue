<script setup lang="ts">
// Muestras: paleta del documento (se guarda en el .pixeltor), biblioteca de la app, importar y
// exportar (.gpl, .pal, .hex, .png), rampas, orden y extracción. Las muestras pueden ser globales:
// al editarlas se recolorean las formas enlazadas.
import { computed, ref } from 'vue'
import {
  Bitmap,
  LIBRARY,
  activatePalette,
  activePalette,
  addSwatch,
  appendColors,
  colorHex,
  composeImage,
  documentPalettes,
  extractColors,
  hexToColor,
  installPalette,
  libraryColors,
  linkPaint,
  makePalette,
  makeRamp,
  moveSwatch,
  parsePalette,
  removeSwatch,
  serializePalette,
  setSwatchColor,
  sortPalette,
  swatchUsage,
  updateShape,
  type PaletteFormat
} from '@core/index'
import PtIcon from '@/components/PtIcon.vue'
import { useColorsStore } from '@/stores/colors'
import { setWorkingColor } from '@/app/colorOps'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import ColorButton from '@/components/ColorButton.vue'
import { t } from '@/i18n'

const colors = useColorsStore()
const docs = useDocumentsStore()
const ui = useUiStore()

const palette = computed(() => {
  void docs.rev
  return docs.session ? { ...activePalette(docs.session) } : null
})
/** Copia nueva en cada cambio: el modelo no es reactivo y la lista debe redibujarse. */
const swatches = computed(() => {
  void docs.rev
  return palette.value ? [...palette.value.swatches] : []
})
const palettes = computed(() => {
  void docs.rev
  return docs.session ? documentPalettes(docs.session) : []
})
const current = computed(() => (colors.target === 'fill' ? colors.fill : colors.stroke))
const sel = ref<string | null>(null)
const selected = computed(() => swatches.value.find((s) => s.id === sel.value) ?? null)
const usage = computed(() => {
  void docs.rev
  return docs.session && selected.value ? swatchUsage(docs.session, selected.value.id) : 0
})

const hex = (c: { r: number; g: number; b: number }): string => `#${colorHex({ ...c, a: 255 })}`

function apply(id: string): void {
  const sw = palette.value?.swatches.find((s) => s.id === id)
  if (!sw) return
  sel.value = id
  setWorkingColor(colors.target, hex(sw.color).toUpperCase())
}
function add(): void {
  const c = hexToColor(current.value.slice(0, 7))
  if (!c || !docs.session) return
  sel.value = addSwatch(docs.session, c)?.id ?? sel.value
}
function remove(id: string): void {
  if (!docs.session) return
  removeSwatch(docs.session, id)
  if (sel.value === id) sel.value = null
}
function editColor(h: string): void {
  const c = hexToColor(h)
  if (c && selected.value && docs.session) setSwatchColor(docs.session, selected.value.id, c)
}

/** Enlaza a la muestra los rellenos y contornos sólidos de la selección que tengan su color. */
function linkSelection(unlink = false): void {
  const s = docs.session
  const sw = selected.value
  if (!s || !sw) return
  for (const id of s.selectedShapes)
    updateShape(
      s,
      id,
      (shape) => {
        const paints = [...shape.appearance.fills, ...shape.appearance.strokes].map((x) => x.paint)
        for (const p of paints) {
          if (p.type !== 'solid') continue
          const same =
            p.color.r === sw.color.r && p.color.g === sw.color.g && p.color.b === sw.color.b
          if (unlink && p.swatchId === sw.id) linkPaint(p, null)
          else if (!unlink && same) linkPaint(p, sw.id)
        }
      },
      unlink ? t('swatches.unlink') : t('swatches.link')
    )
}

// ---- arrastrar para reordenar ----
const dragId = ref<string | null>(null)
function drop(to: number): void {
  if (dragId.value && docs.session) moveSwatch(docs.session, dragId.value, to)
  dragId.value = null
}

// ---- paletas ----
function choose(e: Event): void {
  const v = (e.target as HTMLSelectElement).value
  if (docs.session && v) activatePalette(docs.session, v)
}
function fromLibrary(e: Event): void {
  const sel2 = e.target as HTMLSelectElement
  const lib = LIBRARY.find((l) => l.key === sel2.value)
  sel2.value = ''
  if (lib && docs.session) installPalette(docs.session, makePalette(lib.name, libraryColors(lib)))
}
async function importFile(): Promise<void> {
  const f = await window.pixeltor.palettes.import()
  if (!f || !docs.session) return
  const m = /^(.*?)([^\\/]*?)\.([a-z]+)$/i.exec(f.path)
  const ext = (m?.[3] ?? '').toLowerCase() as PaletteFormat
  if (!['gpl', 'pal', 'hex', 'png'].includes(ext)) {
    ui.toast = t('swatches.badFormat')
    return
  }
  try {
    installPalette(docs.session, parsePalette(f.bytes, ext, m?.[2] ?? t('swatches.imported')))
  } catch (e) {
    ui.toast = e instanceof Error ? e.message : t('swatches.badFormat')
  }
}
async function exportFile(): Promise<void> {
  const p = palette.value
  if (!p) return
  const bytes = Object.fromEntries(
    (['gpl', 'pal', 'hex', 'png'] as PaletteFormat[]).map((f) => [f, serializePalette(p, f)])
  ) as Record<PaletteFormat, Uint8Array>
  await window.pixeltor.palettes.export({ suggestedName: p.name, bytes })
}

// ---- rampa, orden, extraer ----
const rampN = ref(5)
const rampShift = ref(0)
function ramp(): void {
  const a = hexToColor(colors.fill.slice(0, 7))
  const b = hexToColor(colors.stroke.slice(0, 7))
  if (!a || !b || !docs.session) return
  appendColors(docs.session, makeRamp(a, b, rampN.value, rampShift.value), t('swatches.ramp'))
}
function extract(): void {
  const s = docs.session
  if (!s) return
  const bmp = new Bitmap(s.image.width, s.image.height)
  composeImage(s.image, s.rasters, bmp)
  const n = appendColors(s, extractColors(bmp, 256), t('swatches.extract'))
  ui.toast = t('swatches.extracted', { n })
}
</script>

<template>
  <div v-if="palette" class="sw">
    <div class="row">
      <select
        class="pt-select grow"
        :value="palette.id"
        :aria-label="t('swatches.palette')"
        @change="choose"
      >
        <option v-for="p in palettes" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <select
        class="pt-select lib"
        :aria-label="t('swatches.library')"
        value=""
        @change="fromLibrary"
      >
        <option value="" disabled>{{ t('swatches.library') }}</option>
        <option v-for="l in LIBRARY" :key="l.key" :value="l.key">{{ l.name }}</option>
      </select>
    </div>

    <div class="pt-swgrid" @dragover.prevent>
      <button
        v-for="(s, i) in swatches"
        :key="s.id"
        type="button"
        class="pt-swcell"
        :class="{ 'is-on': s.id === sel, global: swatchUsage(docs.session!, s.id) > 0 }"
        :style="{ background: hex(s.color) }"
        :title="s.name ?? hex(s.color).toUpperCase()"
        :aria-label="t('swatches.apply', { hex: hex(s.color).toUpperCase() })"
        draggable="true"
        @click="apply(s.id)"
        @contextmenu.prevent="remove(s.id)"
        @dragstart="dragId = s.id"
        @drop.prevent="drop(i)"
      />
    </div>

    <div class="row">
      <button
        type="button"
        class="pt-iconbtn"
        :data-tip="t('swatches.add')"
        :aria-label="t('swatches.add')"
        @click="add"
      >
        <PtIcon name="plus" />
      </button>
      <button type="button" class="pt-btn pt-btn--secondary" @click="importFile">
        {{ t('swatches.import') }}
      </button>
      <button type="button" class="pt-btn pt-btn--secondary" @click="exportFile">
        {{ t('swatches.export') }}
      </button>
    </div>

    <div v-if="selected" class="row edit">
      <ColorButton
        :color="hex(selected.color)"
        :aria-label="t('swatches.edit')"
        @pick="editColor"
      />
      <span class="info"
        >{{ hex(selected.color).toUpperCase() }} · {{ t('swatches.usage', { n: usage }) }}</span
      >
      <button type="button" class="pt-btn pt-btn--secondary" @click="linkSelection(false)">
        {{ t('swatches.link') }}
      </button>
      <button
        v-if="usage"
        type="button"
        class="pt-btn pt-btn--secondary"
        @click="linkSelection(true)"
      >
        {{ t('swatches.unlink') }}
      </button>
    </div>

    <div class="row">
      <button
        type="button"
        class="pt-btn pt-btn--secondary"
        @click="docs.session && sortPalette(docs.session, 'hue')"
      >
        {{ t('swatches.sortHue') }}
      </button>
      <button
        type="button"
        class="pt-btn pt-btn--secondary"
        @click="docs.session && sortPalette(docs.session, 'lightness')"
      >
        {{ t('swatches.sortLight') }}
      </button>
      <button type="button" class="pt-btn pt-btn--secondary" @click="extract">
        {{ t('swatches.extractBtn') }}
      </button>
    </div>

    <div class="row ramp">
      <label
        >{{ t('swatches.rampN') }}
        <input v-model.number="rampN" type="number" min="2" max="64" class="pt-input num" />
      </label>
      <label
        >{{ t('swatches.rampShift') }}
        <input v-model.number="rampShift" type="number" min="-90" max="90" class="pt-input num" />
      </label>
      <button
        type="button"
        class="pt-btn pt-btn--secondary"
        :title="t('swatches.rampTip')"
        @click="ramp"
      >
        {{ t('swatches.ramp') }}
      </button>
    </div>
  </div>
  <p v-else class="none">{{ t('panels.emptySwatches') }}</p>
</template>

<style scoped>
.sw {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--panel-pad-x);
}
.row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  flex-wrap: wrap;
}
.grow {
  flex: 1;
  min-width: 0;
}
.lib {
  width: 90px;
}
.info {
  font-size: var(--fs-sm);
  color: var(--text-secondary);
}
.num {
  width: 48px;
}
.ramp label {
  display: flex;
  flex-direction: column;
  font-size: var(--fs-sm);
  color: var(--text-secondary);
}
.pt-swcell.global {
  outline: 1px dotted var(--accent);
  outline-offset: -2px;
}
.none {
  padding: var(--space-3);
  color: var(--text-secondary);
}
</style>
