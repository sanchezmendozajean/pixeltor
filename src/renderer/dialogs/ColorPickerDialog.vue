<script setup lang="ts">
// Selector de color (doble clic en relleno/contorno de la barra de herramientas): cuadrado
// saturación/brillo, barra de tono, modos RGB · HSB · HSL con deslizadores, hexadecimal y
// «Solo colores web». Aceptar aplica el color; Cancelar lo descarta.
import { computed, nextTick, ref, watch } from 'vue'
import { hslToRgb, rgbToHsl } from '@core/index'
import { hexToHsv, hexToRgba, hsvToHex, rgbaToHex } from '@/stores/colorUtil'
import { useColorsStore } from '@/stores/colors'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

type Mode = 'RGB' | 'HSB' | 'HSL'

const ui = useUiStore()
const colors = useColorsStore()

const mode = ref<Mode>('RGB')
const webOnly = ref(false)
const hsv = ref({ h: 0, s: 0, v: 0 })
/** Alfa original: el selector sólo cambia el color. */
let alphaSuffix = ''
const root = ref<HTMLElement>()

watch(
  () => ui.colorPicker,
  async (target) => {
    if (!target) return
    const cur = target === 'fill' ? colors.fill : colors.stroke
    const hex = rgbaToHex(hexToRgba(cur))
    alphaSuffix = hex.slice(7)
    hsv.value = hexToHsv(hex.slice(0, 7))
    await nextTick()
    root.value?.focus()
  }
)

const hex = computed(() => hsvToHex(hsv.value.h, hsv.value.s, hsv.value.v))
const rgb = computed(() => {
  const v = hexToRgba(hex.value)
  return { r: (v >>> 24) & 255, g: (v >>> 16) & 255, b: (v >>> 8) & 255 }
})
const hsl = computed(() => {
  const c = rgbToHsl({ ...rgb.value, a: 255 })
  return { h: Math.round(c.h), s: Math.round(c.s * 100), l: Math.round(c.l * 100) }
})
const webHex = computed(() => {
  const q = (n: number): number => Math.round(n / 51) * 51
  const to = (n: number): string => q(n).toString(16).padStart(2, '0')
  return `#${to(rgb.value.r)}${to(rgb.value.g)}${to(rgb.value.b)}`.toUpperCase()
})

function setHex(h: string): void {
  const full = rgbaToHex(hexToRgba(h)).slice(0, 7)
  const prev = hsv.value
  const n = hexToHsv(full)
  // en grises o negros el tono se conserva (no hay información de tono en el hexadecimal)
  hsv.value = { h: n.s === 0 || n.v === 0 ? prev.h : n.h, s: n.s, v: n.v }
  if (webOnly.value) snapWeb()
}
function snapWeb(): void {
  const n = hexToHsv(webHex.value)
  hsv.value = { h: n.s === 0 || n.v === 0 ? hsv.value.h : n.h, s: n.s, v: n.v }
}
watch(webOnly, (on) => on && snapWeb())

function setRgb(k: 'r' | 'g' | 'b', v: number): void {
  const c = { ...rgb.value, [k]: Math.min(255, Math.max(0, Math.round(v))) }
  setHex(`#${[c.r, c.g, c.b].map((x) => x.toString(16).padStart(2, '0')).join('')}`)
}
function setHsb(k: 'h' | 's' | 'v', v: number): void {
  const max = k === 'h' ? 360 : 100
  const x = Math.min(max, Math.max(0, v))
  hsv.value = { ...hsv.value, [k]: k === 'h' ? x : x / 100 }
  if (webOnly.value) snapWeb()
}
function setHsl(k: 'h' | 's' | 'l', v: number): void {
  const c = { ...hsl.value, [k]: v }
  const o = hslToRgb(
    Math.min(360, Math.max(0, c.h)),
    Math.min(100, Math.max(0, c.s)) / 100,
    Math.min(100, Math.max(0, c.l)) / 100
  )
  setHex(`#${[o.r, o.g, o.b].map((x) => x.toString(16).padStart(2, '0')).join('')}`)
  if (k === 'h') hsv.value = { ...hsv.value, h: Math.min(360, Math.max(0, v)) }
}

interface Row {
  key: string
  label: string
  max: number
  value: number
  track: string
  set: (v: number) => void
}

