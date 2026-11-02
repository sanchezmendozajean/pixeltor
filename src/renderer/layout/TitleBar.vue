<script setup lang="ts">
import MenuBar from './MenuBar.vue'
import PtIcon from '@/components/PtIcon.vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { actionLabel, actionShortcut, execute, isEnabled } from '@/actions/registry'
import { switchWorkspace, workspaceEntries, workspaceName } from '@/app/workspaces'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

const ui = useUiStore()
const menu = ref<{ x: number; y: number } | null>(null)
function open(e: MouseEvent): void {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  menu.value = { x: r.left, y: r.bottom + 2 }
}
function dismiss(e: Event): void {
  if (!menu.value) return
  if (e instanceof KeyboardEvent && e.key !== 'Escape') return
  if (e instanceof PointerEvent && (e.target as HTMLElement).closest('.wsmenu')) return
  menu.value = null
}
function pick(id: string): void {
  menu.value = null
  void switchWorkspace(id)
}
function run(id: string): void {
  menu.value = null
  execute(id)
}
const ACTIONS = [
  'window.workspace.new',
  'window.workspace.save',
  'window.workspace.rename',
  'window.workspace.delete',
  'window.workspace.reset'
]
onMounted(() => {
  document.addEventListener('pointerdown', dismiss, true)
  document.addEventListener('keydown', dismiss, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', dismiss, true)
  document.removeEventListener('keydown', dismiss, true)
})
</script>

<template>
  <header class="pt-titlebar pt-drag bar">
    <div class="pt-logo">
      <svg width="16" height="16" viewBox="0 0 16 16" role="img" :aria-label="t('app.name')">
        <path
          class="px"
          d="M3 2h2v12H3z M5 2h6v2H5z M11 3h2v1h-2z M12 4h1v4h-1z M11 4h1v5h-1z M5 7h6v2H5z"
        />
        <path class="vec" d="M2.5 14.5C7 14.5 13.5 12.5 14 2.5" />
      </svg>
    </div>
    <MenuBar class="pt-nodrag" />
    <div class="pt-spacer" />
    <button
      type="button"
      class="pt-select pt-nodrag workspace"
      :data-tip="t('titlebar.workspace')"
      :aria-label="`${t('titlebar.workspace')}: ${workspaceName(ui.workspaceId)}`"
      aria-haspopup="menu"
      :aria-expanded="!!menu"
      @click="open"
    >
      <span>{{ workspaceName(ui.workspaceId) }}</span>
      <PtIcon name="chevDown" />
    </button>
    <Teleport to="body">
      <div
        v-if="menu"
        class="pt-menu wsmenu"
        role="menu"
        :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      >
        <div
          v-for="w in workspaceEntries()"
          :key="w.id"
          class="pt-mi"
          role="menuitemradio"
          :aria-checked="w.id === ui.workspaceId"
          @click="pick(w.id)"
        >
          <span class="chk">{{ w.id === ui.workspaceId ? '✓' : '' }}</span>
          {{ w.name }}
        </div>
        <div class="pt-msep" role="separator" />
        <div
          v-for="id in ACTIONS"
          :key="id"
          class="pt-mi"
          role="menuitem"
          :class="{ 'is-disabled': !isEnabled(id) }"
          @click="run(id)"
        >
          {{ actionLabel(id) }}
        </div>
      </div>
    </Teleport>
    <button type="button" class="pt-select pt-nodrag search" data-action="help.commandPalette">
      <PtIcon name="search" />
      <span class="grow">{{ t('titlebar.search') }}</span>
      <span class="pt-mono kbd">{{ actionShortcut('help.commandPalette') }}</span>
    </button>
  </header>
</template>

<style scoped>
.bar {
  /* Deja libre el área de los controles de ventana nativos (titleBarOverlay). */
  padding-right: calc(100% - env(titlebar-area-width, 100%) - env(titlebar-area-x, 0px));
}
.px {
  fill: var(--accent);
  shape-rendering: crispEdges;
}
.vec {
  fill: none;
  stroke: var(--brand-warm);
  stroke-width: 1.5;
  stroke-linecap: round;
}
.workspace {
  width: 118px;
  margin-right: var(--space-4);
  background: var(--bg-panel);
}
.search {
  width: 200px;
  margin-right: 10px;
  justify-content: flex-start;
  gap: var(--space-3);
  color: var(--text-secondary);
}
.wsmenu {
  position: fixed;
  z-index: 80;
  min-width: 220px;
}
.chk {
  position: absolute;
  left: 10px;
  width: 14px;
}
.grow {
  flex: 1;
  text-align: left;
}
.kbd {
  font-size: var(--fs-xs);
  padding-right: var(--space-2);
}
</style>
