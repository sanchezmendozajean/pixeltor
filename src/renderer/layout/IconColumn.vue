<script setup lang="ts">
// Columna de iconos con los paneles que no caben en el dock; cada uno abre como flotante anclado.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Panel, { type PanelTab } from './Panel.vue'
import PtIcon from '@/components/PtIcon.vue'
import { t, type I18nKey } from '@/i18n'

interface Entry {
  id: string
  icon: string
  label: I18nKey
}

const GROUPS: Entry[][] = [
  [
    { id: 'navigator', icon: 'navigator', label: 'panels.navigator' },
    { id: 'align', icon: 'align', label: 'panels.align' }
  ],
  [
    { id: 'stroke', icon: 'stroke', label: 'panels.stroke' },
    { id: 'gradient', icon: 'gradientp', label: 'panels.gradient' },
    { id: 'styles', icon: 'styles', label: 'panels.styles' }
  ],
  [
    { id: 'preview', icon: 'preview', label: 'panels.preview' },
    { id: 'pathfinder', icon: 'pathfinder', label: 'panels.pathfinder' }
  ]
]

const open = ref<Entry | null>(null)
const root = ref<HTMLElement | null>(null)

const tabsFor = (e: Entry): PanelTab[] => [
  { id: e.id, label: e.label, empty: 'panels.emptyGeneric' }
]

function outside(ev: PointerEvent): void {
  if (open.value && !root.value?.contains(ev.target as Node)) open.value = null
}

onMounted(() => document.addEventListener('pointerdown', outside, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside, true))
</script>

<template>
  <nav ref="root" class="pt-iconcol" :aria-label="t('dock.collapsed')">
    <template v-for="(group, gi) in GROUPS" :key="gi">
      <div v-if="gi > 0" class="pt-tooldiv" />
      <button
        v-for="entry in group"
        :key="entry.id"
        type="button"
        class="pt-iconbtn pt-iconbtn--28"
        :class="{ 'is-active': open?.id === entry.id }"
        :data-tip="t(entry.label)"
        :aria-label="t(entry.label)"
        @click="open = open?.id === entry.id ? null : entry"
      >
        <PtIcon :name="entry.icon" />
      </button>
    </template>
    <div v-if="open" class="float">
      <Panel :key="open.id" :tabs="tabsFor(open)" :collapsible="false" />
    </div>
  </nav>
</template>

<style scoped>
.pt-iconcol {
  position: relative;
}
.float {
  position: absolute;
  top: 0;
  right: 100%;
  width: 240px;
  height: 220px;
  display: flex;
  background: var(--bg-panel);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-popover);
  z-index: 20;
}
</style>
