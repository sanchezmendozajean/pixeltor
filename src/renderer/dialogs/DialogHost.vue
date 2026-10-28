<script setup lang="ts">
// Diálogos modales de F1: Nuevo documento, Exportar PNG y Recuperar documentos; más el aviso breve.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { RecoveryEntry } from '@shared/ipc'
import { MAX_SIZE } from '@core/index'
import PtIcon from '@/components/PtIcon.vue'
import { discardRecovery, exportPng, listRecovery, newDocument, recover } from '@/app/documentOps'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

const ui = useUiStore()
const docs = useDocumentsStore()

const PRESETS = [16, 32, 64, 128, 256, 512]
const width = ref(32)
const height = ref(32)
const scale = ref(4)
const recovery = ref<RecoveryEntry[]>([])

const validSize = computed(
  () =>
    Number.isInteger(width.value) &&
    Number.isInteger(height.value) &&
    width.value >= 1 &&
    height.value >= 1 &&
    width.value <= MAX_SIZE &&
    height.value <= MAX_SIZE
)
const exportSize = computed(() => ({
  w: (docs.session?.image.width ?? 0) * scale.value,
  h: (docs.session?.image.height ?? 0) * scale.value
}))

function close(): void {
  ui.dialog = null
}
function create(): void {
  if (!validSize.value) return
  newDocument(width.value, height.value)
  close()
}
async function doExport(): Promise<void> {
  const ws = docs.active
  if (!ws) return
  close()
  await exportPng(ws, scale.value)
}
async function doRecover(id: string): Promise<void> {
  await recover(id)
  recovery.value = recovery.value.filter((r) => r.docId !== id)
  if (!recovery.value.length) close()
}
async function doDiscard(id: string): Promise<void> {
  await discardRecovery(id)
  recovery.value = recovery.value.filter((r) => r.docId !== id)
  if (!recovery.value.length) close()
}
function setPreset(n: number): void {
  width.value = n
  height.value = n
}

watch(
  () => ui.dialog,
  async (d) => {
    if (d === 'recovery') recovery.value = await listRecovery()
  },
  { immediate: true }
)

function onKey(e: KeyboardEvent): void {
  if (ui.dialog && e.key === 'Escape') {
    e.stopPropagation()
    close()
  }
}
window.addEventListener('keydown', onKey, true)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))

let toastTimer = 0
watch(
  () => ui.toast,
  (m) => {
    clearTimeout(toastTimer)
    if (m) toastTimer = window.setTimeout(() => (ui.toast = ''), 6000)
  }
)
</script>

