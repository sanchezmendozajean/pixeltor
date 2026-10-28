<script setup lang="ts">
// Botón ligado a una acción del registro: icono, etiqueta accesible y tooltip salen de ahí.
import { computed } from 'vue'
import PtIcon from './PtIcon.vue'
import { actionIcon, actionLabel, execute, isEnabled } from '@/actions/registry'

const props = withDefaults(
  defineProps<{ id: string; variant?: 'icon' | 'tool'; active?: boolean; on?: boolean }>(),
  { variant: 'icon', active: false, on: false }
)

const label = computed(() => actionLabel(props.id))
const icon = computed(() => actionIcon(props.id))
const enabled = computed(() => isEnabled(props.id))
</script>

<template>
  <button
    type="button"
    :class="[
      variant === 'tool' ? 'pt-toolbtn' : 'pt-iconbtn',
      { 'is-active': active, 'is-on': on, 'is-dim': !enabled }
    ]"
    :data-action="id"
    :aria-label="label"
    :aria-pressed="on || undefined"
    @click="execute(id)"
  >
    <slot>
      <PtIcon v-if="icon" :name="icon" />
    </slot>
  </button>
</template>
