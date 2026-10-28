<script setup lang="ts">
// Panel Degradado (como el de Illustrator): vista previa, tipo, ángulo, barra con paradas
// debajo y puntos medios (rombos) encima, y opacidad / ubicación de la parada seleccionada.
// La barra se pinta con el mismo evaluador del core, así que muestra el modo de píxel real.
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  type GradientPaint,
  type RGBA,
  type Shape,
  colorAt,
  defaultGradient,
  commitLiveEdit,
  getShape,
  liveUpdateShape,
  gradientSampler,
  sortedStops,
  updateShape
} from '@core/index'
import PtIcon from '@/components/PtIcon.vue'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { findGradientAttr, type Attr } from '@/tools/gradientTarget'
import { hexToRgba } from '@/stores/colorUtil'
import { t, type I18nKey } from '@/i18n'

const docs = useDocumentsStore()
const ui = useUiStore()

const shape = computed<Shape | null>(() => {
  void docs.rev
  const s = docs.session
  if (!s || s.selectedShapes.length !== 1) return null
  const sh = getShape(s, s.selectedShapes[0]!)
  return sh && sh.kind !== 'group' ? sh : null
})

/** Atributo activo: el elegido en Apariencia o, si no, el primer degradado de la pila. */
const attr = computed<Attr | null>(() => {
  void docs.rev
  const sh = shape.value
  return sh ? findGradientAttr(sh, ui.activeAttr) : null
})
const grad = computed<GradientPaint | null>(() => {
  void docs.rev
  const a = attr.value
  return a && a.paint.type !== 'solid' ? a.paint : null
})

