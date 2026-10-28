<script setup lang="ts">
import ToolButton from './ToolButton.vue'
import PtIcon from '@/components/PtIcon.vue'
import ActionButton from '@/components/ActionButton.vue'
import { TOOLBAR } from '@/tools/catalog'
import { useColorsStore } from '@/stores/colors'
import { t } from '@/i18n'

const colors = useColorsStore()
</script>

<template>
  <aside class="pt-toolbar" :aria-label="t('toolbar.label')">
    <template v-for="(item, i) in TOOLBAR" :key="i">
      <div v-if="item.kind === 'sep'" class="pt-tooldiv" />
      <ToolButton v-else :group-id="item.id" :tools="item.tools" />
    </template>

    <div class="pt-spacer" />

    <div class="pt-fswidget" role="group" :aria-label="t('toolbar.fillStroke')">
      <button
        type="button"
        class="pt-fswidget__fill"
        :style="{ background: colors.fill }"
        :aria-label="`${t('controlbar.fill')} ${colors.fill}`"
      />
      <button
        type="button"
        class="pt-fswidget__stroke"
        :style="{ borderColor: colors.stroke }"
        :aria-label="`${t('controlbar.stroke')} ${colors.stroke}`"
      />
    </div>
    <div class="mini">
      <ActionButton id="colors.swap" class="tiny" />
      <ActionButton id="colors.default" class="tiny">
        <span class="defaults" aria-hidden="true"><i /><b /></span>
      </ActionButton>
    </div>
    <div class="modes">
      <button
        type="button"
        class="color"
        :data-tip="t('toolbar.color')"
        :aria-label="t('toolbar.color')"
        :style="{ background: colors.fill }"
      />
      <button
        type="button"
        class="grad"
        :data-tip="t('toolbar.gradient')"
        :aria-label="t('toolbar.gradient')"
      />
      <button
        type="button"
        class="pt-sw--none none"
        :data-tip="t('toolbar.none')"
        :aria-label="t('toolbar.none')"
      />
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
.mini {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
}
.tiny {
  width: 16px;
  height: 16px;
}
.tiny :deep(svg) {
  width: 12px;
  height: 12px;
}
.defaults {
  position: relative;
  width: 10px;
  height: 10px;
  display: block;
}
.defaults i,
.defaults b {
  position: absolute;
  width: 6px;
  height: 6px;
  display: block;
}
.defaults i {
  left: 0;
  top: 0;
  background: #fff;
  box-shadow: 0 0 0 1px #000;
}
.defaults b {
  right: 0;
  bottom: 0;
  border: 2px solid #000;
  box-shadow: 0 0 0 1px #888;
}
.modes {
  display: flex;
  gap: 1px;
  margin-bottom: var(--space-3);
}
.modes button {
  width: 10px;
  height: 10px;
  padding: 0;
  border: 0;
  box-shadow: 0 0 0 1px var(--border-input);
}
.modes .color {
  box-shadow: 0 0 0 1px var(--accent);
}
.modes .grad {
  background: linear-gradient(90deg, #fff, #000);
}
</style>
