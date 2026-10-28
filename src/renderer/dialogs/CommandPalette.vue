<script setup lang="ts">
// Paleta de comandos (Ctrl+K): busca cualquier acción del registro y la ejecuta. Muestra el atajo.
import { computed, nextTick, ref, watch } from 'vue'
import { ACTIONS } from '@/actions/definitions'
import { actionLabel, actionShortcut, execute, isEnabled } from '@/actions/registry'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

const ui = useUiStore()
const query = ref('')
const cursor = ref(0)
const input = ref<HTMLInputElement>()

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Puntuación: 0 = coincide al principio, 1 = al principio de una palabra, 2 = contiene, 3 = letras en orden. */
function score(label: string, q: string): number | null {
  const l = norm(label)
  if (!q) return 0
  if (l.startsWith(q)) return 0
  if (l.includes(` ${q}`)) return 1
  if (l.includes(q)) return 2
  let i = 0
  for (const ch of l) if (ch === q[i]) i++
  return i === q.length ? 3 : null
}

const results = computed(() => {
  if (!ui.palette) return []
  const q = norm(query.value.trim())
  return ACTIONS.filter((a) => a.id !== 'help.commandPalette' && isEnabled(a.id))
    .map((a) => ({ id: a.id, label: actionLabel(a.id), shortcut: actionShortcut(a.id) }))
    .map((r) => ({ r, s: score(r.label, q) }))
    .filter((x): x is { r: (typeof x)['r']; s: number } => x.s !== null)
    .sort((p, q2) => p.s - q2.s || p.r.label.localeCompare(q2.r.label, 'es'))
    .slice(0, 50)
    .map((x) => x.r)
})

watch(
  () => ui.palette,
  async (open) => {
    if (!open) return
    query.value = ''
    cursor.value = 0
    await nextTick()
    input.value?.focus()
  }
)
watch(query, () => (cursor.value = 0))

function close(): void {
  ui.palette = false
}
function run(id: string): void {
  close()
  // tras cerrar, para que la acción reciba el foco habitual
  void nextTick(() => execute(id))
}
function onKey(e: KeyboardEvent): void {
  const n = results.value.length
  if (e.key === 'ArrowDown') cursor.value = n ? (cursor.value + 1) % n : 0
  else if (e.key === 'ArrowUp') cursor.value = n ? (cursor.value - 1 + n) % n : 0
  else if (e.key === 'Enter') {
    const r = results.value[cursor.value]
    if (r) run(r.id)
  } else if (e.key === 'Escape') close()
  else return
  e.preventDefault()
  e.stopPropagation()
}
</script>

<template>
  <div v-if="ui.palette" class="pt-scrim top" @pointerdown.self="close">
    <div
      class="pt-dialog cmd"
      role="dialog"
      aria-modal="true"
      :aria-label="t('commands.title')"
      @keydown="onKey"
    >
      <input
        ref="input"
        v-model="query"
        class="pt-input q"
        type="text"
        :placeholder="t('commands.placeholder')"
        :aria-label="t('commands.title')"
      />
      <ul class="list" role="listbox">
        <li
          v-for="(r, i) in results"
          :key="r.id"
          role="option"
          :aria-selected="i === cursor"
          :class="{ on: i === cursor }"
          @pointerenter="cursor = i"
          @click="run(r.id)"
        >
          <span>{{ r.label }}</span>
          <span v-if="r.shortcut" class="pt-mono kbd">{{ r.shortcut }}</span>
        </li>
        <li v-if="!results.length" class="none">{{ t('commands.none') }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.top {
  align-items: flex-start;
  padding-top: 80px;
}
.cmd {
  width: 480px;
  max-width: calc(100vw - 32px);
  max-height: 60vh;
}
.q {
  margin: var(--space-3);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0 0 var(--space-2);
  overflow-y: auto;
}
.list li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 4px var(--space-4);
  font-size: var(--fs-sm);
  cursor: default;
}
.list li.on {
  background: var(--accent);
  color: var(--text-on-accent, #fff);
}
.kbd {
  color: inherit;
  opacity: 0.7;
}
.none {
  color: var(--text-secondary);
}
</style>
