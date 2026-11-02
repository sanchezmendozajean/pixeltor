<script setup lang="ts">
// Nombre de un espacio de trabajo: crear uno con el estado actual o renombrar el activo.
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { createWorkspace, renameWorkspace, workspaceName } from '@/app/workspaces'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

const ui = useUiStore()
const name = ref('')
const input = ref<HTMLInputElement>()

watch(
  () => ui.workspaceDialog,
  async (mode) => {
    if (!mode) return
    name.value = mode === 'rename' ? workspaceName(ui.workspaceId) : ''
    await nextTick()
    input.value?.focus()
    input.value?.select()
  }
)

function close(): void {
  ui.workspaceDialog = null
}

async function submit(): Promise<void> {
  const clean = name.value.trim()
  if (!clean) return
  try {
    if (ui.workspaceDialog === 'new') await createWorkspace(clean)
    else await renameWorkspace(ui.workspaceId, clean)
  } finally {
    close()
  }
}

function onKey(e: KeyboardEvent): void {
  if (ui.workspaceDialog && e.key === 'Escape') {
    e.stopImmediatePropagation()
    close()
  }
}
window.addEventListener('keydown', onKey, true)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))
</script>

<template>
  <div v-if="ui.workspaceDialog" class="pt-scrim" @pointerdown.self="close">
    <form
      class="pt-dialog box"
      role="dialog"
      aria-modal="true"
      :aria-label="
        t(ui.workspaceDialog === 'new' ? 'workspaces.dialogNew' : 'workspaces.dialogRename')
      "
      @submit.prevent="submit"
    >
      <div class="pt-dialog__head">
        {{ t(ui.workspaceDialog === 'new' ? 'workspaces.dialogNew' : 'workspaces.dialogRename') }}
      </div>
      <div class="body">
        <label class="pt-formrow">
          <span>{{ t('workspaces.name') }}</span>
          <input ref="input" v-model="name" class="pt-input" maxlength="40" />
        </label>
      </div>
      <div class="pt-dialog__foot">
        <button type="button" class="pt-btn pt-btn--secondary pt-btn--lg" @click="close">
          {{ t('workspaces.cancel') }}
        </button>
        <button type="submit" class="pt-btn pt-btn--primary pt-btn--lg" :disabled="!name.trim()">
          {{ t('workspaces.save') }}
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
  padding: var(--space-3);
}
.pt-formrow {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>