const hex = (c: RGBA) =>
  `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
const rgb = (h: string, a: number): RGBA => {
  const v = hexToRgba(h)
  return { r: (v >>> 24) & 255, g: (v >>> 16) & 255, b: (v >>> 8) & 255, a }
}

// ---------- edición ----------
/** Con `live`, el cambio se ve al instante pero el paso de historial se crea al llamar a `endLive`. */
function mutate(key: string, fn: (g: GradientPaint, shape: Shape) => void, live?: string): void {
  const sh = shape.value
  const a = attr.value
  if (!sh || !a || !docs.session) return
  const apply = (s: Shape): void => {
    const at = [...s.appearance.fills, ...s.appearance.strokes].find((x) => x.id === a.id)
    if (at && at.paint.type !== 'solid') fn(at.paint, s)
  }
  if (live) liveUpdateShape(docs.session, sh.id, live, t('gradient.edit'), apply)
  else updateShape(docs.session, sh.id, apply, t('gradient.edit'), `grad:${sh.id}:${a.id}:${key}`)
}
function endLive(live: string): void {
  if (docs.session) commitLiveEdit(docs.session, live)
}

/** Las paradas se mantienen ordenadas; `sel` sigue a la parada movida. */
// La parada seleccionada se comparte con la herramienta Degradado del lienzo.
const sel = computed({
  get: () => ui.activeStop,
  set: (v: number) => (ui.activeStop = v)
})
// El degradado se edita en el sitio (misma referencia): estos derivados se relevan con cada revisión.
const sorted = computed(() => (docs.rev, grad.value ? sortedStops(grad.value.stops) : []))
watch(
  () => grad.value?.stops.length,
  () => {
    if (sel.value >= sorted.value.length) sel.value = Math.max(0, sorted.value.length - 1)
  }
)
const current = computed(() => sorted.value[sel.value] ?? null)

function applyGradient(): void {
  const sh = shape.value
  const a = attr.value ?? (sh ? (sh.appearance.fills[0] ?? sh.appearance.strokes[0] ?? null) : null)
  if (!sh || !a || !docs.session) return
  ui.activeAttr = a.id
  updateShape(
    docs.session,
    sh.id,
    (s) => {
      const at = [...s.appearance.fills, ...s.appearance.strokes].find((x) => x.id === a.id)
      if (!at || at.paint.type !== 'solid') return
      const c = at.paint.color
      const light = c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 128
      at.paint = defaultGradient(
        s,
        'linear',
        c,
        light ? { r: 0, g: 0, b: 0, a: 255 } : { r: 255, g: 255, b: 255, a: 255 }
      )
    },
    t('gradient.apply')
  )
}

function setType(type: GradientPaint['type']): void {
  mutate('type', (g, s) => {
    // lineal va de borde a borde; radial y angular parten del centro de la forma
    if ((g.type === 'linear') !== (type === 'linear')) {
      const d = defaultGradient(s, type, g.stops[0]!.color, g.stops[g.stops.length - 1]!.color)
      g.from = d.from
      g.to = d.to
    }
    g.type = type
  })
}

// Ángulo de la dirección inicio → fin (0° = de izquierda a derecha).
const angle = computed(() => {
  void docs.rev
  const g = grad.value
  if (!g) return 0
  return (
    Math.round(((Math.atan2(g.to.y - g.from.y, g.to.x - g.from.x) * 180) / Math.PI) * 100) / 100
  )
})
function setAngle(e: Event): void {
  const v = Number.parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  mutate('angle', (g) => {
    const len = Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y) || 1
    const r = (v * Math.PI) / 180
    g.to = { x: g.from.x + Math.cos(r) * len, y: g.from.y + Math.sin(r) * len }
  })
}

function setStopField(patch: { offset?: number; color?: RGBA }, live?: string): void {
  if (!current.value) return
  mutate(
    `stop${sel.value}`,
    (g) => {
      g.stops = sortedStops(g.stops)
      const s = g.stops[sel.value]
      if (!s) return
      if (patch.offset !== undefined) s.offset = Math.min(1, Math.max(0, patch.offset))
      if (patch.color) s.color = patch.color
      const moved = s
      g.stops = sortedStops(g.stops)
      sel.value = g.stops.indexOf(moved)
    },
    live
  )
}
function onLocation(e: Event): void {
  const v = Number.parseFloat((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) setStopField({ offset: v / 100 })
}
function onOpacity(e: Event): void {
  const v = Number.parseFloat((e.target as HTMLInputElement).value)
  const c = current.value?.color
  if (Number.isFinite(v) && c)
    setStopField({ color: { ...c, a: Math.round((Math.min(100, Math.max(0, v)) / 100) * 255) } })
}
function onColor(e: Event): void {
  const c = current.value?.color
  // @input llega mientras se elige el color: se aplica en vivo y se registra al cerrar el selector
  if (c) setStopField({ color: rgb((e.target as HTMLInputElement).value, c.a) }, 'stop-color')
}
function removeStop(): void {
  if (sorted.value.length <= 2) return
  mutate('remove', (g) => {
    g.stops = sortedStops(g.stops)
    g.stops.splice(sel.value, 1)
  })
  sel.value = Math.max(0, sel.value - 1)
}
async function pickColor(): Promise<void> {
  const ED = (
    window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }
  ).EyeDropper
  const c = current.value?.color
  if (!ED || !c) return
  try {
    const r = await new ED().open()
    setStopField({ color: rgb(r.sRGBHex, c.a) })
  } catch {
    // cancelado por el usuario
  }
}

// ---------- barra ----------
const bar = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const BAR_W = 224
const BAR_H = 16

/** Pinta la barra con el evaluador del core (incluye bandas y tramado). */
function draw(): void {
  const el = canvas.value
  const g = grad.value
  if (!el) return
  const ctx = el.getContext('2d')!
  if (!g) {
    ctx.clearRect(0, 0, BAR_W, BAR_H)
    return
  }
  const line: GradientPaint = {
    ...g,
    type: 'linear',
    from: { x: 0, y: 0 },
    to: { x: BAR_W, y: 0 }
  }
  const sample = gradientSampler(line, [1, 0, 0, 1, 0, 0])
  const img = ctx.createImageData(BAR_W, BAR_H)
  for (let y = 0; y < BAR_H; y++)
    for (let x = 0; x < BAR_W; x++) {
      // sobre un fondo de tablero para ver el alfa
      const c = sample(x, y)
      const chk = ((x >> 3) + (y >> 3)) & 1 ? 200 : 255
      const a = c.a / 255
      const i = (y * BAR_W + x) * 4
      img.data[i] = Math.round(c.r * a + chk * (1 - a))
      img.data[i + 1] = Math.round(c.g * a + chk * (1 - a))
      img.data[i + 2] = Math.round(c.b * a + chk * (1 - a))
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
}
onMounted(draw)
watch(
  () => [docs.rev, attr.value?.id],
  async () => {
    await nextTick()
    draw()
  }
)

const preview = computed(() => {
  void docs.rev
  const g = grad.value
  if (!g) return 'transparent'
  const stops = sortedStops(g.stops)
    .map(
      (s) => `rgba(${s.color.r},${s.color.g},${s.color.b},${s.color.a / 255}) ${s.offset * 100}%`
    )
    .join(',')
  return g.type === 'linear'
    ? `linear-gradient(90deg,${stops})`
    : g.type === 'radial'
      ? `radial-gradient(circle,${stops})`
      : `conic-gradient(${stops})`
})

function fraction(e: PointerEvent): number {
  const r = bar.value!.getBoundingClientRect()
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
}

function dragStop(i: number, e: PointerEvent): void {
  sel.value = i
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  el.onpointermove = (ev) => setStopField({ offset: fraction(ev) }, 'drag-stop')
  el.onpointerup = () => {
    el.onpointermove = null
    el.onpointerup = null
    endLive('drag-stop')
  }
  el.onpointercancel = el.onpointerup
}

function dragMid(i: number, e: PointerEvent): void {
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  el.onpointermove = (ev) => {
    const a = sorted.value[i]!
    const b = sorted.value[i + 1]!
    const k = (fraction(ev) - a.offset) / Math.max(1e-6, b.offset - a.offset)
    mutate(
      `mid${i}`,
      (g) => {
        const s = sortedStops(g.stops)
        g.stops = s
        s[i]!.mid = Math.min(0.95, Math.max(0.05, k))
      },
      'drag-mid'
    )
  }
  el.onpointerup = () => {
    el.onpointermove = null
    el.onpointerup = null
    endLive('drag-mid')
  }
  el.onpointercancel = el.onpointerup
}

/** Clic en el hueco bajo la barra: nueva parada con el color del degradado en ese punto. */
function addStopAt(e: PointerEvent): void {
  if ((e.target as HTMLElement).closest('.stop')) return
  const off = fraction(e)
  const g = grad.value
  if (!g) return
  const color = colorAt(sortedStops(g.stops), off)
  mutate('add', (gg) => {
    gg.stops = sortedStops(gg.stops)
    const s = { offset: off, color }
    gg.stops.push(s)
    gg.stops = sortedStops(gg.stops)
    sel.value = gg.stops.indexOf(s)
  })
}

const midPos = (i: number): number => {
  const a = sorted.value[i]!
  const b = sorted.value[i + 1]!
  return a.offset + (a.mid ?? 0.5) * (b.offset - a.offset)
}

type ModeId = 'smooth' | 'bands' | 'dither'
const modeOf = computed<ModeId>(() => {
  void docs.rev
  const m = grad.value?.pixelMode.mode
  return m === 'bands' || m === 'dither' ? m : 'smooth'
})
function setMode(e: Event): void {
  const mode = (e.target as HTMLSelectElement).value as ModeId
  mutate('mode', (g) => {
    const steps = 'steps' in g.pixelMode ? g.pixelMode.steps : 4
    g.pixelMode =
      mode === 'smooth'
        ? { mode: 'smooth' }
        : mode === 'bands'
          ? { mode: 'bands', steps }
          : { mode: 'dither', matrix: 'bayer4', steps }
  })
}
function setSteps(e: Event): void {
  const v = Math.min(
    32,
    Math.max(2, Math.round(Number.parseFloat((e.target as HTMLInputElement).value)))
  )
  if (Number.isFinite(v))
    mutate('steps', (g) => {
      if ('steps' in g.pixelMode) g.pixelMode.steps = v
    })
}
function setMatrix(e: Event): void {
  const m = (e.target as HTMLSelectElement).value as 'bayer2' | 'bayer4' | 'bayer8' | 'checker'
  mutate('matrix', (g) => {
    if (g.pixelMode.mode === 'dither') g.pixelMode.matrix = m
  })
}

const TYPES: { id: GradientPaint['type']; icon: string }[] = [
  { id: 'linear', icon: 'linear-gradient(90deg,#fff,#222)' },
  { id: 'radial', icon: 'radial-gradient(circle,#fff,#222)' },
  { id: 'angular', icon: 'conic-gradient(#fff,#222,#fff)' }
]
</script>

<template>
  <div v-if="shape" class="gradient-panel">
    <template v-if="grad">
      <div class="top">
        <span class="prev" :style="{ background: preview }" />
        <div class="ctl">
          <div class="row">
            <label>{{ t('gradient.type') }}</label>
            <div class="types" role="group" :aria-label="t('gradient.type')">
              <button
                v-for="k in TYPES"
                :key="k.id"
                type="button"
                class="ty"
                :class="{ on: grad.type === k.id }"
                :aria-pressed="grad.type === k.id"
                :aria-label="t(`appearance.type.${k.id}` as I18nKey)"
                :data-tip="t(`appearance.type.${k.id}` as I18nKey)"
                @click="setType(k.id)"
              >
                <span :style="{ background: k.icon }" />
              </button>
            </div>
          </div>
          <div class="row">
            <label>{{ t('gradient.angle') }}</label>
            <input
              class="pt-input ang"
              type="number"
              step="1"
              :value="angle"
              :disabled="grad.type === 'radial'"
              :aria-label="t('gradient.angle')"
              @change="setAngle"
            />
            <span class="pt-unit">°</span>
          </div>
        </div>
      </div>

      <div class="barwrap">
        <div ref="bar" class="mids" aria-hidden="true">
          <span
            v-for="(_s, i) in sorted.slice(0, -1)"
            :key="`m${i}`"
            class="mid"
            :style="{ left: `${midPos(i) * 100}%` }"
            @pointerdown.prevent="dragMid(i, $event)"
          />
        </div>
        <canvas ref="canvas" class="bar" :width="BAR_W" :height="BAR_H" />
        <div class="track" @pointerdown="addStopAt">
          <button
            v-for="(s, i) in sorted"
            :key="i"
            type="button"
            class="stop"
            :class="{ on: i === sel }"
            :style="{ left: `${s.offset * 100}%`, '--c': hex(s.color) }"
            :aria-label="`${t('gradient.stop')} ${i + 1}`"
            @pointerdown.stop.prevent="dragStop(i, $event)"
          />
        </div>
        <button
          type="button"
          class="pt-iconbtn del"
          :disabled="sorted.length <= 2"
          :data-tip="t('gradient.removeStop')"
          :aria-label="t('gradient.removeStop')"
          @click="removeStop"
        >
          <PtIcon name="trash" />
        </button>
      </div>

      <div v-if="current" class="fields">
        <button
          type="button"
          class="pt-iconbtn eye"
          :data-tip="t('gradient.eyedropper')"
          :aria-label="t('gradient.eyedropper')"
          @click="pickColor"
        >
          <PtIcon name="eyedrop" />
        </button>
        <div class="col">
          <div class="row">
            <label>{{ t('gradient.color') }}</label>
            <input
              type="color"
              :value="hex(current.color)"
              :aria-label="t('gradient.color')"
              @input="onColor"
              @change="endLive('stop-color')"
            />
          </div>
          <div class="row">
            <label>{{ t('properties.opacity') }}</label>
            <input
              class="pt-input"
              type="number"
              min="0"
              max="100"
              :value="Math.round((current.color.a / 255) * 100)"
              :aria-label="t('properties.opacity')"
              @change="onOpacity"
            />
            <span class="pt-unit">%</span>
          </div>
          <div class="row">
            <label>{{ t('gradient.location') }}</label>
            <input
              class="pt-input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              :value="Math.round(current.offset * 10000) / 100"
              :aria-label="t('gradient.location')"
              @change="onLocation"
            />
            <span class="pt-unit">%</span>
          </div>
        </div>
      </div>

      <div class="row pm">
        <label>{{ t('appearance.pixelMode') }}</label>
        <select
          class="pt-select"
          :value="modeOf"
          :aria-label="t('appearance.pixelMode')"
          @change="setMode"
        >
          <option value="smooth">{{ t('appearance.mode.smooth') }}</option>
          <option value="bands">{{ t('appearance.mode.bands') }}</option>
          <option value="dither">{{ t('appearance.mode.dither') }}</option>
        </select>
      </div>
      <div v-if="'steps' in grad.pixelMode" class="row pm">
        <label>{{ t('appearance.steps') }}</label>
        <input
          class="pt-input w"
          type="number"
          min="2"
          max="32"
          :value="grad.pixelMode.steps"
          :aria-label="t('appearance.steps')"
          @change="setSteps"
        />
        <select
          v-if="grad.pixelMode.mode === 'dither'"
          class="pt-select"
          :value="grad.pixelMode.matrix"
          :aria-label="t('appearance.matrix')"
          @change="setMatrix"
        >
          <option v-for="m in ['bayer2', 'bayer4', 'bayer8', 'checker']" :key="m" :value="m">
            {{ t(`appearance.matrices.${m}` as I18nKey) }}
          </option>
        </select>
      </div>
    </template>
    <div v-else class="none">
      <p class="pt-sec2">{{ t('gradient.noGradient') }}</p>
      <button type="button" class="pt-btn pt-btn--secondary" @click="applyGradient">
        {{ t('gradient.apply') }}
      </button>
    </div>
  </div>
  <p v-else class="pt-sec2 none">{{ t('gradient.noShape') }}</p>
</template>

<style scoped>
.gradient-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--panel-pad-x);
}
.top {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}
.prev {
  width: 52px;
  height: 52px;
  flex: none;
  border-radius: 2px;
  box-shadow: 0 0 0 1px var(--border);
}
.ctl {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.row > label {
  min-width: 52px;
  color: var(--text-secondary);
}
.types {
  display: flex;
  gap: 2px;
}
.ty {
  width: 26px;
  height: 22px;
  padding: 3px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  border-radius: 2px;
}
.ty.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.ty span {
  display: block;
  width: 100%;
  height: 100%;
}
.ang {
  width: 64px;
}
.barwrap {
  position: relative;
  padding: 0 7px;
  margin-top: 4px;
}
.mids {
  position: relative;
  height: 12px;
}
.mid {
  position: absolute;
  top: 2px;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  transform: rotate(45deg);
  background: var(--bg-panel);
  border: 1px solid var(--text-secondary);
  cursor: ew-resize;
}
.bar {
  display: block;
  width: 100%;
  height: 16px;
  image-rendering: pixelated;
  box-shadow: 0 0 0 1px var(--border);
}
.track {
  position: relative;
  height: 20px;
  cursor: copy;
}
.stop {
  position: absolute;
  top: 3px;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  padding: 0;
  border-radius: 50%;
  background: var(--c);
  border: 2px solid var(--bg-panel);
  box-shadow: 0 0 0 1px var(--text-secondary);
  cursor: pointer;
}
.stop.on {
  box-shadow: 0 0 0 2px var(--accent);
}
.del {
  position: absolute;
  right: -4px;
  top: 52px;
}
.fields {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}
.eye {
  margin-top: 2px;
}
.col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.col .pt-input {
  width: 76px;
}
.pm .pt-select {
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
.none {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--panel-pad-y);
  text-align: center;
}
</style>
