<script setup lang="ts">
import PtIcon from '@/components/PtIcon.vue'
import { closeWorkspace } from '@/app/documentOps'
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
      @click="docs.activate(tab.id)"
      @auxclick.middle.prevent="closeWorkspace(tab.id)"
    >
      {{ tab.name }}.pixeltor
      <span v-if="tab.id === docs.activeId" class="pt-doctab__zoom"
        >@ {{ docs.zoomPercent }} %</span
      >
      <span v-if="tab.dirty" class="pt-dirty" :data-tip="t('docs.unsaved')" />
      <span
        class="pt-iconbtn"
        role="button"
        :aria-label="t('docs.close')"
        @click.stop="closeWorkspace(tab.id)"
      >
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
