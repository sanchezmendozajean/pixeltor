<script setup lang="ts">
// Panel Imágenes (specs/08): tira de miniaturas con duración en ms, selección múltiple,
// reordenar arrastrando y menú contextual. Colapsable: plegada muestra miniaturas pequeñas.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Bitmap,
  type ID,
  composeImage,
  deleteImages,
  duplicateImages,
  moveImage,
  reverseImages,
  setActiveImage,
  setImageDuration,
  setImageIncluded,
  totalDuration
} from '@core/index'
import PtIcon from '@/components/PtIcon.vue'
import ActionButton from '@/components/ActionButton.vue'
import { actionLabel, execute } from '@/actions/registry'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

const docs = useDocumentsStore()
const ui = useUiStore()

const images = computed(() => {
  void docs.rev
  const s = docs.session
  if (!s) return []
  return s.doc.images.map((img, i) => ({
    id: img.id,
    n: i + 1,
    name: img.name,
    ms: img.durationMs,
    included: img.includeInAnimation,
    active: img.id === s.activeImageId
  }))
})
const total = computed(() => {
  void docs.rev
  return docs.session ? totalDuration(docs.session) : 0
})
const current = computed(() => images.value.find((i) => i.active))

// ---- miniaturas ----
const canvases = new Map<ID, HTMLCanvasElement>()
function setCanvas(id: ID, el: unknown): void {
  if (el instanceof HTMLCanvasElement) canvases.set(id, el)
  else canvases.delete(id)
}
function drawThumbs(): void {
  const s = docs.session
  if (!s) return
  const SIZE = ui.stripExpanded ? 44 : 26
  for (const img of s.doc.images) {
    const el = canvases.get(img.id)
    if (!el) continue
    const full = new Bitmap(img.width, img.height)
    composeImage(img, s.rasters, full, undefined, { palettes: s.doc.palettes })
    const k = Math.min(SIZE / img.width, SIZE / img.height)
    const w = Math.max(1, Math.floor(img.width * k))
    const h = Math.max(1, Math.floor(img.height * k))
    el.width = w
    el.height = h
    const data = new ImageData(w, h)
    for (let y = 0; y < h; y++) {
      const sy = Math.min(img.height - 1, Math.floor(y / k))
      for (let x = 0; x < w; x++) {
        const sx = Math.min(img.width - 1, Math.floor(x / k))
        data.data.set(
          full.data.subarray((sy * img.width + sx) * 4, (sy * img.width + sx) * 4 + 4),
          (y * w + x) * 4
        )
      }
    }
    el.getContext('2d')!.putImageData(data, 0, 0)
  }
}
let raf = 0
function scheduleThumbs(): void {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(drawThumbs)
}
onMounted(scheduleThumbs)
onBeforeUnmount(() => cancelAnimationFrame(raf))
watch(() => [docs.rev, ui.stripExpanded, images.value.length], scheduleThumbs, { flush: 'post' })

// ---- selección ----
function pick(id: ID, e: MouseEvent): void {
  const s = docs.session
  if (!s) return
  if (e.shiftKey && ui.selectedImages.length) {
    const ids = s.doc.images.map((i) => i.id)
    const a = ids.indexOf(ui.selectedImages[0]!)
    const b = ids.indexOf(id)
    ui.selectedImages = ids.slice(Math.min(a, b), Math.max(a, b) + 1)
  } else if (e.ctrlKey || e.metaKey) {
    ui.selectedImages = ui.selectedImages.includes(id)
      ? ui.selectedImages.filter((x) => x !== id)
      : [...ui.selectedImages, id]
  } else ui.selectedImages = [id]
  setActiveImage(s, id)
}
const isSel = (id: ID): boolean => ui.selectedImages.includes(id)
/** Imágenes a las que afectan las acciones: la selección o, si no hay, la activa. */
const targets = (): ID[] => {
  const s = docs.session
  if (!s) return []
  const sel = ui.selectedImages.filter((id) => s.doc.images.some((i) => i.id === id))
  return sel.length ? sel : [s.activeImageId]
}

// ---- duración ----
function onDuration(id: ID, e: Event): void {
  const v = Number.parseInt((e.target as HTMLInputElement).value, 10)
  if (docs.session && Number.isFinite(v)) {
    const ids = isSel(id) ? targets() : [id]
    setImageDuration(docs.session, ids, v)
  }
}

// ---- reordenar arrastrando ----
const dragId = ref<ID | null>(null)
const overIndex = ref<number | null>(null)
function onDrop(index: number): void {
  const id = dragId.value
  dragId.value = null
  overIndex.value = null
  if (id && docs.session) moveImage(docs.session, id, index)
}

