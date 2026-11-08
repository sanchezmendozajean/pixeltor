<script setup lang="ts">
import MenuBar from './MenuBar.vue'
import PtIcon from '@/components/PtIcon.vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { actionLabel, actionShortcut, execute, isEnabled } from '@/actions/registry'
import { switchWorkspace, workspaceEntries, workspaceName } from '@/app/workspaces'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'
import icon16 from '@/assets/icon-16.png'
import icon32 from '@/assets/icon-32.png'

const ui = useUiStore()

// El icono es pixel art: se muestra siempre 1:1 en píxeles de dispositivo (16 o 32 px), ajustando
// su tamaño CSS a la escala de pantalla, para que nunca se reescale con escalas como 125 % o 150 %.
const dpr = ref(window.devicePixelRatio || 1)
const useBig = computed(() => dpr.value >= 1.5)
const logoSrc = computed(() => (useBig.value ? icon32 : icon16))
const logoSize = computed(() => (useBig.value ? 32 : 16) / dpr.value)
let mq: MediaQueryList | null = null
function watchDpr(): void {
  mq?.removeEventListener('change', watchDpr)
  dpr.value = window.devicePixelRatio || 1
  mq = window.matchMedia(`(resolution: ${dpr.value}dppx)`)
  mq.addEventListener('change', watchDpr)
}
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
  watchDpr()
  document.addEventListener('pointerdown', dismiss, true)
  document.addEventListener('keydown', dismiss, true)
})
onBeforeUnmount(() => {
  mq?.removeEventListener('change', watchDpr)
  document.removeEventListener('pointerdown', dismiss, true)
  document.removeEventListener('keydown', dismiss, true)
})
</script>

<template>
  <header class="pt-titlebar pt-drag bar">
    <div class="pt-logo">
      <img
        class="logo"
        :src="logoSrc"
        :width="logoSize"
        :height="logoSize"
        :alt="t('app.name')"
      />
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
.logo {
  display: block;
  image-rendering: pixelated;
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
.workspace,
.search {
  line-height: 1;
}
.workspace span,
.search span {
  line-height: 20px;
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
