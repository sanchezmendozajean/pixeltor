<script setup lang="ts">
// Miniatura 32×32 del ráster de una capa (vecino más cercano, sin suavizado).
import { onMounted, ref, watch } from 'vue'
import type { Bitmap } from '@core/index'
import { useDocumentsStore } from '@/stores/documents'

const props = defineProps<{ layerId: string }>()
const docs = useDocumentsStore()
const canvas = ref<HTMLCanvasElement>()
const SIZE = 32

function draw(): void {
  const s = docs.session
  const el = canvas.value
  if (!s || !el) return
  let bmp: Bitmap
  try {
    bmp = s.bitmapOf(props.layerId)
  } catch {
    return
  }
  const scale = Math.min(SIZE / bmp.width, SIZE / bmp.height)
  const w = Math.max(1, Math.floor(bmp.width * scale))
  const h = Math.max(1, Math.floor(bmp.height * scale))
  el.width = w
  el.height = h
  const img = new ImageData(w, h)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(bmp.height - 1, Math.floor(y / scale))
    for (let x = 0; x < w; x++) {
      const sx = Math.min(bmp.width - 1, Math.floor(x / scale))
      const si = (sy * bmp.width + sx) * 4
      img.data.set(bmp.data.subarray(si, si + 4), (y * w + x) * 4)
    }
  }
  el.getContext('2d')!.putImageData(img, 0, 0)
}

onMounted(draw)
watch(() => [docs.rev, props.layerId], draw)
</script>

<template>
  <span class="pt-thumb"><canvas ref="canvas" class="art" /></span>
</template>

<style scoped>
.pt-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
}
.art {
  image-rendering: pixelated;
  max-width: 100%;
  max-height: 100%;
}
</style>
