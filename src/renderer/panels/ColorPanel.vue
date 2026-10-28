<script setup lang="ts">
// Selector de color HSV: cuadrado saturación/brillo, barra de tono y valor hexadecimal.
// Edita el color de relleno o de contorno según `colors.target`.
import { computed, ref, watch } from 'vue'
import { useColorsStore } from '@/stores/colors'
import { hexToHsv, hexToRgba, hsvToHex, rgbaToHex } from '@/stores/colorUtil'
import { t } from '@/i18n'

const colors = useColorsStore()
const current = computed(() => (colors.target === 'fill' ? colors.fill : colors.stroke))

// El tono se conserva aparte: en negro/blanco/grises el hex no lo contiene.
const hsv = ref(hexToHsv(current.value))
watch(current, (hex) => {
  if (hsvToHex(hsv.value.h, hsv.value.s, hsv.value.v) !== hex.slice(0, 7).toUpperCase()) {
    const n = hexToHsv(hex)
    hsv.value = { h: n.s === 0 || n.v === 0 ? hsv.value.h : n.h, s: n.s, v: n.v }
  }
})

function commit(): void {
  const hex = hsvToHex(hsv.value.h, hsv.value.s, hsv.value.v)
  if (colors.target === 'fill') colors.fill = hex
  else colors.stroke = hex
}

function drag(e: PointerEvent, apply: (x: number, y: number) => void): void {
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent) => {
    const r = el.getBoundingClientRect()
    apply(
      Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))
    )
    commit()
  }
  move(e)
  el.onpointermove = move
  el.onpointerup = () => {
    el.onpointermove = null
    el.onpointerup = null
  }
}

const svDown = (e: PointerEvent) =>
  drag(e, (x, y) => {
    hsv.value.s = x
    hsv.value.v = 1 - y
  })
const hueDown = (e: PointerEvent) => drag(e, (x) => (hsv.value.h = x * 360))

function onHex(e: Event): void {
  const raw = (e.target as HTMLInputElement).value.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw) && !/^[0-9a-fA-F]{3}$/.test(raw)) return
  const hex = rgbaToHex(hexToRgba(raw)).slice(0, 7)
  if (colors.target === 'fill') colors.fill = hex
  else colors.stroke = hex
}

const hueColor = computed(() => hsvToHex(hsv.value.h, 1, 1))
</script>

<template>
  <div class="color">
    <div
      class="sv"
      role="slider"
      :aria-label="t('color.saturationValue')"
      :style="{ backgroundColor: hueColor }"
      @pointerdown="svDown"
    >
      <span class="knob" :style="{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }" />
    </div>
    <div class="hue" role="slider" :aria-label="t('color.hue')" @pointerdown="hueDown">
      <span class="knob bar" :style="{ left: `${(hsv.h / 360) * 100}%` }" />
    </div>
    <div class="row">
      <span class="pt-sw" :style="{ background: current }" />
      <input
        class="pt-input pt-mono hex"
        :value="current"
        :aria-label="t('color.hex')"
        spellcheck="false"
        @change="onHex"
      />
    </div>
  </div>
</template>

<style scoped>
.color {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--panel-pad-x);
}
.sv {
  position: relative;
  height: 56px;
  border-radius: var(--radius-sm, 2px);
  background-image:
    linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent);
  touch-action: none;
  cursor: crosshair;
}
.hue {
  position: relative;
  height: 10px;
  border-radius: 2px;
  touch-action: none;
  background: linear-gradient(
    to right,
    #f00 0%,
    #ff0 17%,
    #0f0 33%,
    #0ff 50%,
    #00f 67%,
    #f0f 83%,
    #f00 100%
  );
}
.knob {
  position: absolute;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  border: 1px solid #fff;
  box-shadow: 0 0 0 1px #000;
  pointer-events: none;
}
.knob.bar {
  top: 50%;
}
.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.hex {
  flex: 1;
  min-width: 0;
}
</style>
