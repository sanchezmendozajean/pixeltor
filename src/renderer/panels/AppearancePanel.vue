<script setup lang="ts">
// Panel Apariencia (specs/05): pila ordenable de rellenos y contornos, cada uno con su pintura
// (sólido o degradado con modo de píxel), opacidad y modo de fusión.
import { computed, ref, watch } from 'vue'
import {
  BLEND_MODES,
  type BlendMode,
  type Fill,
  type GradientPaint,
  type Paint,
  type RGBA,
  type Shape,
  defaultGradient,
  getShape,
  newId,
  solidFill,
  solidStroke,
  updateShape
} from '@core/index'
// `Stroke` de @core/index es la clase de trazo de pincel; el contorno vectorial se importa del modelo.
import type { Stroke } from '@core/model/shapes'
import PtIcon from '@/components/PtIcon.vue'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { hexToRgba } from '@/stores/colorUtil'
import { t, type I18nKey } from '@/i18n'

const docs = useDocumentsStore()
const openId = ref<string | null>(null)

const shape = computed<Shape | null>(() => {
  void docs.rev
  const s = docs.session
  if (!s || s.selectedShapes.length !== 1) return null
  const sh = getShape(s, s.selectedShapes[0]!)
  return sh && sh.kind !== 'group' ? sh : null
})

type Row = { id: string; kind: 'fill' | 'stroke'; attr: Fill | Stroke }
const rows = computed<Row[]>(() => {
  // La forma se edita en el sitio (misma referencia): se relee con cada revisión del documento.
  void docs.rev
  const sh = shape.value
  if (!sh) return []
  const out: Row[] = []
  for (const id of [...sh.appearance.stack].reverse()) {
    const f = sh.appearance.fills.find((x) => x.id === id)
    const st = f ? null : sh.appearance.strokes.find((x) => x.id === id)
    if (f) out.push({ id, kind: 'fill', attr: f })
    else if (st) out.push({ id, kind: 'stroke', attr: st })
  }
  return out
})
const open = computed(() => rows.value.find((r) => r.id === openId.value) ?? null)
const ui = useUiStore()
watch(openId, (id) => (ui.activeAttr = id ?? ''))
watch(shape, (s, prev) => {
  if (!s || s.id !== prev?.id) openId.value = null
})

const hex = (c: RGBA) =>
  `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
const rgb = (h: string, a = 255): RGBA => {
  const v = hexToRgba(h)
  return { r: (v >>> 24) & 255, g: (v >>> 16) & 255, b: (v >>> 8) & 255, a }
}

function cssPaint(p: Paint): string {
  if (p.type === 'solid') return hex(p.color)
  const stops = [...p.stops]
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${hex(s.color)} ${Math.round(s.offset * 100)}%`)
    .join(', ')
  return p.type === 'linear'
    ? `linear-gradient(90deg, ${stops})`
    : p.type === 'radial'
      ? `radial-gradient(circle, ${stops})`
      : `conic-gradient(${stops})`
}

function edit(label: string, key: string, fn: (s: Shape) => void): void {
  const sh = shape.value
  if (sh && docs.session) updateShape(docs.session, sh.id, fn, label, `app:${sh.id}:${key}`)
}
function attrOf(s: Shape, id: string): Fill | Stroke | undefined {
  return (
    s.appearance.fills.find((x) => x.id === id) ?? s.appearance.strokes.find((x) => x.id === id)
  )
}
const mutate = (id: string, key: string, fn: (a: Fill | Stroke) => void) =>
  edit(t('appearance.edit'), `${id}:${key}`, (s) => {
    const a = attrOf(s, id)
    if (a) fn(a)
  })

