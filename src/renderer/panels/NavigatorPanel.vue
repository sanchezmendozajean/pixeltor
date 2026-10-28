<script setup lang="ts">
// Navegador: miniatura de la composición con el rectángulo visible; clic o arrastre centran el visor.
import { onMounted, ref, watch } from 'vue'
import { useDocumentsStore } from '@/stores/documents'
import { t } from '@/i18n'

const docs = useDocumentsStore()
const canvas = ref<HTMLCanvasElement>()
const W = 232
const H = 128
let scale = 1
let ox = 0
let oy = 0

function draw(): void {
  const el = canvas.value
  const ws = docs.active
  if (!el) return
  const ctx = el.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  if (!ws) return
  const { composite: c, viewport: vp } = ws
  scale = Math.min(W / c.width, H / c.height)
  const w = Math.max(1, Math.floor(c.width * scale))
  const h = Math.max(1, Math.floor(c.height * scale))
  ox = Math.floor((W - w) / 2)
  oy = Math.floor((H - h) / 2)
  const off = document.createElement('canvas')
  off.width = c.width
  off.height = c.height
  off
    .getContext('2d')!
    .putImageData(new ImageData(new Uint8ClampedArray(c.data), c.width, c.height), 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(off, ox, oy, w, h)
  // Zona visible del visor, en coordenadas de imagen.
  const a = vp.toImage(0, 0)
  const b = vp.toImage(vp.width, vp.height)
  ctx.strokeStyle =
    getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3d8bff'
  ctx.lineWidth = 1
  const x0 = Math.max(0, a.x)
  const y0 = Math.max(0, a.y)
  ctx.strokeRect(
    ox + x0 * scale + 0.5,
    oy + y0 * scale + 0.5,
    Math.max(1, (Math.min(c.width, b.x) - x0) * scale - 1),
    Math.max(1, (Math.min(c.height, b.y) - y0) * scale - 1)
  )
}

function centreOn(e: PointerEvent): void {
  const ws = docs.active
  if (!ws) return
  const r = canvas.value!.getBoundingClientRect()
  const ix = ((e.clientX - r.left) * (W / r.width) - ox) / scale
  const iy = ((e.clientY - r.top) * (H / r.height) - oy) / scale
  const vp = ws.viewport
  vp.panX = vp.width / 2 - ix * vp.zoom
  vp.panY = vp.height / 2 - iy * vp.zoom
  vp.panBy(0, 0)
  ws.refreshView()
  draw()
}

function down(e: PointerEvent): void {
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  centreOn(e)
  el.onpointermove = centreOn
  el.onpointerup = () => {
    el.onpointermove = null
    el.onpointerup = null
  }
}

onMounted(draw)
watch(() => [docs.rev, docs.zoomPercent, docs.activeId], draw)
</script>

<template>
  <div class="nav">
    <canvas
      ref="canvas"
      :width="W"
      :height="H"
      :aria-label="t('navigator.label')"
      @pointerdown="down"
    />
  </div>
</template>

<style scoped>
.nav {
  display: flex;
  justify-content: center;
  padding: var(--space-2);
}
canvas {
  width: 100%;
  max-width: 232px;
  image-rendering: pixelated;
  background: repeating-conic-gradient(var(--checker-a) 0 25%, var(--checker-b) 0 50%) 0 0/8px 8px;
  cursor: pointer;
}
</style>
