<script setup lang="ts">
// Barra de control contextual: opciones de la herramienta activa, colores y opacidad de la capa.
import { computed } from 'vue'
import PtIcon from '@/components/PtIcon.vue'
import { actionIcon, actionLabel } from '@/actions/registry'
import { useColorsStore } from '@/stores/colors'
import { useDocumentsStore } from '@/stores/documents'
import { useToolsStore } from '@/stores/tools'
import { t } from '@/i18n'

const tools = useToolsStore()
const colors = useColorsStore()
const docs = useDocumentsStore()

const usesSize = computed(() => tools.active === 'brush' || tools.active === 'eraser')
const usesShape = usesSize
const usesFill = computed(() => tools.active === 'bucket' || tools.active === 'wand')
const usesSample = computed(() => usesFill.value || tools.active === 'eyedrop')

const layer = computed(() => docs.layers.find((l) => l.active))
const opacityPct = computed(() => Math.round((layer.value?.opacity ?? 1) * 100))

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
    <span v-if="usesSize || usesFill || usesSample" class="pt-sep pt-sep--inset" />

    <div class="pt-ctl">
      <span class="pt-ctl__lbl">{{ t('controlbar.fill') }}</span>
      <button
        type="button"
        class="pt-swbtn"
        :aria-label="t('controlbar.fill')"
        @click="colors.target = 'fill'"
      >
        <span class="pt-sw" :style="{ background: colors.fill }" />
        <PtIcon name="chevDown" />
      </button>
    </div>
    <div class="pt-ctl">
      <span class="pt-ctl__lbl">{{ t('controlbar.stroke') }}</span>
      <button
        type="button"
        class="pt-swbtn"
        :aria-label="t('controlbar.stroke')"
        @click="colors.target = 'stroke'"
      >
        <span class="pt-sw pt-sw--stroke" :style="{ borderColor: colors.stroke }" />
        <PtIcon name="chevDown" />
      </button>
    </div>
    <span class="pt-sep pt-sep--inset" />
    <label class="pt-num opacity">
      <span class="pt-num__lbl">{{ t('controlbar.opacity') }}</span>
      <span class="pt-numbox">
        <input
          class="pt-input"
          :value="opacityPct"
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