const hueTrack = 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)'
const rows = computed<Row[]>(() => {
  const { r, g, b } = rgb.value
  const css = (a: number, c: number, d: number) => `rgb(${a},${c},${d})`
  if (mode.value === 'RGB')
    return [
      {
        key: 'r',
        label: 'R',
        max: 255,
        value: r,
        track: `linear-gradient(90deg,${css(0, g, b)},${css(255, g, b)})`,
        set: (v) => setRgb('r', v)
      },
      {
        key: 'g',
        label: 'G',
        max: 255,
        value: g,
        track: `linear-gradient(90deg,${css(r, 0, b)},${css(r, 255, b)})`,
        set: (v) => setRgb('g', v)
      },
      {
        key: 'b',
        label: 'B',
        max: 255,
        value: b,
        track: `linear-gradient(90deg,${css(r, g, 0)},${css(r, g, 255)})`,
        set: (v) => setRgb('b', v)
      }
    ]
  if (mode.value === 'HSB') {
    const { h, s, v } = hsv.value
    return [
      {
        key: 'h',
        label: 'H',
        max: 360,
        value: Math.round(h),
        track: hueTrack,
        set: (x) => setHsb('h', x)
      },
      {
        key: 's',
        label: 'S',
        max: 100,
        value: Math.round(s * 100),
        track: `linear-gradient(90deg,${hsvToHex(h, 0, v)},${hsvToHex(h, 1, v)})`,
        set: (x) => setHsb('s', x)
      },
      {
        key: 'v',
        label: 'B',
        max: 100,
        value: Math.round(v * 100),
        track: `linear-gradient(90deg,#000,${hsvToHex(h, s, 1)})`,
        set: (x) => setHsb('v', x)
      }
    ]
  }
  const { h, s, l } = hsl.value
  const at = (hh: number, ss: number, ll: number): string => {
    const o = hslToRgb(hh, ss / 100, ll / 100)
    return css(o.r, o.g, o.b)
  }
  return [
    { key: 'h', label: 'H', max: 360, value: h, track: hueTrack, set: (x) => setHsl('h', x) },
    {
      key: 's',
      label: 'S',
      max: 100,
      value: s,
      track: `linear-gradient(90deg,${at(h, 0, l)},${at(h, 100, l)})`,
      set: (x) => setHsl('s', x)
    },
    {
      key: 'l',
      label: 'L',
      max: 100,
      value: l,
      track: `linear-gradient(90deg,#000,${at(h, s, 50)},#fff)`,
      set: (x) => setHsl('l', x)
    }
  ]
})

function drag(e: PointerEvent, apply: (x: number, y: number) => void): void {
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent): void => {
    const r = el.getBoundingClientRect()
    apply(
      Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))
    )
    if (webOnly.value) snapWeb()
  }
  move(e)
  el.onpointermove = move
  el.onpointerup = () => {
    el.onpointermove = null
    el.onpointerup = null
  }
}
const svDown = (e: PointerEvent): void =>
  drag(e, (x, y) => (hsv.value = { ...hsv.value, s: x, v: 1 - y }))
const hueDown = (e: PointerEvent): void =>
  drag(e, (_x, y) => (hsv.value = { ...hsv.value, h: y * 360 }))

function onHex(e: Event): void {
  const raw = (e.target as HTMLInputElement).value.trim().replace('#', '')
  if (/^[0-9a-fA-F]{6}$/.test(raw) || /^[0-9a-fA-F]{3}$/.test(raw)) setHex(raw)
  else (e.target as HTMLInputElement).value = hex.value.slice(1)
}
function onNum(r: Row, e: Event): void {
  const v = Number.parseFloat((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) r.set(v)
}

const hueColor = computed(() => hsvToHex(hsv.value.h, 1, 1))

function close(): void {
  ui.colorPicker = null
}
function accept(): void {
  const target = ui.colorPicker
  if (!target) return
  const out = hex.value + alphaSuffix
  if (target === 'fill') colors.fill = out
  else colors.stroke = out
  close()
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
  else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
    // el campo que se edita confirma su valor (change) antes de aceptar
    ;(e.target as HTMLElement).blur()
    void nextTick(accept)
  } else return
  e.preventDefault()
  e.stopPropagation()
}
</script>

