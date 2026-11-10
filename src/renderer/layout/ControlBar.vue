<script setup lang="ts">
// Barra de control contextual: opciones de la herramienta activa, colores y opacidad de la capa.
import { computed, onBeforeUnmount, ref } from 'vue'
import { activePalette, colorHex } from '@core/index'
import { openColorDialog } from '@/app/colorDialog'
import { setWorkingColor } from '@/app/colorOps'
import PtIcon from '@/components/PtIcon.vue'
import { actionIcon, actionLabel, execute } from '@/actions/registry'
import { useColorsStore } from '@/stores/colors'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { useToolsStore } from '@/stores/tools'
import { t } from '@/i18n'

const tools = useToolsStore()
const colors = useColorsStore()
const docs = useDocumentsStore()
const ui = useUiStore()

const usesSize = computed(() => tools.active === 'brush' || tools.active === 'eraser')
const usesShape = usesSize
const CONVERT_BUTTONS: { id: string; icon: string; side?: 'in' | 'out' }[] = [
  { id: 'anchor.toCorner', icon: 'anchorCorner' },
  { id: 'anchor.toSmooth', icon: 'anchorSmooth' },
  { id: 'anchor.handleIn', icon: 'anchorHandleIn', side: 'in' },
  { id: 'anchor.handleOut', icon: 'anchorHandleOut', side: 'out' }
]
const ANCHOR_BUTTONS = [
  { id: 'object.addAnchors', icon: 'addAnchor', needsAnchors: false },
  { id: 'anchor.delete', icon: 'delAnchor', needsAnchors: true },
  { id: 'anchor.cut', icon: 'scissors', needsAnchors: true },
  { id: 'anchor.join', icon: 'join', needsAnchors: false, needsTwo: true }
]
const anchorTool = computed(() =>
  ['dsel', 'pen', 'addAnchor', 'delAnchor', 'convAnchor'].includes(tools.active)
)
const usesSymmetry = computed(() => ['pencil', 'brush', 'eraser'].includes(tools.active))
const usesFill = computed(() => tools.active === 'bucket' || tools.active === 'wand')
const isShape = computed(() =>
  ['rect', 'ellipse', 'polygon', 'star', 'line', 'pen'].includes(tools.active)
)
const closedShape = computed(() => ['rect', 'ellipse', 'polygon', 'star'].includes(tools.active))
const usesSample = computed(() => usesFill.value || tools.active === 'eyedrop')

const layer = computed(() => docs.layers.find((l) => l.active))
const opacityPct = computed(() => Math.round((layer.value?.opacity ?? 1) * 100))

// Desplegable de muestras bajo los indicadores de relleno y contorno
const swOpen = ref<'fill' | 'stroke' | null>(null)
const swPos = ref({ left: 0, top: 0 })
const swatches = computed(() => {
  void docs.rev
  return docs.session ? [...activePalette(docs.session).swatches] : []
})
const swHex = (c: { r: number; g: number; b: number }): string =>
  `#${colorHex({ ...c, a: 255 })}`.toUpperCase()
function closeSw(): void {
  swOpen.value = null
  window.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('keydown', onKey, true)
}
function onOutside(e: Event): void {
  if (!(e.target as HTMLElement).closest?.('.cb-swpop, .cb-swbtn')) closeSw()
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeSw()
}
function toggleSw(which: 'fill' | 'stroke', e: MouseEvent): void {
  colors.target = which
  if (swOpen.value === which) return closeSw()
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  swPos.value = { left: Math.max(4, Math.min(r.left, window.innerWidth - 244)), top: r.bottom + 4 }
  swOpen.value = which
  window.addEventListener('pointerdown', onOutside, true)
  window.addEventListener('keydown', onKey, true)
}
/** Doble clic: selector de color completo junto al indicador. */
function pickWorking(which: 'fill' | 'stroke', e: MouseEvent): void {
  closeSw()
  const before = colors[which]
  openColorDialog(e.currentTarget as Element, before, {
    onChange: (hex) => setWorkingColor(which, hex),
    onRevert: () => {
      colors[which] = before
    }
  })
}
function pickSwatch(c: { r: number; g: number; b: number }): void {
  setWorkingColor(swOpen.value ?? colors.target, swHex(c))
}
onBeforeUnmount(closeSw)

