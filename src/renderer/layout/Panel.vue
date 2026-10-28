<script setup lang="ts">
// Grupo de paneles con pestañas, menú ≡ y colapso. Cada pestaña puede aportar su contenido
// por un slot con su id; sin él se muestra el estado vacío.
import { ref } from 'vue'
import PtIcon from '@/components/PtIcon.vue'
import { t, type I18nKey } from '@/i18n'

export interface PanelTab {
  id: string
  label: I18nKey
  empty: I18nKey
}

const props = defineProps<{
  tabs: PanelTab[]
  collapsible?: boolean
  /** Alto fijo del cuerpo en px; sin él, el panel ocupa el espacio sobrante. */
  bodyHeight?: number
}>()

const active = ref(props.tabs[0]?.id ?? '')
const collapsed = ref(false)
</script>

<template>
  <section
    class="pt-panel"
    :class="{ collapsed, fixed: bodyHeight !== undefined }"
    :aria-label="t(tabs[0]!.label)"
  >
    <div class="pt-phead">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="pt-ptab"
        :class="{ 'is-active': tab.id === active }"
        @click="active = tab.id"
      >
        {{ t(tab.label) }}
      </button>
      <div class="pt-phead__tools">
        <button
          type="button"
          class="pt-iconbtn pt-iconbtn--20"
          :data-tip="t('dock.options')"
          :aria-label="t('dock.options')"
        >
          <PtIcon name="menu" />
        </button>
        <button
          v-if="collapsible !== false"
          type="button"
          class="pt-iconbtn pt-iconbtn--20"
          :data-tip="collapsed ? t('dock.expand') : t('dock.collapse')"
          :aria-label="collapsed ? t('dock.expand') : t('dock.collapse')"
          :aria-expanded="!collapsed"
          @click="collapsed = !collapsed"
        >
          <PtIcon :name="collapsed ? 'chevRight' : 'chevDown'" />
        </button>
      </div>
    </div>
    <template v-if="!collapsed">
      <div
        class="body pt-scroll"
        :style="bodyHeight ? { height: `${bodyHeight}px`, flex: 'none' } : undefined"
      >
        <template v-for="tab in tabs" :key="tab.id">
          <div v-if="$slots[tab.id]" v-show="tab.id === active" class="content">
            <slot :name="tab.id" />
          </div>
          <p v-else v-show="tab.id === active" class="empty pt-sec2">
            {{ t(tab.empty) }}
          </p>
        </template>
      </div>
      <slot name="foot" />
    </template>
  </section>
</template>

<style scoped>
.pt-panel {
  flex: 1 1 0;
  min-height: 0;
}
.pt-panel.collapsed,
.pt-panel.fixed {
  flex: none;
}
.body {
  flex: 1;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.content {
  align-self: stretch;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.empty {
  margin: 0;
  padding: var(--panel-pad-y) var(--panel-pad-x);
  text-align: center;
}
</style>