<template>
  <div
    v-if="ui.colorPicker"
    class="pt-scrim host"
    :style="{ paddingLeft: ui.toolbarColumns === 2 ? '80px' : '44px' }"
    @pointerdown.self="close"
  >
    <div
      ref="root"
      class="pt-dialog cp"
      role="dialog"
      aria-modal="true"
      :aria-label="t('picker.title')"
      tabindex="-1"
      @keydown="onKey"
    >
      <div class="title">{{ t('picker.title') }}</div>
      <div class="top">
        <div
          class="sv"
          role="slider"
          :aria-label="t('color.saturationValue')"
          :style="{ backgroundColor: hueColor }"
          @pointerdown="svDown"
        >
          <i class="dot" :style="{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }" />
        </div>
        <div class="hue" role="slider" :aria-label="t('color.hue')" @pointerdown="hueDown">
          <i class="mark" :style="{ top: `${(hsv.h / 360) * 100}%` }" />
        </div>
        <div class="side">
          <label class="pt-check-label">
            <input v-model="webOnly" type="checkbox" />
            {{ t('picker.webOnly') }}
          </label>
          <div class="boxes">
            <div class="box">
              <button
                type="button"
                class="swatch"
                :style="{ background: webHex }"
                :aria-label="t('picker.web')"
                @click="setHex(webHex)"
              />
              <span>{{ t('picker.web') }}</span>
            </div>
            <div class="box">
              <span class="swatch" :style="{ background: hex }" />
              <span>{{ t('picker.real') }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modes">
        <select v-model="mode" class="pt-select" :aria-label="t('picker.mode')">
          <option>RGB</option>
          <option>HSB</option>
          <option>HSL</option>
        </select>
        <span class="pt-spacer" />
        <input
          class="pt-input hex"
          :value="hex.slice(1)"
          maxlength="7"
          :aria-label="t('color.hex')"
          @change="onHex"
        />
      </div>

      <div v-for="r in rows" :key="`${mode}${r.key}`" class="row">
        <span class="lbl">{{ r.label }}</span>
        <input
          type="range"
          min="0"
          :max="r.max"
          step="1"
          :value="r.value"
          :style="{ '--track': r.track }"
          :aria-label="r.label"
          @input="onNum(r, $event)"
        />
        <input
          type="number"
          class="pt-input num"
          min="0"
          :max="r.max"
          :value="r.value"
          :aria-label="r.label"
          @change="onNum(r, $event)"
        />
      </div>

      <div class="foot">
        <button type="button" class="pt-btn pt-btn--secondary" @click="close">
          {{ t('picker.cancel') }}
        </button>
        <button type="button" class="pt-btn pt-btn--primary" @click="accept">
          {{ t('picker.accept') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.host {
  background: transparent;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 56px 0 0 44px;
}
.cp {
  width: 400px;
  padding: var(--space-4);
  gap: var(--space-3);
  outline: none;
}
.title {
  font-weight: 600;
  font-size: var(--fs-md);
}
.top {
  display: flex;
  gap: var(--space-3);
}
.sv {
  position: relative;
  width: 180px;
  height: 180px;
  flex: none;
  background-image:
    linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent);
  cursor: crosshair;
}
.dot {
  position: absolute;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  border: 1px solid #fff;
  box-shadow: 0 0 0 1px #000;
  pointer-events: none;
}
.hue {
  position: relative;
  width: 16px;
  height: 180px;
  flex: none;
  background: linear-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  cursor: pointer;
}
.mark {
  position: absolute;
  left: -3px;
  right: -3px;
  height: 5px;
  margin-top: -3px;
  border: 1px solid #000;
  background: #fff;
  pointer-events: none;
}
.side {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--fs-sm);
}
.boxes {
  display: flex;
  gap: var(--space-2);
}
.box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: var(--text-secondary);
}
.swatch {
  display: block;
  width: 72px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border-input);
}
.modes {
  display: flex;
  align-items: center;
}
.modes select {
  width: 100px;
}
.hex {
  width: 82px;
  text-align: right;
  font-family: var(--font-mono, monospace);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.lbl {
  width: 12px;
  font-size: var(--fs-sm);
  color: var(--text-secondary);
}
.num {
  width: 52px;
  text-align: right;
}
.row input[type='range'] {
  flex: 1;
  min-width: 0;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: var(--track);
}
.row input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #000;
}
.foot {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
