<script setup lang="ts">
import PtIcon from '@/components/PtIcon.vue'
import { useDocumentsStore } from '@/stores/documents'
import { t } from '@/i18n'

const docs = useDocumentsStore()
</script>

<template>
  <div class="pt-doctabs" role="tablist" :aria-label="t('docs.tabs')">
    <button
      v-for="tab in docs.tabs"
      :key="tab.id"
      type="button"
      class="pt-doctab"
      :class="{ 'is-active': tab.id === docs.activeId }"
      role="tab"
      :aria-selected="tab.id === docs.activeId"
      @click="docs.activeId = tab.id"
    >
      {{ tab.name }}.pixeltor
      <span class="pt-doctab__zoom">@ {{ tab.zoom }} %</span>
      <span v-if="tab.dirty" class="pt-dirty" :data-tip="t('docs.unsaved')" />
      <span class="pt-iconbtn" role="button" :aria-label="t('docs.close')">
        <PtIcon name="close" class="x" />
      </span>
    </button>
  </div>
</template>

<style scoped>
.x {
  width: 12px;
  height: 12px;
}
</style>
