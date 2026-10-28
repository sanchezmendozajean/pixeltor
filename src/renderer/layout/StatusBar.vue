<script setup lang="ts">
import PtIcon from '@/components/PtIcon.vue'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { t, type I18nKey } from '@/i18n'

const docs = useDocumentsStore()
const ui = useUiStore()

type SnapKey = keyof typeof ui.snap
const SNAPS: { key: SnapKey; icon: string; label: I18nKey }[] = [
  { key: 'grid', icon: 'gridPx', label: 'status.snapGrid' },
  { key: 'anchor', icon: 'snapAnchor', label: 'status.snapAnchor' },
  { key: 'paths', icon: 'paths', label: 'status.snapPaths' },
  { key: 'guides', icon: 'snapGuide', label: 'status.snapGuides' },
  { key: 'canvas', icon: 'snapCanvas', label: 'status.snapCanvas' }
]
</script>

<template>
  <footer class="pt-status" :aria-label="t('status.label')">
    <div class="pt-seg first">
      <button type="button" class="pt-zoomfield" :aria-label="t('status.zoom')">
        <PtIcon name="zoomPx" />
        <span class="pt-mono zoom">{{ docs.active?.zoom }} %</span>
        <PtIcon name="chevDown" />
      </button>
    </div>
    <div class="pt-seg" :data-tip="t('status.size')">
      <span class="pt-mono small"
        ><b>{{ docs.active?.width }} × {{ docs.active?.height }}</b> px</span
      >
    </div>
    <div class="pt-seg" :data-tip="t('status.cursor')">
      <PtIcon name="cursor" class="tiny" />
      <span class="pt-mono small"
        >x <b>{{ t('status.none') }}</b> y <b>{{ t('status.none') }}</b></span
      >
    </div>
    <div class="pt-seg" :data-tip="t('status.color')">
      <span class="pt-sw pt-sw--sm pt-sw--none" />
      <span class="pt-mono small"
        ><b>{{ t('status.none') }}</b></span
      >
    </div>
    <div class="pt-seg">
      {{ t('status.layer') }}: <b>{{ t('status.none') }}</b>
    </div>
    <div class="pt-seg">{{ t('status.image') }} <b>1</b>/1</div>
    <div class="pt-spacer" />
    <div class="pt-seg pt-seg--r snaps" role="group" :aria-label="t('status.snapLabel')">
      <button
        v-for="s in SNAPS"
        :key="s.key"
        type="button"
        class="pt-snap"
        :class="{ 'is-on': ui.snap[s.key] }"
        :aria-pressed="ui.snap[s.key]"
        :data-tip="t(s.label)"
        :aria-label="t(s.label)"
        @click="ui.snap[s.key] = !ui.snap[s.key]"
      >
        <PtIcon :name="s.icon" />
      </button>
      <button
        type="button"
        class="pt-snap pt-snap--smart"
        :class="{ 'is-on': ui.snap.smart }"
        :aria-pressed="ui.snap.smart"
        data-action="view.smartGuides"
        @click="ui.snap.smart = !ui.snap.smart"
      >
        <PtIcon name="magnet" />
      </button>
    </div>
  </footer>
</template>

<style scoped>
.first {
  padding-left: var(--space-3);
}
.zoom {
  font-size: 10.5px;
  min-width: 40px;
  text-align: right;
}
.small {
  font-size: 10.5px;
}
.tiny {
  width: 12px;
  height: 12px;
}
.snaps {
  gap: var(--space-1);
  padding: 0 var(--space-3);
}
</style>
