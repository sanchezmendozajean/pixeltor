<script setup lang="ts">
// Panel Historial: clic en un paso vuelve a ese estado; los pasos deshechos se ven atenuados.
import { useDocumentsStore } from '@/stores/documents'
import { t } from '@/i18n'

const docs = useDocumentsStore()

function go(position: number): void {
  docs.session?.history.goTo(position)
}
</script>

<template>
  <ul v-if="docs.session" class="hist pt-scroll" :aria-label="t('panels.history')">
    <li>
      <button
        type="button"
        class="pt-listitem"
        :class="{ 'is-selected': docs.session.history.position === 0 }"
        @click="go(0)"
      >
        {{ t('history.initial') }}
      </button>
    </li>
    <li v-for="h in docs.history" :key="h.position">
      <button
        type="button"
        class="pt-listitem"
        :class="{
          'is-selected': docs.session.history.position === h.position,
          undone: h.undone
        }"
        @click="go(h.position)"
      >
        {{ h.label }}
      </button>
    </li>
  </ul>
  <p v-else class="pt-sec2 empty">{{ t('history.empty') }}</p>
</template>

<style scoped>
.hist {
  list-style: none;
  margin: 0;
  padding: 0;
  height: 100%;
  overflow-y: auto;
}
.hist button {
  width: 100%;
  border: 0;
  background: none;
  color: inherit;
  text-align: left;
  font: inherit;
  padding: 0 var(--panel-pad-x);
}
.hist button:hover {
  background: var(--bg-hover);
}
.hist .is-selected {
  background: var(--accent-muted);
}
.hist .undone {
  opacity: 0.45;
}
.empty {
  text-align: center;
  padding: var(--panel-pad-y);
}
</style>