// ---------- pila ----------
function add(kind: 'fill' | 'stroke'): void {
  const id = newId()
  edit(t(kind === 'fill' ? 'appearance.addFill' : 'appearance.addStroke'), `add-${id}`, (s) => {
    const a =
      kind === 'fill'
        ? solidFill({ r: 255, g: 255, b: 255, a: 255 })
        : solidStroke({ r: 0, g: 0, b: 0, a: 255 }, 1)
    a.id = id
    if (kind === 'stroke' && s.kind !== 'line' && s.kind !== 'path') (a as Stroke).align = 'inside'
    if (kind === 'fill') s.appearance.fills.push(a as Fill)
    else s.appearance.strokes.push(a as Stroke)
    s.appearance.stack.push(id)
  })
  openId.value = id
}
function remove(id: string): void {
  edit(t('appearance.remove'), `rm-${id}`, (s) => {
    s.appearance.fills = s.appearance.fills.filter((x) => x.id !== id)
    s.appearance.strokes = s.appearance.strokes.filter((x) => x.id !== id)
    s.appearance.stack = s.appearance.stack.filter((x) => x !== id)
  })
  if (openId.value === id) openId.value = null
}
function duplicate(id: string): void {
  const nid = newId()
  edit(t('appearance.duplicate'), `dup-${id}`, (s) => {
    const a = attrOf(s, id)
    if (!a) return
    const copy = JSON.parse(JSON.stringify(a)) as Fill | Stroke
    copy.id = nid
    if ('width' in a) s.appearance.strokes.push(copy as Stroke)
    else s.appearance.fills.push(copy as Fill)
    const at = s.appearance.stack.indexOf(id)
    s.appearance.stack.splice(at + 1, 0, nid)
  })
  openId.value = nid
}
/** dir = +1 sube (se dibuja más arriba), −1 baja. */
function move(id: string, dir: 1 | -1): void {
  edit(t('appearance.reorder'), `mv-${id}`, (s) => {
    const st = s.appearance.stack
    const i = st.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= st.length) return
    ;[st[i], st[j]] = [st[j]!, st[i]!]
  })
}

// ---------- pintura ----------
function setPaintType(row: Row, type: 'solid' | 'linear' | 'radial' | 'angular'): void {
  const sh = shape.value
  if (!sh) return
  mutate(row.id, 'type', (a) => {
    const p = a.paint
    const first: RGBA =
      p.type === 'solid' ? p.color : (p.stops[0]?.color ?? { r: 0, g: 0, b: 0, a: 255 })
    if (type === 'solid') a.paint = { type: 'solid', color: first }
    else if (p.type === 'solid') {
      // el segundo color contrasta con el primero para que el degradado se vea desde el principio
      const light = first.r * 0.3 + first.g * 0.59 + first.b * 0.11 > 128
      const to = light ? { r: 0, g: 0, b: 0, a: 255 } : { r: 255, g: 255, b: 255, a: 255 }
      a.paint = defaultGradient(sh, type, first, to)
    } else a.paint = { ...p, type }
  })
}
const isStroke = (a: Fill | Stroke): a is Stroke => 'width' in a
const grad = (a: Fill | Stroke): GradientPaint | null => (a.paint.type === 'solid' ? null : a.paint)