// ---- menú contextual ----
// el panel está al pie de la ventana: el menú se abre hacia arriba
const menu = ref<{ id: ID; x: number; bottom: number } | null>(null)
function openMenu(id: ID, e: MouseEvent): void {
  if (!isSel(id)) {
    ui.selectedImages = [id]
    if (docs.session) setActiveImage(docs.session, id)
  }
  menu.value = { id, x: e.clientX, bottom: window.innerHeight - e.clientY }
}
function dismiss(e: Event): void {
  if (!menu.value) return
  if (e instanceof KeyboardEvent && e.key !== 'Escape') return
  if (e instanceof PointerEvent && (e.target as HTMLElement).closest('.framemenu')) return
  menu.value = null
}
onMounted(() => {
  document.addEventListener('pointerdown', dismiss, true)
  document.addEventListener('keydown', dismiss, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', dismiss, true)
  document.removeEventListener('keydown', dismiss, true)
})
const durationDraft = ref(100)
function run(fn: () => void): void {
  menu.value = null
  fn()
}
const excluded = computed(() => {
  const ids = new Set(targets())
  return images.value.filter((i) => ids.has(i.id)).every((i) => !i.included)
})
</script>

<template>
  <section class="pt-strip" :class="{ open: ui.stripExpanded }" :aria-label="t('frames.title')">
    <div class="bar">
      <button
        type="button"
        class="pt-iconbtn"
        :data-tip="t(ui.stripExpanded ? 'frames.collapse' : 'frames.expand')"
        :aria-label="t(ui.stripExpanded ? 'frames.collapse' : 'frames.expand')"
        @click="ui.stripExpanded = !ui.stripExpanded"
      >
        <PtIcon :name="ui.stripExpanded ? 'chevDown' : 'chevUp'" />
      </button>
      <span class="pt-strip__title">{{ t('frames.title') }}</span>
      <ActionButton id="view.play" />
      <span class="pt-sep pt-sep--inset" />
      <div
        class="frames"
        role="listbox"
        :aria-label="t('frames.title')"
        @click.self="ui.selectedImages = []"
      >
        <div
          v-for="(f, i) in images"
          :key="f.id"
          class="cell"
          :class="{ over: overIndex === i && dragId !== f.id }"
          @dragover.prevent="overIndex = i"
          @dragleave="overIndex = null"
          @drop.prevent="onDrop(i)"
        >
          <button
            type="button"
            class="pt-frame"
            :class="{
              'pt-frame--sm': !ui.stripExpanded,
              'is-active': f.active,
              'is-sel': !f.active && isSel(f.id),
              'is-excluded': !f.included
            }"
            role="option"
            :aria-selected="f.active"
            :title="f.name"
            :aria-label="`${t('viewer.image')} ${f.n}, ${f.ms} ms`"
            draggable="true"
            @click="pick(f.id, $event)"
            @contextmenu.prevent="openMenu(f.id, $event)"
            @dragstart="dragId = f.id"
            @dragend="((dragId = null), (overIndex = null))"
          >
            <canvas :ref="(el) => setCanvas(f.id, el)" class="art" />
            <span class="pt-fnum">{{ f.n }}</span>
            <span v-if="!f.included" class="pt-fexcl" aria-hidden="true">
              <PtIcon name="eyeOff" />
            </span>
          </button>
          <input
            v-if="ui.stripExpanded"
            class="pt-input pt-fdur"
            type="number"
            min="10"
            max="60000"
            step="10"
            :value="f.ms"
            :aria-label="t('frames.duration')"
            @change="onDuration(f.id, $event)"
          />
        </div>
        <ActionButton id="image.new" />
      </div>
      <div class="pt-spacer" />
      <span v-if="current" class="pt-sec2">
        {{ t('frames.empty', { n: current.n, total: images.length }) }} · {{ current.ms }} ms
      </span>
      <span class="pt-sep pt-sep--inset" />
      <span class="pt-mono pt-sec2 total">{{ t('frames.total', { ms: total }) }}</span>
    </div>

    <Teleport to="body">
      <div
        v-if="menu"
        class="pt-menu framemenu"
        role="menu"
        :style="{ left: `${menu.x}px`, bottom: `${menu.bottom}px` }"
      >
        <div class="pt-mi" role="menuitem" @click="run(() => execute('image.new'))">
          {{ actionLabel('image.new') }}
        </div>
        <div
          class="pt-mi"
          role="menuitem"
          @click="run(() => docs.session && duplicateImages(docs.session, targets()))"
        >
          {{ t('frames.menu.duplicate') }}
        </div>
        <div
          class="pt-mi"
          role="menuitem"
          :class="{ 'is-disabled': targets().length >= images.length }"
          @click="run(() => docs.session && deleteImages(docs.session, targets()))"
        >
          {{ t('frames.menu.delete') }}
        </div>
        <div class="pt-msep" role="separator" />
        <div class="pt-mi dur" role="menuitem" @click.stop>
          {{ t('frames.menu.duration') }}
          <input
            v-model.number="durationDraft"
            class="pt-input"
            type="number"
            min="10"
            max="60000"
            step="10"
            :aria-label="t('frames.menu.duration')"
            @keydown.enter="
              run(() => docs.session && setImageDuration(docs.session, targets(), durationDraft))
            "
          />
        </div>
        <div
          class="pt-mi"
          role="menuitem"
          :class="{ 'is-disabled': targets().length < 2 }"
          @click="run(() => docs.session && reverseImages(docs.session, targets()))"
        >
          {{ t('frames.menu.reverse') }}
        </div>
        <div
          class="pt-mi"
          role="menuitem"
          @click="run(() => docs.session && setImageIncluded(docs.session, targets(), excluded))"
        >
          {{ t(excluded ? 'frames.menu.include' : 'frames.menu.exclude') }}
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.pt-strip.open {
  height: auto;
}
.bar {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 32px;
}
.pt-strip.open .bar {
  padding: 4px 0;
  align-items: flex-start;
}
.frames {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-1);
  overflow-x: auto;
  min-width: 0;
}
.pt-strip.open .frames {
  align-items: flex-start;
}
.cell {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.cell.over {
  box-shadow: -2px 0 0 var(--accent);
}
.art {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  image-rendering: pixelated;
}
.total {
  font-size: 10.5px;
}
.framemenu {
  position: fixed;
  z-index: 80;
  min-width: 180px;
}
.dur {
  gap: var(--space-2);
}
.dur .pt-input {
  width: 64px;
}
</style>
