<script setup lang="ts">
// Barra de control contextual. En F0 muestra la herramienta activa y los colores;
// los campos de transformación aparecen con las formas (F2).
import PtIcon from '@/components/PtIcon.vue'
import { actionIcon, actionLabel } from '@/actions/registry'
import { useColorsStore } from '@/stores/colors'
import { useToolsStore } from '@/stores/tools'
import { t } from '@/i18n'

const tools = useToolsStore()
const colors = useColorsStore()
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
    <div class="pt-ctl">
      <span class="pt-ctl__lbl">{{ t('controlbar.fill') }}</span>
      <button type="button" class="pt-swbtn" :aria-label="t('controlbar.fill')">
        <span class="pt-sw" :style="{ background: colors.fill }" />
        <PtIcon name="chevDown" />
      </button>
    </div>
    <div class="pt-ctl">
      <span class="pt-ctl__lbl">{{ t('controlbar.stroke') }}</span>
      <button type="button" class="pt-swbtn" :aria-label="t('controlbar.stroke')">
        <span class="pt-sw pt-sw--stroke" :style="{ borderColor: colors.stroke }" />
        <PtIcon name="chevDown" />
      </button>
    </div>
    <span class="pt-sep pt-sep--inset" />
    <label class="pt-num opacity">
      <span class="pt-num__lbl">{{ t('controlbar.opacity') }}</span>
      <span class="pt-numbox">
        <input class="pt-input" value="100" :aria-label="t('controlbar.opacity')" />
        <span class="pt-unit">%</span>
      </span>
    </label>
  </div>
</template>

<style scoped>
.opacity {
  width: 112px;
}
</style>
