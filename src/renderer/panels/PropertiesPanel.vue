<script setup lang="ts">
// Panel Propiedades contextual: apariencia simple (un relleno y un contorno sólidos) de la forma seleccionada.
import { computed } from 'vue'
import { type Shape, getShape, solidFill, solidStroke, updateShape } from '@core/index'
import { useDocumentsStore } from '@/stores/documents'
import { hexToRgba, rgbaToHex } from '@/stores/colorUtil'
import { t } from '@/i18n'

const docs = useDocumentsStore()

const shape = computed<Shape | null>(() => {
  void docs.rev
  const s = docs.session
  if (!s || s.selectedShapes.length !== 1) return null
  return getShape(s, s.selectedShapes[0]!)
})
const count = computed(() => {
  void docs.rev
  return docs.session?.selectedShapes.length ?? 0
})

const fill = computed(() => shape.value?.appearance.fills[0] ?? null)
const stroke = computed(() => shape.value?.appearance.strokes[0] ?? null)

const hex = (c: { r: number; g: number; b: number; a: number }) =>
  rgbaToHex(((c.r << 24) | (c.g << 16) | (c.b << 8) | c.a) >>> 0).slice(0, 7)

function edit(label: string, key: string, fn: (s: Shape) => void): void {
  const sh = shape.value
  if (sh && docs.session) updateShape(docs.session, sh.id, fn, label, `prop:${sh.id}:${key}`)
}

function setColor(which: 'fill' | 'stroke', e: Event): void {
  const v = hexToRgba((e.target as HTMLInputElement).value)
  const c = { r: (v >>> 24) & 255, g: (v >>> 16) & 255, b: (v >>> 8) & 255, a: 255 }
  edit(which === 'fill' ? t('properties.fill') : t('properties.stroke'), which, (s) => {
    const a = which === 'fill' ? s.appearance.fills[0] : s.appearance.strokes[0]
    if (a) a.paint = { type: 'solid', color: { ...c, a: a.paint.color.a } }
  })
}
function toggle(which: 'fill' | 'stroke'): void {
  edit(t(`properties.${which}`), `${which}-toggle`, (s) => {
    const ap = s.appearance
    if (which === 'fill') {
      if (ap.fills[0]) {
        ap.stack = ap.stack.filter((i) => i !== ap.fills[0]!.id)
        ap.fills = []
      } else {
        const f = solidFill({ r: 255, g: 255, b: 255, a: 255 })
        ap.fills = [f]
        ap.stack = [f.id, ...ap.stack]
      }
    } else if (ap.strokes[0]) {
      ap.stack = ap.stack.filter((i) => i !== ap.strokes[0]!.id)
      ap.strokes = []
    } else {
      const st = solidStroke({ r: 0, g: 0, b: 0, a: 255 }, 1)
      if (s.kind !== 'line' && s.kind !== 'path') st.align = 'inside'
      ap.strokes = [st]
      ap.stack = [...ap.stack, st.id]
    }
  })
}
function num(e: Event, min: number, max: number): number | null {
  const v = Number.parseFloat((e.target as HTMLInputElement).value)
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null
}
function setWidth(e: Event): void {
  const v = num(e, 1, 64)
  if (v !== null)
    edit(t('properties.width'), 'width', (s) => {
      if (s.appearance.strokes[0]) s.appearance.strokes[0].width = Math.round(v)
    })
}
function setAlign(e: Event): void {
  const v = (e.target as HTMLSelectElement).value as 'center' | 'inside' | 'outside'
  edit(t('properties.align'), 'align', (s) => {
    if (s.appearance.strokes[0]) s.appearance.strokes[0].align = v
  })
}
function setRadius(e: Event): void {
  const v = num(e, 0, 1024)
  if (v !== null)
    edit(t('properties.radius'), 'radius', (s) => {
      if (s.kind === 'rect') s.radius = [v, v, v, v]
    })
}
function setOpacity(e: Event): void {
  const v = num(e, 0, 100)
  if (v !== null) edit(t('properties.opacity'), 'opacity', (s) => (s.opacity = v / 100))
}
</script>

<template>
  <div v-if="shape" class="props">
    <div class="pt-sectitle">{{ shape.name }}</div>
    <template v-if="shape.kind !== 'group'">
      <div class="row">
        <label class="chk">
          <input type="checkbox" :checked="!!fill" @change="toggle('fill')" />
          {{ t('properties.fill') }}
        </label>
        <input
          v-if="fill && fill.paint.type === 'solid'"
          type="color"
          :value="hex(fill.paint.color)"
          :aria-label="t('properties.fill')"
          @input="setColor('fill', $event)"
        />
      </div>
      <div class="row">
        <label class="chk">
          <input type="checkbox" :checked="!!stroke" @change="toggle('stroke')" />
          {{ t('properties.stroke') }}
        </label>
        <template v-if="stroke && stroke.paint.type === 'solid'">
          <input
            type="color"
            :value="hex(stroke.paint.color)"
            :aria-label="t('properties.stroke')"
            @input="setColor('stroke', $event)"
          />
          <input
            class="pt-input w"
            type="number"
            min="1"
            max="64"
            :value="stroke.width"
            :aria-label="t('properties.width')"
            @change="setWidth"
          />
          <select
            class="pt-select"
            :value="stroke.align"
            :aria-label="t('properties.align')"
            @change="setAlign"
          >
            <option value="center">{{ t('properties.alignCenter') }}</option>
            <option value="inside">{{ t('properties.alignInside') }}</option>
            <option value="outside">{{ t('properties.alignOutside') }}</option>
          </select>
        </template>
      </div>
    </template>
    <div v-if="shape.kind === 'rect'" class="row">
      <label>{{ t('properties.radius') }}</label>
      <input
        class="pt-input w"
        type="number"
        min="0"
        :value="shape.radius[0]"
        :aria-label="t('properties.radius')"
        @change="setRadius"
      />
    </div>
    <div class="row">
      <label>{{ t('properties.opacity') }}</label>
      <input
        class="pt-input w"
        type="number"
        min="0"
        max="100"
        :value="Math.round(shape.opacity * 100)"
        :aria-label="t('properties.opacity')"
        @change="setOpacity"
      />
    </div>
  </div>
  <p v-else-if="count > 1" class="pt-sec2 empty">{{ t('properties.many', { n: count }) }}</p>
  <p v-else class="pt-sec2 empty">{{ t('panels.emptyProperties') }}</p>
</template>

<style scoped>
.props {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--panel-pad-x);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.row > label:first-child {
  min-width: 64px;
}
.chk {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 72px;
}
.w {
  width: 52px;
}
input[type='color'] {
  width: 28px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border);
  background: none;
}
.empty {
  text-align: center;
  padding: var(--panel-pad-y);
}
</style>
