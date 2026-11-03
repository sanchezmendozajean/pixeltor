<script setup lang="ts">
import { computed } from 'vue'
import ToolButton from './ToolButton.vue'
import PtIcon from '@/components/PtIcon.vue'
import { actionLabel, execute } from '@/actions/registry'
import { TOOLBAR } from '@/tools/catalog'
import { useColorsStore } from '@/stores/colors'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

const colors = useColorsStore()
const tools = useToolsStore()
const ui = useUiStore()

// Relleno y contorno como en Illustrator: la disposición cambia con una o dos columnas.
const two = computed(() => ui.toolbarColumns === 2)
const size = computed(() => (two.value ? 50 : 30))
const chip = computed(() => Math.round(size.value * 0.66))
const ring = computed(() => Math.max(6, Math.round(chip.value * 0.3)))
const modeSize = computed(() => (two.value ? 17 : 10))

const SWAP_SVG =
  '<g transform="rotate(90 12 12)"><path d="M6 18v-7a5 5 0 0 1 5-5h7"/><path d="m15 3 3 3-3 3"/><path d="m3 15 3 3 3-3"/></g>'
const DEFAULTS_SVG =
  '<polygon fill="#fff" points="3,12 3,9 0,9 0,0 9,0 9,3 12,3 12,12"/><rect x="4" y="4" width="7" height="7"/><rect x="6" y="6" width="3" height="3" fill="#fff"/><rect x="1" y="1" width="7" height="7"/><rect x="2" y="2" width="5" height="5" fill="#fff"/>'
const MODES = [
  {
    id: 'color',
    label: 'toolbar.color',
    svg: '<rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor"/>'
  },
  {
    id: 'gradient',
    label: 'toolbar.gradient',
    svg: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18" opacity=".85"/><path d="M11 3v18" opacity=".6"/><path d="M15 3v18" opacity=".35"/><path d="M18.5 3v18" opacity=".15"/>'
  },
  {
    id: 'none',
    label: 'toolbar.none',
    svg: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M5 19 19 5" style="stroke: var(--danger)"/>'
  }
] as const

type PaintMode = (typeof MODES)[number]['id']

/** Modo de pintura de relleno o contorno: «ninguno» es el interruptor de las opciones de la herramienta. */
function modeOf(target: 'fill' | 'stroke'): PaintMode {
  if (!(target === 'fill' ? tools.useFill : tools.useStroke)) return 'none'
  return (target === 'fill' ? colors.fillGradient : colors.strokeGradient) ? 'gradient' : 'color'
}

function setMode(m: PaintMode): void {
  const on = m !== 'none'
  if (colors.target === 'fill') {
    tools.useFill = on
    colors.fillGradient = m === 'gradient'
  } else {
    tools.useStroke = on
    colors.strokeGradient = m === 'gradient'
  }
}

/** Fondo del cuadro de relleno según su modo. */
const fillBackground = computed(() => {
  const m = modeOf('fill')
  if (m === 'gradient') return `linear-gradient(to right, ${colors.fill}, ${colors.stroke})`
  if (m === 'none')
    return 'linear-gradient(to top right, transparent calc(50% - 1px), var(--danger) calc(50% - 1px), var(--danger) calc(50% + 1px), transparent calc(50% + 1px)) #fff'
  return colors.fill
})
</script>