<template>
  <div v-if="ui.dialog" class="pt-scrim" @pointerdown.self="close">
    <form
      v-if="ui.dialog === 'new'"
      class="pt-dialog box"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-new"
      @submit.prevent="create"
    >
      <div class="pt-dialog__head">
        <span id="dlg-new">{{ t('dialogs.new.title') }}</span>
        <div class="pt-spacer" />
        <button
          type="button"
          class="pt-iconbtn"
          :aria-label="t('dialogs.new.cancel')"
          @click="close"
        >
          <PtIcon name="close" />
        </button>
      </div>
      <div class="pt-dialog__body col">
        <div class="pt-form">
          <div class="pt-formrow">
            <label for="nw">{{ t('dialogs.new.width') }}</label>
            <span class="pt-numbox">
              <input
                id="nw"
                v-model.number="width"
                class="pt-input"
                type="number"
                min="1"
                :max="MAX_SIZE"
                autofocus
              />
              <span class="pt-unit">{{ t('dialogs.new.px') }}</span>
            </span>
          </div>
          <div class="pt-formrow">
            <label for="nh">{{ t('dialogs.new.height') }}</label>
            <span class="pt-numbox">
              <input
                id="nh"
                v-model.number="height"
                class="pt-input"
                type="number"
                min="1"
                :max="MAX_SIZE"
              />
              <span class="pt-unit">{{ t('dialogs.new.px') }}</span>
            </span>
          </div>
          <div class="pt-formrow">
            <span class="pt-formlbl">{{ t('dialogs.new.preset') }}</span>
            <span class="presets">
              <button
                v-for="p in PRESETS"
                :key="p"
                type="button"
                class="pt-btn pt-btn--secondary"
                @click="setPreset(p)"
              >
                {{ p }}
              </button>
            </span>
          </div>
          <p v-if="!validSize" class="pt-errmsg">{{ t('dialogs.new.limit') }}</p>
        </div>
      </div>
      <div class="pt-dialog__foot">
        <button type="button" class="pt-btn pt-btn--secondary pt-btn--lg" @click="close">
          {{ t('dialogs.new.cancel') }}
        </button>
        <button type="submit" class="pt-btn pt-btn--primary pt-btn--lg" :disabled="!validSize">
          {{ t('dialogs.new.create') }}
        </button>
      </div>
    </form>

    <form
      v-else-if="ui.dialog === 'export'"
      class="pt-dialog box"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-exp"
      @submit.prevent="doExport"
    >
      <div class="pt-dialog__head">
        <span id="dlg-exp">{{ t('dialogs.export.title') }}</span>
      </div>
      <div class="pt-dialog__body col">
        <div class="pt-form">
          <div class="pt-formrow">
            <label for="es">{{ t('dialogs.export.scale') }}</label>
            <select id="es" v-model.number="scale" class="pt-select">
              <option v-for="n in [1, 2, 3, 4, 6, 8, 10, 16]" :key="n" :value="n">×{{ n }}</option>
            </select>
          </div>
          <p class="pt-hint">
            {{ t('dialogs.export.size', { w: exportSize.w, h: exportSize.h }) }}
          </p>
        </div>
      </div>
      <div class="pt-dialog__foot">
        <button type="button" class="pt-btn pt-btn--secondary pt-btn--lg" @click="close">
          {{ t('dialogs.export.cancel') }}
        </button>
        <button type="submit" class="pt-btn pt-btn--primary pt-btn--lg">
          {{ t('dialogs.export.export') }}
        </button>
      </div>
    </form>

    <div v-else class="pt-dialog box" role="dialog" aria-modal="true" aria-labelledby="dlg-rec">
      <div class="pt-dialog__head">
        <span id="dlg-rec">{{ t('dialogs.recovery.title') }}</span>
      </div>
      <div class="pt-dialog__body col">
        <p class="pt-sec2">{{ t('dialogs.recovery.intro') }}</p>
        <ul class="rec">
          <li v-for="r in recovery" :key="r.docId">
            <span class="nm">{{ r.name }}</span>
            <span class="pt-sec2">{{ new Date(r.mtime).toLocaleString('es') }}</span>
            <button type="button" class="pt-btn pt-btn--primary" @click="doRecover(r.docId)">
              {{ t('dialogs.recovery.recover') }}
            </button>
            <button type="button" class="pt-btn pt-btn--secondary" @click="doDiscard(r.docId)">
              {{ t('dialogs.recovery.discard') }}
            </button>
          </li>
        </ul>
      </div>
      <div class="pt-dialog__foot">
        <button type="button" class="pt-btn pt-btn--secondary pt-btn--lg" @click="close">
          {{ t('dialogs.recovery.later') }}
        </button>
      </div>
    </div>
  </div>

  <div v-if="ui.toast" class="pt-toast toast" role="status">
    <span>{{ ui.toast }}</span>
    <button
      type="button"
      class="pt-iconbtn"
      :aria-label="t('dialogs.new.cancel')"
      @click="ui.toast = ''"
    >
      <PtIcon name="close" />
    </button>
  </div>
</template>

<style scoped>
.box {
  width: 420px;
  max-width: calc(100vw - 32px);
}
.col {
  flex-direction: column;
  padding: var(--space-4, 16px);
  gap: var(--space-3);
}
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
.rec {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.rec li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.nm {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toast {
  position: fixed;
  right: var(--space-4, 16px);
  bottom: 40px;
  z-index: 60;
  max-width: 420px;
}
</style>
