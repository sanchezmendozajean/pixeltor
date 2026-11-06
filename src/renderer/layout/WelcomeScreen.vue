<script setup lang="ts">
// Pantalla de inicio (sin documentos abiertos): documento nuevo 32×32, 64×64 o de tamaño libre,
// abrir un archivo y lista de recientes (specs/design/23-pantallas.md §1).
import { computed, onMounted, ref } from 'vue'
import { MAX_SIZE } from '@core/index'
import { newDocument, openFile } from '@/app/documentOps'
import { t } from '@/i18n'

const PRESETS = [32, 64] as const

const recent = ref<string[]>([])
const width = ref(32)
const height = ref(32)

const customValid = computed(
  () =>
    Number.isInteger(width.value) &&
    Number.isInteger(height.value) &&
    width.value >= 1 &&
    height.value >= 1 &&
    width.value <= MAX_SIZE &&
    height.value <= MAX_SIZE
)

/** Lado mayor de la vista previa de la tarjeta, en px; el resto es proporcional. */
function previewStyle(w: number, h: number): Record<string, string> {
  const k = 56 / Math.max(w, h, 1)
  return {
    width: `${Math.max(2, Math.round(w * k))}px`,
    height: `${Math.max(2, Math.round(h * k))}px`
  }
}

function baseName(path: string): string {
  return (path.split(/[\\/]/).pop() ?? path).replace(/\.pixeltor$/i, '')
}

function dirName(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i > 0 ? path.slice(0, i) : ''
}

function createCustom(): void {
  if (customValid.value) newDocument(width.value, height.value)
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
      <header>
        <h1>{{ t('welcome.title') }}</h1>
        <p>{{ t('welcome.subtitle') }}</p>
      </header>

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
          <span class="thumb"><span class="shape" :style="previewStyle(n, n)" /></span>
          <span class="name">{{ n }} × {{ n }}</span>
          <span class="hint">{{ t('welcome.pixels') }}</span>
        </button>

        <form class="card custom" data-testid="welcome-custom" @submit.prevent="createCustom">
          <span class="thumb">
            <span
              class="shape"
              :style="previewStyle(customValid ? width : 1, customValid ? height : 1)"
            />
          </span>
          <span class="name">{{ t('welcome.custom') }}</span>
          <span class="size">
            <input
              v-model.number="width"
              class="pt-input"
              type="number"
              min="1"
              :max="MAX_SIZE"
              :aria-label="t('dialogs.new.width')"
            />
            <span class="x">×</span>
            <input
              v-model.number="height"
              class="pt-input"
              type="number"
              min="1"
              :max="MAX_SIZE"
              :aria-label="t('dialogs.new.height')"
            />
          </span>
          <button type="submit" class="pt-btn pt-btn--primary pt-btn--lg" :disabled="!customValid">
            {{ t('dialogs.new.create') }}
          </button>
        </form>
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
        <button type="button" class="pt-btn pt-btn--secondary" @click="openFile()">
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
  width: min(640px, 100%);
  padding: 48px var(--space-6) var(--space-6);
}
h1 {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: var(--fw-semibold);
}
header p {
  margin: var(--space-2) 0 28px;
  color: var(--text-secondary);
  font-size: var(--fs-md);
}
h2 {
  margin: 0 0 var(--space-4);
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--panel-header-tracking);
}
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
  margin-bottom: 28px;
}
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: inherit;
  font: inherit;
  cursor: default;
}
button.card:hover {
  background: var(--bg-hover);
  border-color: var(--border-input-hover);
}
button.card:focus-visible,
.entry:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}
.thumb {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.shape {
  display: block;
  background: var(--bg-input);
  border: 1px solid var(--border-input-hover);
}
.name {
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
}
.hint {
  font-size: var(--fs-sm);
  color: var(--text-secondary);
}
.size {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
}
.x {
  color: var(--text-secondary);
}
.custom .pt-btn {
  width: 100%;
}
.rowhead {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
}
.rowhead h2 {
  flex: 1;
}
.rowhead .pt-btn {
  height: 20px;
}
.recent {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.recent li + li {
  border-top: 1px solid var(--border-subtle);
}
.entry {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-5);
  height: var(--row-h);
  padding: 0 var(--space-5);
  background: var(--bg-panel);
  border: 0;
  color: inherit;
  font: inherit;
  font-size: var(--fs-md);
  text-align: left;
  cursor: default;
}
.entry:hover {
  background: var(--bg-hover);
}
.fname {
  flex: none;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dir {
  flex: 1;
  min-width: 0;
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
