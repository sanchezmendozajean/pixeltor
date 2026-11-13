<script setup lang="ts">
// Pantalla de inicio (sin documentos abiertos): documento nuevo 32×32, 64×64 o de tamaño libre
// (diálogo «Nuevo»), abrir un archivo y lista de recientes (specs/design/23-pantallas.md §1).
import { onMounted, ref } from 'vue'
import PtIcon from '@/components/PtIcon.vue'
import { newDocument, openFile } from '@/app/documentOps'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

const PRESETS = [32, 64] as const

const ui = useUiStore()
const recent = ref<string[]>([])

function baseName(path: string): string {
  return (path.split(/[\\/]/).pop() ?? path).replace(/\.pixeltor$/i, '')
}

function dirName(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i > 0 ? path.slice(0, i) : ''
}

async function reload(): Promise<void> {
  recent.value = (await window.pixeltor.settings.get()).recentFiles
}

async function openRecent(path: string): Promise<void> {
  await openFile(path)
  // si ya no existe, main lo quita de la lista
  await reload()
}

async function clearRecent(): Promise<void> {
  recent.value = (await window.pixeltor.settings.set({ recentFiles: [] })).recentFiles
}

onMounted(reload)
</script>

<template>
  <section class="welcome" :aria-label="t('welcome.title')">
    <div class="inner">
      <h1>{{ t('welcome.title') }}</h1>

      <h2>{{ t('welcome.new') }}</h2>
      <div class="cards">
        <button
          v-for="n in PRESETS"
          :key="n"
          type="button"
          class="card"
          :data-testid="`welcome-${n}`"
          @click="newDocument(n, n)"
        >
          <PtIcon name="file" />
          <span class="name">{{ n }} × {{ n }}</span>
          <span class="hint">{{ t('welcome.pixels') }}</span>
        </button>

        <button
          type="button"
          class="card"
          data-testid="welcome-custom"
          @click="ui.dialog = 'new'"
        >
          <PtIcon name="newDoc" />
          <span class="name">{{ t('welcome.custom') }}</span>
          <span class="hint">{{ t('welcome.customHint') }}</span>
        </button>
      </div>

      <div class="rowhead">
        <h2>{{ t('welcome.recent') }}</h2>
        <button
          v-if="recent.length"
          type="button"
          class="pt-btn pt-btn--secondary"
          @click="clearRecent"
        >
          {{ t('welcome.clear') }}
        </button>
        <button type="button" class="pt-btn pt-btn--secondary open" @click="openFile()">
          <PtIcon name="folderOpen" />
          {{ t('welcome.open') }}
        </button>
      </div>
      <ul v-if="recent.length" class="recent">
        <li v-for="p in recent" :key="p">
          <button type="button" class="entry" :title="p" @click="openRecent(p)">
            <span class="fname">{{ baseName(p) }}</span>
            <span class="dir">{{ dirName(p) }}</span>
          </button>
        </li>
      </ul>
      <p v-else class="none">{{ t('welcome.noRecent') }}</p>
    </div>
  </section>
</template>

<style scoped>
.welcome {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  justify-content: center;
  background: var(--bg-app);
  color: var(--text-primary);
}
.inner {
  width: min(672px, 100%);
  padding: 32px var(--space-6) var(--space-6);
}
h1 {
  margin: 0 0 28px;
  font-size: var(--fs-xl);
  font-weight: var(--fw-semibold);
}
h2 {
  margin: 0 0 var(--space-5);
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--panel-header-tracking);
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, 160px);
  gap: var(--space-5);
  margin-bottom: 40px;
}
.card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  height: 88px;
  padding: var(--space-5) var(--space-6);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: default;
}
.card :deep(svg) {
  width: 24px;
  height: 24px;
  margin-bottom: var(--space-3);
  fill: currentColor;
}
.card:hover {
  background: var(--bg-hover);
  border-color: var(--border-input-hover);
}
.card:focus-visible,
.entry:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}
.name {
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
}
.hint {
  font-size: var(--fs-sm);
  color: var(--text-secondary);
}
.rowhead {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}
.rowhead h2 {
  flex: 1;
  margin-top: var(--space-3);
}
.rowhead .pt-btn {
  gap: var(--space-3);
}
.recent {
  list-style: none;
  margin: var(--space-4) 0 0;
  padding: 0;
}
.entry {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-5);
  background: transparent;
  border: 0;
  border-radius: var(--radius-md);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: default;
}
.entry:hover {
  background: var(--bg-hover);
}
.fname {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
}
.dir {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: var(--fs-sm);
}
.none {
  color: var(--text-secondary);
  font-size: var(--fs-md);
}
</style>
