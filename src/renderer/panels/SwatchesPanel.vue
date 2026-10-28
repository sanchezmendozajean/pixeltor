<script setup lang="ts">
// Muestras básicas: paleta por defecto + las que añade el usuario (se recuerdan en este equipo).
import { computed, ref } from 'vue'
import PtIcon from '@/components/PtIcon.vue'
import { useColorsStore } from '@/stores/colors'
import { t } from '@/i18n'

const KEY = 'pixeltor.swatches'
const DEFAULTS = [
  '#000000',
  '#1D2B53',
  '#7E2553',
  '#008751',
  '#AB5236',
  '#5F574F',
  '#C2C3C7',
  '#FFF1E8',
  '#FF004D',
  '#FFA300',
  '#FFEC27',
  '#00E436',
  '#29ADFF',
  '#83769C',
  '#FF77A8',
  '#FFCCAA'
]

function load(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(raw)
      ? raw.filter((c): c is string => /^#[0-9A-F]{6}$/i.test(String(c)))
      : []
  } catch {
    return []
  }
}
function persist(list: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // sin almacenamiento: las muestras duran la sesión
  }
}

const colors = useColorsStore()
const custom = ref<string[]>(load())
const all = computed(() => [...DEFAULTS, ...custom.value])
const current = computed(() => (colors.target === 'fill' ? colors.fill : colors.stroke))

function apply(hex: string): void {
  if (colors.target === 'fill') colors.fill = hex
  else colors.stroke = hex
}
function add(): void {
  const hex = current.value.toUpperCase()
  if (all.value.some((c) => c.toUpperCase() === hex)) return
  custom.value.push(hex)
  persist(custom.value)
}
function remove(hex: string): void {
  custom.value = custom.value.filter((c) => c !== hex)
  persist(custom.value)
}
</script>

<template>
  <div class="sw">
    <div class="pt-swgrid">
      <button
        v-for="c in all"
        :key="c"
        type="button"
        class="pt-swcell"
        :class="{ 'is-on': c.toUpperCase() === current.toUpperCase() }"
        :style="{ background: c }"
        :aria-label="t('swatches.apply', { hex: c })"
        @click="apply(c)"
        @contextmenu.prevent="remove(c)"
      />
    </div>
    <button
      type="button"
      class="pt-iconbtn"
      :data-tip="t('swatches.add')"
      :aria-label="t('swatches.add')"
      @click="add"
    >
      <PtIcon name="plus" />
    </button>
  </div>
</template>

<style scoped>
.sw {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  padding: var(--space-2) var(--panel-pad-x);
}
.sw .pt-swgrid {
  flex: 1;
}
</style>
