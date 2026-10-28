<script setup lang="ts">
// Panel Alinear (specs/05): alinear y distribuir formas respecto a la selección, a un objeto clave
// o al lienzo. Usa los límites de píxeles visibles. Para marcar el objeto clave, haz clic con la
// herramienta de selección sobre una forma que ya esté seleccionada.
import { computed, ref } from 'vue'
import {
  type AlignHow,
  type AlignTo,
  type Axis,
  type DistributeMode,
  alignShapes,
  distributeShapes,
  distributeSpacing
} from '@core/index'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { t, type I18nKey } from '@/i18n'

const docs = useDocumentsStore()
const ui = useUiStore()

const to = ref<AlignTo>('selection')
const gap = ref(4)

const ids = computed(() => {
  void docs.rev
  return docs.session?.selectedShapes ?? []
})
const keyId = computed(() => (ids.value.includes(ui.keyShape) ? ui.keyShape : undefined))

/** Dibujos 16×16: [x, y, w, h] de las barras y [x1, y1, x2, y2] de la línea de referencia. */
type Glyph = { line: [number, number, number, number][]; bars: [number, number, number, number][] }
const G: Record<string, Glyph> = {
  left: {
    line: [[2, 1, 2, 15]],
    bars: [
      [3, 4, 10, 3],
      [3, 9, 6, 3]
    ]
  },
  centerH: {
    line: [[8, 1, 8, 15]],
    bars: [
      [3, 4, 10, 3],
      [5, 9, 6, 3]
    ]
  },
  right: {
    line: [[14, 1, 14, 15]],
    bars: [
      [3, 4, 10, 3],
      [7, 9, 6, 3]
    ]
  },
  top: {
    line: [[1, 2, 15, 2]],
    bars: [
      [4, 3, 3, 10],
      [9, 3, 3, 6]
    ]
  },
  centerV: {
    line: [[1, 8, 15, 8]],
    bars: [
      [4, 3, 3, 10],
      [9, 5, 3, 6]
    ]
  },
  bottom: {
    line: [[1, 14, 15, 14]],
    bars: [
      [4, 3, 3, 10],
      [9, 7, 3, 6]
    ]
  },
  hStart: {
    line: [
      [2, 1, 2, 15],
      [8, 1, 8, 15],
      [14, 1, 14, 15]
    ],
    bars: [
      [2, 4, 3, 8],
      [8, 4, 3, 8],
      [14, 4, 1, 8]
    ]
  },
  hCenter: {
    line: [
      [3, 1, 3, 15],
      [8, 1, 8, 15],
      [13, 1, 13, 15]
    ],
    bars: [
      [2, 4, 2, 8],
      [7, 4, 2, 8],
      [12, 4, 2, 8]
    ]
  },
  hEnd: {
    line: [
      [2, 1, 2, 15],
      [8, 1, 8, 15],
      [14, 1, 14, 15]
    ],
    bars: [
      [1, 4, 1, 8],
      [5, 4, 3, 8],
      [11, 4, 3, 8]
    ]
  },
  vStart: {
    line: [
      [1, 2, 15, 2],
      [1, 8, 15, 8],
      [1, 14, 15, 14]
    ],
    bars: [
      [4, 2, 8, 3],
      [4, 8, 8, 3],
      [4, 14, 8, 1]
    ]
  },
  vCenter: {
    line: [
      [1, 3, 15, 3],
      [1, 8, 15, 8],
      [1, 13, 15, 13]
    ],
    bars: [
      [4, 2, 8, 2],
      [4, 7, 8, 2],
      [4, 12, 8, 2]
    ]
  },
  vEnd: {
    line: [
      [1, 2, 15, 2],
      [1, 8, 15, 8],
      [1, 14, 15, 14]
    ],
    bars: [
      [4, 1, 8, 1],
      [4, 5, 8, 3],
      [4, 11, 8, 3]
    ]
  }
}

const ALIGN: AlignHow[] = ['left', 'centerH', 'right', 'top', 'centerV', 'bottom']
const DIST: { id: string; axis: Axis; mode: DistributeMode }[] = [
  { id: 'hStart', axis: 'h', mode: 'start' },
  { id: 'hCenter', axis: 'h', mode: 'center' },
  { id: 'hEnd', axis: 'h', mode: 'end' },
  { id: 'vStart', axis: 'v', mode: 'start' },
  { id: 'vCenter', axis: 'v', mode: 'center' },
  { id: 'vEnd', axis: 'v', mode: 'end' }
]

