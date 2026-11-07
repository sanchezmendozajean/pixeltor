<script setup lang="ts">
// Cuadro de color que abre el selector de la aplicación (el mismo en todos los casos).
import { openColorDialog } from '@/app/colorDialog'

const props = defineProps<{ color: string }>()
/** `pick` llega con cada cambio (en vivo); `end` al aceptar. */
const emit = defineEmits<{ pick: [hex: string]; end: [] }>()

function open(e: MouseEvent): void {
  openColorDialog(e.currentTarget as Element, props.color, {
    onChange: (hex) => emit('pick', hex),
    onEnd: () => emit('end')
  })
}
</script>

<template>
  <button type="button" class="cbtn" :style="{ background: color }" @click="open" />
</template>

<style scoped>
.cbtn {
  width: 28px;
  height: 22px;
  flex: none;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 2px;
  cursor: pointer;
}
</style>