function setSolid(row: Row, e: Event): void {
  const h = (e.target as HTMLInputElement).value
  mutate(row.id, 'color', (a) => {
    if (a.paint.type === 'solid') a.paint = { type: 'solid', color: rgb(h, a.paint.color.a) }
  })
}
function setSolidAlpha(row: Row, e: Event): void {
  const v = Math.min(
    255,
    Math.max(0, Math.round((Number.parseFloat((e.target as HTMLInputElement).value) / 100) * 255))
  )
  if (Number.isFinite(v))
    mutate(row.id, 'alpha', (a) => {
      if (a.paint.type === 'solid') a.paint = { type: 'solid', color: { ...a.paint.color, a: v } }
    })
}
function setStop(row: Row, i: number, patch: { offset?: number; color?: RGBA }): void {
  mutate(row.id, `stop${i}`, (a) => {
    const g = grad(a)
    if (g && g.stops[i]) g.stops[i] = { ...g.stops[i]!, ...patch }
  })
}
function addStop(row: Row): void {
  mutate(row.id, 'addstop', (a) => {
    const g = grad(a)
    if (!g) return
    const sorted = [...g.stops].sort((p, q) => p.offset - q.offset)
    // en el hueco más ancho, con el color del punto medio
    let best = 0
    for (let i = 1; i < sorted.length - 1; i++)
      if (
        sorted[i + 1]!.offset - sorted[i]!.offset >
        sorted[best + 1]!.offset - sorted[best]!.offset
      )
        best = i
    const l = sorted[best]!
    const r = sorted[best + 1] ?? l
    const mix = (p: number, q: number) => Math.round((p + q) / 2)
    g.stops.push({
      offset: (l.offset + r.offset) / 2,
      color: {
        r: mix(l.color.r, r.color.r),
        g: mix(l.color.g, r.color.g),
        b: mix(l.color.b, r.color.b),
        a: mix(l.color.a, r.color.a)
      }
    })
  })
}
function removeStop(row: Row, i: number): void {
  mutate(row.id, 'rmstop', (a) => {
    const g = grad(a)
    if (g && g.stops.length > 2) g.stops.splice(i, 1)
  })
}
function reverseStops(row: Row): void {
  mutate(row.id, 'reverse', (a) => {
    const g = grad(a)
    if (g) g.stops = g.stops.map((s) => ({ ...s, offset: 1 - s.offset }))
  })
}
type ModeId = 'smooth' | 'bands' | 'dither'
function setMode(row: Row, mode: ModeId): void {
  mutate(row.id, 'mode', (a) => {
    const g = grad(a)
    if (!g) return
    const steps = 'steps' in g.pixelMode ? g.pixelMode.steps : 4
    g.pixelMode =
      mode === 'smooth'
        ? { mode: 'smooth' }
        : mode === 'bands'
          ? { mode: 'bands', steps }
          : { mode: 'dither', matrix: 'bayer4', steps }
  })
}
function setSteps(row: Row, e: Event): void {
  const v = Math.min(
    32,
    Math.max(2, Math.round(Number.parseFloat((e.target as HTMLInputElement).value)))
  )
  if (Number.isFinite(v))
    mutate(row.id, 'steps', (a) => {
      const g = grad(a)
      if (g && 'steps' in g.pixelMode) g.pixelMode.steps = v
    })
}
function setMatrix(row: Row, e: Event): void {
  const m = (e.target as HTMLSelectElement).value as 'bayer2' | 'bayer4' | 'bayer8' | 'checker'
  mutate(row.id, 'matrix', (a) => {
    const g = grad(a)
    if (g && g.pixelMode.mode === 'dither') g.pixelMode.matrix = m
  })
}

// ---------- atributo ----------
const num = (e: Event): number => Number.parseFloat((e.target as HTMLInputElement).value)
function setOpacity(row: Row, e: Event): void {
  const v = num(e)
  if (Number.isFinite(v))
    mutate(row.id, 'opacity', (a) => (a.opacity = Math.min(100, Math.max(0, v)) / 100))
}
function setStrokeNum(row: Row, key: 'width' | 'offset', e: Event): void {
  const v = Math.round(num(e))
  if (Number.isFinite(v))
    mutate(row.id, key, (a) => {
      if ('width' in a)
        a[key] = key === 'width' ? Math.min(64, Math.max(1, v)) : Math.min(64, Math.max(0, v))
    })
}
function setStrokeEnum(row: Row, key: 'align' | 'cap' | 'join', e: Event): void {
  const v = (e.target as HTMLSelectElement).value
  mutate(row.id, key, (a) => {
    if ('width' in a) (a as unknown as Record<string, string>)[key] = v
  })
}
function setBlend(row: Row, e: Event): void {
  const v = (e.target as HTMLSelectElement).value as BlendMode
  mutate(row.id, 'blend', (a) => (a.blendMode = v))
}
const toggle = (row: Row) => mutate(row.id, 'enabled', (a) => (a.enabled = !a.enabled))
const modeOf = (g: GradientPaint): ModeId =>
  g.pixelMode.mode === 'palette' ? 'smooth' : g.pixelMode.mode
</script>

