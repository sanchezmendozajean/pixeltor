<script setup lang="ts">
import MenuBar from './MenuBar.vue'
import PtIcon from '@/components/PtIcon.vue'
import { actionShortcut } from '@/actions/registry'
import { t } from '@/i18n'
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
      :aria-label="t('titlebar.workspace')"
    >
      <span>{{ t('workspaces.essentials') }}</span>
      <PtIcon name="chevDown" />
    </button>
    <button
      type="button"
      class="pt-select pt-nodrag search"
      data-action="help.commandPalette"
      :aria-label="t('titlebar.search')"
    >
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
.grow {
  flex: 1;
  text-align: left;
}
.kbd {
  font-size: var(--fs-xs);
  padding-right: var(--space-2);
}
</style>
