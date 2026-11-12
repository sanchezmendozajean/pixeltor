<script setup lang="ts">
// Posición y tamaño de la selección (X, Y, An, Al) con el selector del punto de referencia 3×3:
// X e Y se refieren a ese punto y el tamaño se cambia manteniéndolo fijo. Los campos aceptan
// operaciones (30-5, 100/2…).
import { computed } from 'vue'
import { evalExpr, flipShapes, setShapesBox, shapesBox } from '@core/index'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import PtIcon from '@/components/PtIcon.vue'
import { t } from '@/i18n'

const docs = useDocumentsStore()
const ui = useUiStore()

const box = computed(() => {
  void docs.rev
  const s = docs.session
  return s && s.selectedShapes.length ? shapesBox(s, s.selectedShapes) : null
})
/** Valor mostrado de cada campo según el punto de referencia. */
const shown = computed(() => {
  const b = box.value
  if (!b) return null
  const o = ui.boxOrigin
  return {
    x: Math.round(b.x + o.fx * b.w),
    y: Math.round(b.y + o.fy * b.h),
    w: Math.round(b.w),
    h: Math.round(b.h)
  }
})

function setBox(key: 'x' | 'y' | 'w' | 'h', e: Event): void {
  const s = docs.session
  const input = e.target as HTMLInputElement
  const v = evalExpr(input.value) ?? Number.NaN
  if (s && s.selectedShapes.length && Number.isFinite(v)) {
    const patch: { x?: number; y?: number; w?: number; h?: number } = { [key]: v }
    const b = box.value
    // proporcional: el otro lado sale de la proporción actual, siempre entero
    if (ui.boxLock && b && (key === 'w' || key === 'h') && v >= 1) {
      if (key === 'w') patch.h = Math.max(1, Math.round((b.h * v) / b.w))
      else patch.w = Math.max(1, Math.round((b.w * v) / b.h))
    }
    setShapesBox(s, s.selectedShapes, patch, ui.boxOrigin)
  }
  // si no se aplicó (texto inválido, tamaño 0), el campo vuelve al valor real
  if (shown.value) input.value = String(shown.value[key])
}

function flip(axis: 'h' | 'v'): void {
  const s = docs.session
  if (s && s.selectedShapes.length) flipShapes(s, s.selectedShapes, axis)
}

const STEPS = [0, 0.5, 1] as const
const names = ['Izquierda', 'Centro', 'Derecha']
const rows = ['arriba', 'centro', 'abajo']
</script>

<template>
  <div v-if="shown" class="boxfields">
    <div class="origin" role="radiogroup" :aria-label="t('properties.origin')">
      <template v-for="(fy, r) in STEPS" :key="r">
        <button
          v-for="(fx, c) in STEPS"
          :key="`${r}${c}`"
          type="button"
          role="radio"
          class="dot"
          :class="{ 'is-on': ui.boxOrigin.fx === fx && ui.boxOrigin.fy === fy }"
          :aria-checked="ui.boxOrigin.fx === fx && ui.boxOrigin.fy === fy"
          :aria-label="`${names[c]} ${rows[r]}`"
          :data-testid="`origin-${r}${c}`"
          @click="ui.boxOrigin = { fx, fy }"
        />
      </template>
    </div>
    <label>{{ t('properties.x') }}</label>
    <input
      class="pt-input"
      type="text"
      inputmode="numeric"
      :value="shown.x"
      :aria-label="t('properties.posX')"
      data-testid="prop-x"
      @change="(e) => setBox('x', e)"
    />
    <span />
    <label>{{ t('properties.y') }}</label>
    <input
      class="pt-input"
      type="text"
      inputmode="numeric"
      :value="shown.y"
      :aria-label="t('properties.posY')"
      data-testid="prop-y"
      @change="(e) => setBox('y', e)"
    />
    <label>{{ t('properties.w') }}</label>
    <input
      class="pt-input"
      type="text"
      inputmode="numeric"
      min="1"
      :value="shown.w"
      :aria-label="t('properties.boxW')"
      data-testid="prop-w"
      @change="(e) => setBox('w', e)"
    />
    <button
      type="button"
      class="pt-iconbtn pt-iconbtn--20 lock"
      :class="{ 'is-on': ui.boxLock }"
      :aria-pressed="ui.boxLock"
      :data-tip="t('properties.lock')"
      :aria-label="t('properties.lock')"
      data-testid="prop-lock"
      @click="ui.boxLock = !ui.boxLock"
    >
      <PtIcon :name="ui.boxLock ? 'lock' : 'unlock'" />
    </button>
    <label>{{ t('properties.h') }}</label>
    <input
      class="pt-input"
      type="text"
      inputmode="numeric"
      min="1"
      :value="shown.h"
      :aria-label="t('properties.boxH')"
      data-testid="prop-h"
      @change="(e) => setBox('h', e)"
    />
    <span class="flips">
      <button
        v-for="axis in ['h', 'v'] as const"
        :key="axis"
        type="button"
        class="pt-iconbtn pt-iconbtn--20"
        :data-tip="t(axis === 'h' ? 'properties.flipH' : 'properties.flipV')"
        :aria-label="t(axis === 'h' ? 'properties.flipH' : 'properties.flipV')"
        :data-testid="`prop-flip-${axis}`"
        @click="flip(axis)"
      >
        <PtIcon :name="axis === 'h' ? 'flipH' : 'flipV'" />
      </button>
    </span>
  </div>
</template>

<style scoped>
.boxfields {
  display: grid;
  grid-template-columns: auto auto 1fr auto auto 1fr;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}
.flips {
  grid-column: 1 / -1;
  display: flex;
  gap: var(--space-2);
}
.boxfields input {
  min-width: 0;
}
/* Selector del punto de referencia: rejilla 3×3 a la izquierda de los cuatro campos */
.origin {
  grid-row: span 2;
  display: grid;
  grid-template-columns: repeat(3, 9px);
  grid-template-rows: repeat(3, 9px);
  gap: 1px;
}
.dot {
  width: 9px;
  height: 9px;
  padding: 0;
  border: 1px solid var(--text-secondary);
  border-radius: 0;
  background: transparent;
  cursor: pointer;
}
.dot:hover {
  border-color: var(--accent);
}
.dot.is-on {
  background: var(--accent);
  border-color: var(--accent);
}
</style>