<!-- eslint-disable vue/no-v-html -- los SVG son constantes del propio componente -->
<template>
  <aside
    class="pt-toolbar"
    :class="{ 'is-two': ui.toolbarColumns === 2 }"
    :aria-label="t('toolbar.label')"
  >
    <button
      type="button"
      class="cols"
      :data-tip="t(ui.toolbarColumns === 2 ? 'toolbar.oneColumn' : 'toolbar.twoColumns')"
      :aria-label="t(ui.toolbarColumns === 2 ? 'toolbar.oneColumn' : 'toolbar.twoColumns')"
      @click="ui.setToolbarColumns(ui.toolbarColumns === 2 ? 1 : 2)"
    >
      <PtIcon :name="ui.toolbarColumns === 2 ? 'chevLeft' : 'chevRight'" />
    </button>
    <div class="tools">
      <template v-for="(item, i) in TOOLBAR" :key="i">
        <div v-if="item.kind === 'sep'" class="pt-tooldiv" />
        <ToolButton v-else :group-id="item.id" :tools="item.tools" />
      </template>
    </div>

    <div class="pt-spacer" />

    <div class="paint">
      <div v-if="!two" class="paint__row">
        <button
          type="button"
          class="corner"
          :data-tip="actionLabel('colors.default')"
          :aria-label="actionLabel('colors.default')"
          @click="execute('colors.default')"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            shape-rendering="crispEdges"
            aria-hidden="true"
            v-html="DEFAULTS_SVG"
          />
        </button>
        <button
          type="button"
          class="corner"
          :data-tip="actionLabel('colors.swap')"
          :aria-label="actionLabel('colors.swap')"
          @click="execute('colors.swap')"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            v-html="SWAP_SVG"
          />
        </button>
      </div>
      <div
        class="pt-fswidget"
        :style="{ width: `${size}px`, height: `${size}px` }"
        role="group"
        :aria-label="t('toolbar.fillStroke')"
      >
        <!-- Dibujo del contorno (anillo de color con marco negro y blanco); el botón de abajo sólo recibe los clics. -->
        <span
          class="pt-fswidget__face"
          :class="{ 'is-top': colors.target === 'stroke' }"
          :style="{
            width: `${chip - 2 * ring}px`,
            height: `${chip - 2 * ring}px`,
            left: `${size - chip + ring}px`,
            top: `${size - chip + ring}px`,
            '--ring': `${ring}px`,
            '--paint': modeOf('stroke') === 'none' ? 'transparent' : colors.stroke
          }"
          aria-hidden="true"
        />
        <button
          type="button"
          class="pt-fswidget__stroke"
          :class="{ 'is-top': colors.target === 'stroke' }"
          :style="{
            width: `${chip}px`,
            height: `${chip}px`,
            left: `${size - chip}px`,
            top: `${size - chip}px`,
            '--ring': `${ring}px`
          }"
          :aria-label="`${t('controlbar.stroke')} ${colors.stroke}`"
          :aria-pressed="colors.target === 'stroke'"
          @click="colors.target = 'stroke'"
          @dblclick="ui.colorPicker = 'stroke'"
        />
        <button
          type="button"
          class="pt-fswidget__fill"
          :class="{ 'is-top': colors.target === 'fill' }"
          :style="{ width: `${chip - 1}px`, height: `${chip - 1}px`, background: fillBackground }"
          :aria-label="`${t('controlbar.fill')} ${colors.fill}`"
          :aria-pressed="colors.target === 'fill'"
          @click="colors.target = 'fill'"
          @dblclick="ui.colorPicker = 'fill'"
        />
        <template v-if="two">
          <button
            type="button"
            class="corner abs swap"
            :style="{ width: `${size - chip}px`, height: `${size - chip}px` }"
            :data-tip="actionLabel('colors.swap')"
            :aria-label="actionLabel('colors.swap')"
            @click="execute('colors.swap')"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              v-html="SWAP_SVG"
            />
          </button>
          <button
            type="button"
            class="corner abs defaults"
            :style="{ width: `${size - chip}px`, height: `${size - chip}px` }"
            :data-tip="actionLabel('colors.default')"
            :aria-label="actionLabel('colors.default')"
            @click="execute('colors.default')"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              shape-rendering="crispEdges"
              aria-hidden="true"
              v-html="DEFAULTS_SVG"
            />
          </button>
        </template>
      </div>
    </div>
    <div class="modes">
      <button
        v-for="m in MODES"
        :key="m.id"
        type="button"
        :class="{ 'is-active': m.id === modeOf(colors.target) }"
        :aria-pressed="m.id === modeOf(colors.target)"
        :style="{ width: `${modeSize}px`, height: `${modeSize + 6}px` }"
        :data-tip="t(m.label)"
        :aria-label="t(m.label)"
        @click="setMode(m.id)"
      >
        <svg
          viewBox="0 0 24 24"
          :width="modeSize"
          :height="modeSize"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          v-html="m.svg"
        />
      </button>
    </div>

    <div class="pt-tooldiv" />
    <button
      type="button"
      class="pt-toolbtn has-fly"
      :data-tip="t('toolbar.screenMode')"
      :aria-label="t('toolbar.screenMode')"
    >
      <PtIcon name="screenMode" />
    </button>
  </aside>
</template>

<style scoped>
.tools {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.is-two .tools {
  display: grid;
  grid-template-columns: repeat(2, 32px);
  gap: 0 2px;
  justify-content: center;
}
.is-two .tools :deep(.pt-tooldiv) {
  grid-column: 1 / -1;
  justify-self: center;
}
.cols {
  width: 32px;
  height: 14px;
  margin-bottom: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--icon);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cols:hover {
  color: var(--icon-active);
  background: var(--bg-hover);
}
.cols :deep(svg) {
  width: 12px;
  height: 12px;
}
.paint {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.paint__row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 0 2px;
}
.corner {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--icon);
}
.corner.abs {
  position: absolute;
  z-index: 3;
}
.corner.swap {
  right: 0;
  top: 0;
}
.corner.defaults {
  left: 0;
  bottom: 0;
}
.modes {
  display: flex;
  margin-top: 4px;
  margin-bottom: var(--space-3);
}
.modes button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--icon);
}
.modes button.is-active {
  color: var(--icon-active);
}
</style>