/** Con `lienzo` basta una forma; con selección o clave, al menos dos. */
const canAlign = computed(() =>
  to.value === 'canvas'
    ? ids.value.length >= 1
    : to.value === 'key'
      ? ids.value.length >= 2 && !!keyId.value
      : ids.value.length >= 2
)
const canDistribute = computed(() => ids.value.length >= 3)

function align(how: AlignHow): void {
  if (docs.session) alignShapes(docs.session, ids.value, how, to.value, keyId.value)
}
function distribute(axis: Axis, mode: DistributeMode): void {
  if (docs.session) distributeShapes(docs.session, ids.value, axis, mode)
}
function spacing(axis: Axis): void {
  if (docs.session) distributeSpacing(docs.session, ids.value, axis, Math.round(gap.value) || 0)
}
</script>

<template>
  <div class="align">
    <div class="row">
      <label for="alignTo">{{ t('align.to') }}</label>
      <select id="alignTo" v-model="to" class="pt-select">
        <option value="selection">{{ t('align.selection') }}</option>
        <option value="key">{{ t('align.key') }}</option>
        <option value="canvas">{{ t('align.canvas') }}</option>
      </select>
    </div>
    <div class="btns" role="group" :aria-label="t('align.align')">
      <button
        v-for="h in ALIGN"
        :key="h"
        type="button"
        class="pt-iconbtn"
        :disabled="!canAlign"
        :data-tip="t(`align.${h}` as I18nKey)"
        :aria-label="t(`align.${h}` as I18nKey)"
        @click="align(h)"
      >
        <svg class="i16" viewBox="0 0 16 16" aria-hidden="true">
          <line
            v-for="(l, i) in G[h]!.line"
            :key="i"
            :x1="l[0]"
            :y1="l[1]"
            :x2="l[2]"
            :y2="l[3]"
            stroke="currentColor"
            stroke-width="1"
          />
          <rect
            v-for="(r, i) in G[h]!.bars"
            :key="i"
            :x="r[0]"
            :y="r[1]"
            :width="r[2]"
            :height="r[3]"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
    <div class="btns" role="group" :aria-label="t('align.distribute')">
      <button
        v-for="d in DIST"
        :key="d.id"
        type="button"
        class="pt-iconbtn"
        :disabled="!canDistribute"
        :data-tip="t(`align.${d.id}` as I18nKey)"
        :aria-label="t(`align.${d.id}` as I18nKey)"
        @click="distribute(d.axis, d.mode)"
      >
        <svg class="i16" viewBox="0 0 16 16" aria-hidden="true">
          <line
            v-for="(l, i) in G[d.id]!.line"
            :key="i"
            :x1="l[0]"
            :y1="l[1]"
            :x2="l[2]"
            :y2="l[3]"
            stroke="currentColor"
            stroke-width="1"
          />
          <rect
            v-for="(r, i) in G[d.id]!.bars"
            :key="i"
            :x="r[0]"
            :y="r[1]"
            :width="r[2]"
            :height="r[3]"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
    <div class="row">
      <label for="alignGap">{{ t('align.spacing') }}</label>
      <input
        id="alignGap"
        v-model.number="gap"
        class="pt-input gap"
        type="number"
        min="0"
        max="512"
      />
      <span class="pt-unit">px</span>
      <button
        type="button"
        class="pt-btn pt-btn--secondary"
        :disabled="ids.length < 2"
        :data-tip="t('align.spacingH')"
        :aria-label="t('align.spacingH')"
        @click="spacing('h')"
      >
        {{ t('align.horizontal') }}
      </button>
      <button
        type="button"
        class="pt-btn pt-btn--secondary"
        :disabled="ids.length < 2"
        :data-tip="t('align.spacingV')"
        :aria-label="t('align.spacingV')"
        @click="spacing('v')"
      >
        {{ t('align.vertical') }}
      </button>
    </div>
    <p v-if="to === 'key'" class="pt-sec2 hint">
      {{ keyId ? t('align.keyOn') : t('align.keyHint') }}
    </p>
  </div>
</template>

<style scoped>
.align {
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
.row > label {
  min-width: 62px;
  color: var(--text-secondary);
}
.row .pt-select {
  flex: 1;
  min-width: 0;
}
.btns {
  display: flex;
  gap: 2px;
}
.btns .pt-iconbtn {
  flex: 1;
}
.gap {
  width: 52px;
}
.hint {
  margin: 0;
}
</style>
