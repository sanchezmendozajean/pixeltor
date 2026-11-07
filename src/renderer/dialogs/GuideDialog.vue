<script setup lang="ts">
// Posición de una guía (doble clic sobre ella): admite expresiones como «50%» o «100% - 10».
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { evalGuideExpr, setGuidePos } from '@core/index'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

const ui = useUiStore()
const docs = useDocumentsStore()
const text = ref('')
const input = ref<HTMLInputElement>()

const size = computed(() => {
  const img = docs.session?.image
  if (!img || !ui.guideDialog) return 0
  return ui.guideDialog.axis === 'v' ? img.width : img.height
})
/** Posición resultante (entera) o null si la expresión no es válida. */
const result = computed(() => evalGuideExpr(text.value, size.value))

watch(
  () => ui.guideDialog,
  async (g) => {
    if (!g) return
    const cur = docs.session?.image.guides?.find((x) => x.id === g.id)
    text.value = String(cur?.pos ?? 0)
    await nextTick()
    input.value?.focus()
    input.value?.select()
  }
)

function close(): void {
  ui.guideDialog = null
}

function submit(): void {
  const g = ui.guideDialog
  const s = docs.session
  if (!g || !s || result.value === null) return
  setGuidePos(s, g.id, result.value)
  close()
}

function onKey(e: KeyboardEvent): void {
  if (ui.guideDialog && e.key === 'Escape') {
    e.stopImmediatePropagation()
    close()
  }
}
window.addEventListener('keydown', onKey, true)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))
</script>

<template>
  <div v-if="ui.guideDialog" class="pt-scrim" @pointerdown.self="close">
    <form
      class="pt-dialog box"
      role="dialog"
      aria-modal="true"
      :aria-label="t('guideDialog.title')"
      @submit.prevent="submit"
    >
      <div class="pt-dialog__head">
        {{ t(ui.guideDialog.axis === 'v' ? 'guideDialog.titleV' : 'guideDialog.titleH') }}
      </div>
      <div class="body">
        <label class="pt-formrow">
          <span>{{ t('guideDialog.position') }}</span>
          <input
            ref="input"
            v-model="text"
            class="pt-input"
            data-testid="guide-pos"
            spellcheck="false"
            autocomplete="off"
          />
        </label>
        <p v-if="result !== null" class="pt-hint">
          {{ t('guideDialog.result', { n: result, size }) }}
        </p>
        <p v-else class="pt-errmsg">{{ t('guideDialog.invalid') }}</p>
        <p class="pt-hint">{{ t('guideDialog.hint') }}</p>
      </div>
      <div class="pt-dialog__foot">
        <button type="button" class="pt-btn pt-btn--secondary pt-btn--lg" @click="close">
          {{ t('guideDialog.cancel') }}
        </button>
        <button type="submit" class="pt-btn pt-btn--primary pt-btn--lg" :disabled="result === null">
          {{ t('guideDialog.apply') }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.box {
  width: 340px;
}
.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
}
.pt-formrow {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>