function num(e: Event): number {
  return Number.parseInt((e.target as HTMLInputElement).value, 10)
}
function onOpacity(e: Event): void {
  const v = num(e)
  if (layer.value && Number.isFinite(v))
    docs.session?.setLayerProps(layer.value.id, { opacity: Math.min(100, Math.max(0, v)) / 100 })
}
function onSize(e: Event): void {
  const v = num(e)
  if (Number.isFinite(v)) tools.setBrushSize(v)
}
function onTolerance(e: Event): void {
  const v = num(e)
  if (Number.isFinite(v)) tools.tolerance = Math.min(255, Math.max(0, v))
}
</script>

<template>
  <div class="pt-cbar" role="toolbar" :aria-label="t('controlbar.label')">
    <div class="pt-ctl pt-ctl__kind">
      <PtIcon
        v-if="actionIcon(`tool.${tools.active}`)"
        :name="actionIcon(`tool.${tools.active}`)!"
      />
      <span>{{ actionLabel(`tool.${tools.active}`) }}</span>
    </div>
    <span class="pt-sep pt-sep--inset" />

    <template v-if="usesSize">
      <label class="pt-num small">
        <span class="pt-num__lbl">{{ t('tooloptions.size') }}</span>
        <span class="pt-numbox">
          <input class="pt-input" :value="tools.brushSize" inputmode="numeric" @change="onSize" />
          <span class="pt-unit">px</span>
        </span>
      </label>
    </template>
    <template v-if="anchorTool">
      <span class="pt-ctl__lbl">{{ t('controlbar.convert') }}</span>
      <button
        v-for="b in CONVERT_BUTTONS"
        :key="b.id"
        type="button"
        class="pt-iconbtn pt-iconbtn--20"
        :disabled="!ui.anchorCount || (b.side !== undefined && !ui.anchorSides[b.side])"
        :data-tip="actionLabel(b.id)"
        :aria-label="actionLabel(b.id)"
        @click="execute(b.id)"
      >
        <PtIcon :name="b.icon" />
      </button>
      <span class="pt-sep pt-sep--inset" />
      <span class="pt-ctl__lbl">{{ t('controlbar.anchors') }}</span>
      <button
        v-for="b in ANCHOR_BUTTONS"
        :key="b.id"
        type="button"
        class="pt-iconbtn pt-iconbtn--20"
        :disabled="(b.needsAnchors && !ui.anchorCount) || (b.needsTwo && ui.anchorCount !== 2)"
        :data-tip="actionLabel(b.id)"
        :aria-label="actionLabel(b.id)"
        @click="execute(b.id)"
      >
        <PtIcon :name="b.icon" />
      </button>
    </template>
    <template v-if="usesSymmetry">
      <label class="pt-check-label">
        <input v-model="tools.symmetry.x" type="checkbox" />
        {{ t('tooloptions.symX') }}
      </label>
      <label class="pt-check-label">
        <input v-model="tools.symmetry.y" type="checkbox" />
        {{ t('tooloptions.symY') }}
      </label>
      <label class="pt-ctl">
        <span class="pt-ctl__lbl">{{ t('tooloptions.symRot') }}</span>
        <select v-model.number="tools.symmetry.rot" class="pt-select shape">
          <option :value="1">{{ t('tooloptions.symNone') }}</option>
          <option :value="2">180°</option>
          <option :value="4">90°</option>
        </select>
      </label>
    </template>
    <label v-if="usesSize" class="pt-check-label" :data-tip="t('tooloptions.pressureTip')">
      <input v-model="tools.pressure" type="checkbox" />
      {{ t('tooloptions.pressure') }}
    </label>
    <label v-if="usesShape" class="pt-ctl">
      <span class="pt-ctl__lbl">{{ t('tooloptions.shape') }}</span>
      <select v-model="tools.brushShape" class="pt-select shape">
        <option value="square">{{ t('tooloptions.square') }}</option>
        <option value="round">{{ t('tooloptions.round') }}</option>
      </select>
    </label>
    <template v-if="usesFill">
      <label class="pt-num small">
        <span class="pt-num__lbl">{{ t('tooloptions.tolerance') }}</span>
        <span class="pt-numbox">
          <input
            class="pt-input"
            :value="tools.tolerance"
            inputmode="numeric"
            @change="onTolerance"
          />
        </span>
      </label>
      <label class="pt-check-label">
        <input v-model="tools.contiguous" type="checkbox" />
        {{ t('tooloptions.contiguous') }}
      </label>
    </template>
    <label v-if="usesSample" class="pt-check-label">
      <input v-model="tools.sampleAll" type="checkbox" />
      {{ t('tooloptions.sampleAll') }}
    </label>
    <template v-if="isShape">
      <label v-if="closedShape" class="pt-check-label">
        <input v-model="tools.useFill" type="checkbox" />
        {{ t('tooloptions.fill') }}
      </label>
      <label class="pt-check-label">
        <input v-model="tools.useStroke" type="checkbox" />
        {{ t('tooloptions.stroke') }}
      </label>
      <label class="pt-num small">
        <span class="pt-num__lbl">{{ t('tooloptions.width') }}</span>
        <span class="pt-numbox">
          <input
            v-model.number="tools.strokeWidth"
            class="pt-input"
            type="number"
            min="1"
            max="64"
          />
        </span>
      </label>
      <label v-if="tools.active === 'rect'" class="pt-num small">
        <span class="pt-num__lbl">{{ t('tooloptions.radius') }}</span>
        <span class="pt-numbox">
          <input v-model.number="tools.cornerRadius" class="pt-input" type="number" min="0" />
        </span>
      </label>
      <label v-if="tools.active === 'polygon'" class="pt-num small">
        <span class="pt-num__lbl">{{ t('tooloptions.sides') }}</span>
        <span class="pt-numbox">
          <input
            v-model.number="tools.polygonSides"
            class="pt-input"
            type="number"
            min="3"
            max="64"
          />
        </span>
      </label>
      <label v-if="tools.active === 'star'" class="pt-num small">
        <span class="pt-num__lbl">{{ t('tooloptions.points') }}</span>
        <span class="pt-numbox">
          <input
            v-model.number="tools.starPoints"
            class="pt-input"
            type="number"
            min="3"
            max="64"
          />
        </span>
      </label>
    </template>
    <span v-if="usesSize || usesFill || usesSample || isShape" class="pt-sep pt-sep--inset" />

    <div class="pt-ctl">
      <span class="pt-ctl__lbl">{{ t('controlbar.fill') }}</span>
      <button
        type="button"
        class="pt-swbtn cb-swbtn"
        :aria-label="t('controlbar.fill')"
        :aria-expanded="swOpen === 'fill'"
        @click="toggleSw('fill', $event)"
        @dblclick="pickWorking('fill', $event)"
      >
        <span class="pt-sw" :style="{ background: colors.fill }" />
        <PtIcon name="chevDown" />
      </button>
    </div>
    <div class="pt-ctl">
      <span class="pt-ctl__lbl">{{ t('controlbar.stroke') }}</span>
      <button
        type="button"
        class="pt-swbtn cb-swbtn"
        :aria-label="t('controlbar.stroke')"
        :aria-expanded="swOpen === 'stroke'"
        @click="toggleSw('stroke', $event)"
        @dblclick="pickWorking('stroke', $event)"
      >
        <span class="pt-sw pt-sw--stroke" :style="{ borderColor: colors.stroke }" />
        <PtIcon name="chevDown" />
      </button>
    </div>
    <div
      v-if="swOpen"
      class="pt-popover cb-swpop"
      :style="{ left: swPos.left + 'px', top: swPos.top + 'px' }"
    >
      <div class="pt-swgrid">
        <button
          v-for="s in swatches"
          :key="s.id"
          type="button"
          class="pt-swcell"
          :style="{ background: swHex(s.color) }"
          :title="s.name ?? swHex(s.color)"
          :aria-label="t('swatches.apply', { hex: swHex(s.color) })"
          @click="pickSwatch(s.color)"
        />
      </div>
      <p v-if="!swatches.length" class="cb-swnone">{{ t('panels.emptySwatches') }}</p>
    </div>
    <span class="pt-sep pt-sep--inset" />
    <label class="pt-num opacity">
      <span class="pt-num__lbl">{{ t('controlbar.opacity') }}</span>
      <span class="pt-numbox">
        <input
          class="pt-input"
          :value="opacityPct"
          inputmode="numeric"
          :disabled="!layer"
          :aria-label="t('controlbar.opacity')"
          @change="onOpacity"
        />
        <span class="pt-unit">%</span>
      </span>
    </label>
  </div>
</template>

<style scoped>
.cb-swpop {
  position: fixed;
  z-index: 1000;
  width: 240px;
  padding: 8px;
}
.cb-swnone {
  margin: 0;
  color: var(--text-secondary);
}
.opacity {
  width: 112px;
}
.small {
  width: 96px;
}
.shape {
  width: 96px;
}
.pt-check-label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-secondary);
  white-space: nowrap;
}
</style>
