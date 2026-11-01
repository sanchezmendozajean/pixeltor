<script setup lang="ts">
// Atajos de teclado personalizables: lista del registro de acciones con búsqueda, grabación de
// un atajo nuevo, aviso de conflicto con reasignación y restablecimiento (por acción o todos).
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ACTIONS } from '@/actions/definitions'
import {
  actionLabel,
  effectiveShortcut,
  hasCustomShortcut,
  resetShortcuts,
  setShortcut,
  shortcutOverrides,
  shortcutOwner
} from '@/actions/registry'
import { eventToShortcut, formatShortcut } from '@/actions/shortcuts'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

const ui = useUiStore()
const query = ref('')
const search = ref<HTMLInputElement>()
/** Acción cuyo atajo se está grabando. */
const recording = ref<string | null>(null)
/** Atajo grabado que ya usa otra acción, a la espera de confirmar. */
const conflict = ref<{ id: string; shortcut: string; owner: string } | null>(null)

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const rows = computed(() => {
  const q = norm(query.value.trim())
  return ACTIONS.filter((a) => !q || norm(actionLabel(a.id)).includes(q)).map((a) => ({
    id: a.id,
    label: actionLabel(a.id),
    shortcut: effectiveShortcut(a.id),
    custom: hasCustomShortcut(a.id)
  }))
})

function persist(): void {
  void window.pixeltor.settings.set({ shortcuts: shortcutOverrides() })
}

function apply(id: string, shortcut: string | null): void {
  setShortcut(id, shortcut)
  persist()
}

function onKey(e: KeyboardEvent): void {
  if (!ui.shortcutsDialog) return
  if (recording.value) {
    // mientras se graba, ninguna tecla debe llegar al resto de la aplicación
    e.preventDefault()
    e.stopImmediatePropagation()
    if (e.key === 'Escape') {
      recording.value = null
      return
    }
    const sc = eventToShortcut(e)
    if (!sc) return
    const id = recording.value
    const owner = shortcutOwner(sc)
    if (owner && owner !== id) conflict.value = { id, shortcut: sc, owner }
    else apply(id, sc)
    recording.value = null
    return
  }
  if (e.key === 'Escape') {
    e.stopImmediatePropagation()
    if (conflict.value) conflict.value = null
    else close()
  }
}
window.addEventListener('keydown', onKey, true)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))

function record(id: string): void {
  conflict.value = null
  recording.value = id
}

function reassign(): void {
  const c = conflict.value
  if (!c) return
  setShortcut(c.owner, '')
  apply(c.id, c.shortcut)
  conflict.value = null
}

function close(): void {
  recording.value = null
  conflict.value = null
  ui.shortcutsDialog = false
}

function resetAll(): void {
  resetShortcuts()
  persist()
}

watch(
  () => ui.shortcutsDialog,
  async (open) => {
    if (!open) return
    query.value = ''
    await nextTick()
    search.value?.focus()
  }
)
</script>

<template>
  <div v-if="ui.shortcutsDialog" class="pt-scrim" @pointerdown.self="close">
    <div class="pt-dialog sc" role="dialog" aria-modal="true" :aria-label="t('shortcuts.title')">
      <div class="pt-dialog__head">{{ t('shortcuts.title') }}</div>
      <div class="bar">
        <input
          ref="search"
          v-model="query"
          class="pt-input"
          type="search"
          :placeholder="t('shortcuts.search')"
          :aria-label="t('shortcuts.search')"
        />
      </div>
      <p v-if="conflict" class="warn" role="alert">
        {{
          t('shortcuts.conflict', {
            key: formatShortcut(conflict.shortcut),
            action: actionLabel(conflict.owner)
          })
        }}
        <button type="button" class="pt-btn pt-btn--primary" @click="reassign">
          {{ t('shortcuts.reassign') }}
        </button>
        <button type="button" class="pt-btn pt-btn--secondary" @click="conflict = null">
          {{ t('shortcuts.cancel') }}
        </button>
      </p>
      <ul class="list">
        <li v-for="r in rows" :key="r.id" class="row" :data-action="r.id">
          <span class="lbl">{{ r.label }}</span>
          <button
            type="button"
            class="key pt-mono"
            :class="{ rec: recording === r.id, custom: r.custom }"
            :aria-label="`${r.label}: ${r.shortcut ? formatShortcut(r.shortcut) : t('shortcuts.none')}`"
            @click="record(r.id)"
          >
            <template v-if="recording === r.id">{{ t('shortcuts.press') }}</template>
            <template v-else-if="r.shortcut">{{ formatShortcut(r.shortcut) }}</template>
            <template v-else>{{ t('shortcuts.none') }}</template>
          </button>
          <button
            v-if="r.shortcut"
            type="button"
            class="pt-iconbtn"
            :data-tip="t('shortcuts.clear')"
            :aria-label="`${t('shortcuts.clear')}: ${r.label}`"
            @click="apply(r.id, '')"
          >
            ×
          </button>
          <span v-else class="pt-iconbtn ph" />
          <button
            type="button"
            class="pt-iconbtn"
            :class="{ ph: !r.custom }"
            :disabled="!r.custom"
            :data-tip="t('shortcuts.restore')"
            :aria-label="`${t('shortcuts.restore')}: ${r.label}`"
            @click="apply(r.id, null)"
          >
            ↺
          </button>
        </li>
      </ul>
      <div class="pt-dialog__foot">
        <button type="button" class="pt-btn pt-btn--secondary pt-btn--lg" @click="resetAll">
          {{ t('shortcuts.resetAll') }}
        </button>
        <button type="button" class="pt-btn pt-btn--primary pt-btn--lg" @click="close">
          {{ t('shortcuts.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sc {
  width: 520px;
  max-height: min(640px, 86vh);
}
.bar {
  padding: var(--space-2) var(--space-3);
}
.bar .pt-input {
  width: 100%;
}
.warn {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  background: var(--bg-hover);
  color: var(--text-primary);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0 var(--space-3);
  overflow: auto;
  flex: 1;
  min-height: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 26px;
}
.lbl {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.key {
  min-width: 120px;
  height: 20px;
  padding: 0 var(--space-2);
  text-align: left;
  border: 1px solid var(--border-input);
  background: var(--bg-input);
  color: var(--text-primary);
  border-radius: var(--radius-sm, 3px);
}
.key.custom {
  border-color: var(--accent);
}
.key.rec {
  background: var(--accent-solid);
  color: var(--on-accent);
}
.ph {
  visibility: hidden;
}
</style>