<template>
  <div v-if="shape" class="app">
    <ul class="list pt-scroll" :aria-label="t('panels.appearance')">
      <li
        v-for="r in rows"
        :key="r.id"
        class="row"
        :class="{ 'is-current': r.id === openId, off: !r.attr.enabled }"
        @click="openId = r.id"
      >
        <button
          type="button"
          class="pt-lcol"
          :aria-pressed="r.attr.enabled"
          :aria-label="t('layers.visible')"
          @click.stop="toggle(r)"
        >
          <PtIcon :name="r.attr.enabled ? 'eye' : 'eyeOff'" />
        </button>
        <span class="sw" :style="{ background: cssPaint(r.attr.paint) }" />
        <span class="name">
          {{ r.kind === 'fill' ? t('properties.fill') : t('properties.stroke') }}
          <em v-if="isStroke(r.attr)">{{ r.attr.width }} px</em>
          <em v-else-if="r.attr.paint.type !== 'solid'">{{
            t(`appearance.type.${r.attr.paint.type}` as I18nKey)
          }}</em>
        </span>
        <button
          type="button"
          class="pt-iconbtn pt-iconbtn--20"
          :aria-label="t('appearance.up')"
          @click.stop="move(r.id, 1)"
        >
          <PtIcon name="chevUp" />
        </button>
        <button
          type="button"
          class="pt-iconbtn pt-iconbtn--20"
          :aria-label="t('appearance.down')"
          @click.stop="move(r.id, -1)"
        >
          <PtIcon name="chevDown" />
        </button>
      </li>
      <li v-if="!rows.length" class="pt-sec2 empty">{{ t('appearance.none') }}</li>
    </ul>

    <div v-if="open" class="editor pt-scroll">
      <div class="line">
        <label>{{ t('appearance.paint') }}</label>
        <select
          class="pt-select"
          :value="open.attr.paint.type"
          :aria-label="t('appearance.paint')"
          @change="
            setPaintType(
              open,
              ($event.target as HTMLSelectElement).value as
                'solid' | 'linear' | 'radial' | 'angular'
            )
          "
        >
          <option v-for="k in ['solid', 'linear', 'radial', 'angular']" :key="k" :value="k">
            {{ t(`appearance.type.${k}` as I18nKey) }}
          </option>
        </select>
      </div>

      <div v-if="open.attr.paint.type === 'solid'" class="line">
        <label>{{ t('appearance.color') }}</label>
        <input
          type="color"
          :value="hex(open.attr.paint.color)"
          :aria-label="t('appearance.color')"
          @input="setSolid(open, $event)"
        />
        <input
          class="pt-input w"
          type="number"
          min="0"
          max="100"
          :value="Math.round((open.attr.paint.color.a / 255) * 100)"
          :aria-label="t('appearance.alpha')"
          @change="setSolidAlpha(open, $event)"
        />
        <span class="pt-unit">%</span>
      </div>

      <template v-else>
        <div v-for="(s, i) in open.attr.paint.stops" :key="i" class="line">
          <label>{{ t('appearance.stop') }} {{ i + 1 }}</label>
          <input
            type="color"
            :value="hex(s.color)"
            :aria-label="t('appearance.color')"
            @input="
              setStop(open, i, { color: rgb(($event.target as HTMLInputElement).value, s.color.a) })
            "
          />
          <input
            class="pt-input w"
            type="number"
            min="0"
            max="100"
            :value="Math.round(s.offset * 100)"
            :aria-label="t('appearance.position')"
            @change="setStop(open, i, { offset: Math.min(100, Math.max(0, num($event))) / 100 })"
          />
          <span class="pt-unit">%</span>
          <button
            type="button"
            class="pt-iconbtn pt-iconbtn--20"
            :aria-label="t('appearance.remove')"
            :disabled="open.attr.paint.stops.length <= 2"
            @click="removeStop(open, i)"
          >
            <PtIcon name="close" />
          </button>
        </div>
        <div class="line">
          <button type="button" class="pt-btn pt-btn--secondary" @click="addStop(open)">
            {{ t('appearance.addStop') }}
          </button>
          <button type="button" class="pt-btn pt-btn--secondary" @click="reverseStops(open)">
            {{ t('appearance.reverse') }}
          </button>
        </div>
        <div class="line">
          <label>{{ t('appearance.pixelMode') }}</label>
          <select
            class="pt-select"
            :value="modeOf(open.attr.paint)"
            :aria-label="t('appearance.pixelMode')"
            @change="setMode(open, ($event.target as HTMLSelectElement).value as ModeId)"
          >
            <option value="smooth">{{ t('appearance.mode.smooth') }}</option>
            <option value="bands">{{ t('appearance.mode.bands') }}</option>
            <option value="dither">{{ t('appearance.mode.dither') }}</option>
          </select>
        </div>
        <div v-if="'steps' in open.attr.paint.pixelMode" class="line">
          <label>{{ t('appearance.steps') }}</label>
          <input
            class="pt-input w"
            type="number"
            min="2"
            max="32"
            :value="open.attr.paint.pixelMode.steps"
            :aria-label="t('appearance.steps')"
            @change="setSteps(open, $event)"
          />
          <select
            v-if="open.attr.paint.pixelMode.mode === 'dither'"
            class="pt-select"
            :value="open.attr.paint.pixelMode.matrix"
            :aria-label="t('appearance.matrix')"
            @change="setMatrix(open, $event)"
          >
            <option v-for="m in ['bayer2', 'bayer4', 'bayer8', 'checker']" :key="m" :value="m">
              {{ t(`appearance.matrices.${m}` as I18nKey) }}
            </option>
          </select>
        </div>
      </template>

      <template v-if="isStroke(open.attr)">
        <div class="line">
          <label>{{ t('properties.width') }}</label>
          <input
            class="pt-input w"
            type="number"
            min="1"
            max="64"
            :value="open.attr.width"
            @change="setStrokeNum(open, 'width', $event)"
          />
          <select
            class="pt-select"
            :value="open.attr.align"
            :aria-label="t('properties.align')"
            @change="setStrokeEnum(open, 'align', $event)"
          >
            <option value="center">{{ t('properties.alignCenter') }}</option>
            <option value="inside">{{ t('properties.alignInside') }}</option>
            <option value="outside">{{ t('properties.alignOutside') }}</option>
          </select>
        </div>
        <div v-if="open.attr.align !== 'center'" class="line">
          <label>{{ t('appearance.offset') }}</label>
          <input
            class="pt-input w"
            type="number"
            min="0"
            max="64"
            :value="open.attr.offset"
            @change="setStrokeNum(open, 'offset', $event)"
          />
        </div>
      </template>

      <div class="line">
        <label>{{ t('properties.opacity') }}</label>
        <input
          class="pt-input w"
          type="number"
          min="0"
          max="100"
          :value="Math.round(open.attr.opacity * 100)"
          @change="setOpacity(open, $event)"
        />
        <select
          class="pt-select"
          :value="open.attr.blendMode"
          :aria-label="t('layers.blend')"
          @change="setBlend(open, $event)"
        >
          <option v-for="m in BLEND_MODES" :key="m" :value="m">
            {{ t(`layers.modes.${m}` as I18nKey) }}
          </option>
        </select>
      </div>
      <div class="line">
        <button type="button" class="pt-btn pt-btn--secondary" @click="duplicate(open.id)">
          {{ t('appearance.duplicate') }}
        </button>
        <button type="button" class="pt-btn pt-btn--secondary" @click="remove(open.id)">
          {{ t('appearance.remove') }}
        </button>
      </div>
    </div>

    <div class="foot">
      <button type="button" class="pt-btn pt-btn--secondary" @click="add('fill')">
        + {{ t('properties.fill') }}
      </button>
      <button type="button" class="pt-btn pt-btn--secondary" @click="add('stroke')">
        + {{ t('properties.stroke') }}
      </button>
    </div>
  </div>
  <p v-else class="pt-sec2 none">{{ t('panels.emptyAppearance') }}</p>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 40%;
  overflow-y: auto;
  flex: none;
}
.row {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding-right: 6px;
  border-bottom: 1px solid var(--border-subtle);
}
.row:hover {
  background: var(--bg-hover);
}
.row.is-current {
  background: var(--bg-panel-raised);
}
.row.off .name,
.row.off .sw {
  opacity: 0.45;
}
.sw {
  width: 18px;
  height: 18px;
  flex: none;
  border-radius: 2px;
  box-shadow: 0 0 0 1px var(--border);
}
.name {
  flex: 1;
  min-width: 0;
}
.name em {
  font-style: normal;
  color: var(--text-secondary);
  margin-left: 4px;
}
button.pt-lcol {
  border: 0;
  background: none;
  padding: 0;
}
.editor {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--panel-pad-x);
  border-top: 1px solid var(--border-subtle);
}
.line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.line > label {
  min-width: 72px;
  color: var(--text-secondary);
}
.line .pt-select {
  flex: 1;
  min-width: 0;
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
.foot {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) var(--panel-pad-x);
  border-top: 1px solid var(--border-subtle);
}
.empty,
.none {
  text-align: center;
  padding: var(--panel-pad-y);
}
</style>
