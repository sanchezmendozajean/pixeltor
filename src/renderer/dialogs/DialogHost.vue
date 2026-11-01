<script setup lang="ts">
// Diálogos modales de F1: Nuevo documento, Exportar PNG y Recuperar documentos; más el aviso breve.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { RecoveryEntry } from '@shared/ipc'
import { MAX_SIZE } from '@core/index'
import PtIcon from '@/components/PtIcon.vue'
import { discardRecovery, listRecovery, newDocument, recover } from '@/app/documentOps'
import { exportAs } from '@/app/exportOps'
import { confirmSheetImport, sheetCellCount } from '@/app/importOps'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { t, type I18nKey } from '@/i18n'

const ui = useUiStore()
const docs = useDocumentsStore()

const PRESETS = [16, 32, 64, 128, 256, 512]
const width = ref(32)
const height = ref(32)
const opts = ui.exportOptions
const scale = computed({
  get: () => opts.scale,
  set: (v: number) => (opts.scale = v)
})
/** Al elegir un formato se propone el alcance natural: animados e iconos → toda la animación. */
function onFormat(): void {
  opts.scope = opts.format === 'png' ? 'current' : 'animation'
}
const exportCount = computed(() => {
  void docs.rev
  const s = docs.session
  if (!s) return 0
  if (opts.scope === 'current') return 1
  return opts.scope === 'all'
    ? s.doc.images.length
    : s.doc.images.filter((i) => i.includeInAnimation).length
})
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
  await exportAs(ws, { ...opts })
}
const sheetCount = computed(() => (ui.sheetImport ? sheetCellCount(ui.sheetImport) : 0))
function doSheet(): void {
  if (!ui.sheetImport || !sheetCount.value) return
  confirmSheetImport({ ...ui.sheetImport })
  close()
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
          <div class="pt-formrow">
            <label for="ef">{{ t('dialogs.export.format') }}</label>
            <select id="ef" v-model="opts.format" class="pt-select" @change="onFormat">
              <option
                v-for="f in ['png', 'sequence', 'sheet', 'gif', 'apng', 'ico']"
                :key="f"
                :value="f"
              >
                {{ t(`dialogs.export.formats.${f}` as I18nKey) }}
              </option>
            </select>
          </div>
          <div v-if="opts.format !== 'png'" class="pt-formrow">
            <label for="eo">{{ t('dialogs.export.scope') }}</label>
            <select id="eo" v-model="opts.scope" class="pt-select">
              <option value="current">{{ t('dialogs.export.scopes.current') }}</option>
              <option value="animation">{{ t('dialogs.export.scopes.animation') }}</option>
              <option value="all">{{ t('dialogs.export.scopes.all') }}</option>
            </select>
          </div>
          <template v-if="opts.format === 'sheet'">
            <div class="pt-formrow">
              <label for="el">{{ t('dialogs.export.layout') }}</label>
              <select id="el" v-model="opts.layout" class="pt-select">
                <option value="horizontal">{{ t('dialogs.export.layouts.horizontal') }}</option>
                <option value="vertical">{{ t('dialogs.export.layouts.vertical') }}</option>
                <option value="grid">{{ t('dialogs.export.layouts.grid') }}</option>
              </select>
            </div>
            <div v-if="opts.layout === 'grid'" class="pt-formrow">
              <label for="ec">{{ t('dialogs.export.columns') }}</label>
              <input
                id="ec"
                v-model.number="opts.columns"
                class="pt-input"
                type="number"
                min="1"
                max="64"
              />
            </div>
            <div class="pt-formrow">
              <label for="ep">{{ t('dialogs.export.padding') }}</label>
              <input
                id="ep"
                v-model.number="opts.padding"
                class="pt-input"
                type="number"
                min="0"
                max="32"
              />
            </div>
          </template>
          <p v-if="opts.format !== 'png'" class="pt-hint">
            {{ t('dialogs.export.count', { n: exportCount }) }}
          </p>
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

    <form
      v-else-if="ui.dialog === 'sheet' && ui.sheetImport"
      class="pt-dialog box"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-sheet"
      @submit.prevent="doSheet"
    >
      <div class="pt-dialog__head">
        <span id="dlg-sheet">{{ t('dialogs.sheet.title') }}</span>
      </div>
      <div class="pt-dialog__body col">
        <div class="pt-form">
          <div class="pt-formrow">
            <label for="sw">{{ t('dialogs.sheet.cellW') }}</label>
            <input
              id="sw"
              v-model.number="ui.sheetImport.cellW"
              class="pt-input"
              type="number"
              min="1"
            />
          </div>
          <div class="pt-formrow">
            <label for="sh">{{ t('dialogs.sheet.cellH') }}</label>
            <input
              id="sh"
              v-model.number="ui.sheetImport.cellH"
              class="pt-input"
              type="number"
              min="1"
            />
          </div>
          <div class="pt-formrow">
            <label for="sm">{{ t('dialogs.sheet.margin') }}</label>
            <input
              id="sm"
              v-model.number="ui.sheetImport.margin"
              class="pt-input"
              type="number"
              min="0"
            />
          </div>
          <div class="pt-formrow">
            <label for="ss">{{ t('dialogs.sheet.spacing') }}</label>
            <input
              id="ss"
              v-model.number="ui.sheetImport.spacing"
              class="pt-input"
              type="number"
              min="0"
            />
          </div>
          <div class="pt-formrow">
            <label for="so">{{ t('dialogs.sheet.order') }}</label>
            <select id="so" v-model="ui.sheetImport.order" class="pt-select">
              <option value="rows">{{ t('dialogs.sheet.byRows') }}</option>
              <option value="columns">{{ t('dialogs.sheet.byColumns') }}</option>
            </select>
          </div>
          <label class="pt-check-label">
            <input v-model="ui.sheetImport.skipEmpty" type="checkbox" />
            {{ t('dialogs.sheet.skipEmpty') }}
          </label>
          <p class="pt-hint">
            {{
              t('dialogs.sheet.count', {
                n: sheetCount,
                w: ui.sheetImport.width,
                h: ui.sheetImport.height
              })
            }}
          </p>
        </div>
      </div>
      <div class="pt-dialog__foot">
        <button type="button" class="pt-btn pt-btn--secondary pt-btn--lg" @click="close">
          {{ t('dialogs.export.cancel') }}
        </button>
        <button type="submit" class="pt-btn pt-btn--primary pt-btn--lg" :disabled="!sheetCount">
          {{ t('dialogs.sheet.import') }}
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
