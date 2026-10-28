<script setup lang="ts">
import { computed } from 'vue'
import icons from '@/assets/icons.json'

interface IconData {
  name: string
  size: number
  d: string
  f: string
}

const byName = new Map<string, IconData>((icons as IconData[]).map((i) => [i.name, i]))

const props = defineProps<{ name: string }>()
const icon = computed(() => byName.get(props.name))
</script>

<template>
  <svg
    v-if="icon"
    :class="icon.size === 20 ? 'i20' : 'i16'"
    :viewBox="`0 0 ${icon.size} ${icon.size}`"
    aria-hidden="true"
  >
    <path v-if="icon.d" :d="icon.d" />
    <path v-if="icon.f" class="f" :d="icon.f" />
  </svg>
</template>
