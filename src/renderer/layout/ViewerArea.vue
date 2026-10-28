<script setup lang="ts">
// Visor 1: WebGL2 para la imagen + Canvas2D para el overlay (selección, cursor de pincel).
// Toda la lógica de herramientas vive en tools/controller.ts.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PtIcon from '@/components/PtIcon.vue'
import ActionButton from '@/components/ActionButton.vue'
import { useDocumentsStore } from '@/stores/documents'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import { CanvasController, type Notice, setActiveController } from '@/tools/controller'
import { GlView } from '@/viewport/GlView'
import { drawOverlay } from '@/viewport/overlay'
import type { Workspace } from '@/session/workspace'
import { t } from '@/i18n'

const docs = useDocumentsStore()
const ui = useUiStore()
const tools = useToolsStore()

const stage = ref<HTMLDivElement>()
const glCanvas = ref<HTMLCanvasElement>()
const ovCanvas = ref<HTMLCanvasElement>()
const notice = ref<Notice>(null)
// El grupo aislado no es reactivo: se relee cada vez que cambia la revisión del documento.
const isolated = computed(() => (docs.rev, docs.session?.isolatedGroup ?? null))

let gl: GlView | null = null
let ws: Workspace | null = null
let unsubs: (() => void)[] = []
let raf = 0
let pendingUpload: {
  full: boolean
  rect: { x: number; y: number; w: number; h: number } | null
} | null = null
let dash = 0
let ants = 0
const fitted = new WeakSet<Workspace>()

const controller = new CanvasController(
  () => ws,
  (n) => (notice.value = n)
)
setActiveController(controller)

function schedule(): void {
  if (!raf) raf = requestAnimationFrame(frame)
}

function frame(): void {
  raf = 0
  if (!gl || !ws || !stage.value) return
  const vp = ws.viewport
  const box = stage.value.getBoundingClientRect()
  vp.resize(box.width, box.height)
  if (!fitted.has(ws)) {
    fitted.add(ws)
    vp.fit()
  }
  if (pendingUpload) {
    gl.upload(ws.composite, pendingUpload.full ? undefined : (pendingUpload.rect ?? undefined))
    pendingUpload = null
  }
  gl.draw(vp, ui.pixelGrid)

  const ov = ovCanvas.value!
  const dpr = window.devicePixelRatio || 1
  const w = Math.round(vp.width * dpr)
  const h = Math.round(vp.height * dpr)
  if (ov.width !== w || ov.height !== h) {
    ov.width = w
    ov.height = h
  }
  drawOverlay(ov.getContext('2d')!, vp, controller.overlayState(dash), dpr)
  if (docs.zoomPercent !== vp.zoomPercent) docs.zoomPercent = vp.zoomPercent
}

function bind(next: Workspace | null): void {
  for (const u of unsubs) u()
  unsubs = []
  ws = next
  if (!ws) return
  pendingUpload = { full: true, rect: null }
  unsubs.push(
    ws.onRedraw((r) => {
      if (!pendingUpload || pendingUpload.full || !r) pendingUpload = { full: !r, rect: r }
      else {
        const p = pendingUpload.rect!
        const x0 = Math.min(p.x, r.x)
        const y0 = Math.min(p.y, r.y)
        pendingUpload.rect = {
          x: x0,
          y: y0,
          w: Math.max(p.x + p.w, r.x + r.w) - x0,
          h: Math.max(p.y + p.h, r.y + r.h) - y0
        }
      }
      schedule()
    }),
    ws.onView(schedule)
  )
  schedule()
}

function info(e: PointerEvent) {
  const box = stage.value!.getBoundingClientRect()
  return {
    sx: e.clientX - box.left,
    sy: e.clientY - box.top,
    button: e.button,
    shift: e.shiftKey,
    alt: e.altKey,
    ctrl: e.ctrlKey || e.metaKey
  }
}

function onDown(e: PointerEvent): void {
  if (e.button === 1) e.preventDefault()
  stage.value!.setPointerCapture(e.pointerId)
  controller.down(info(e))
  schedule()
}
function onMove(e: PointerEvent): void {
  controller.moveTo(info(e))
  schedule()
}
function onUp(e: PointerEvent): void {
  controller.up()
  if (stage.value?.hasPointerCapture(e.pointerId)) stage.value.releasePointerCapture(e.pointerId)
  schedule()
}
function onDouble(e: MouseEvent): void {
  const box = stage.value!.getBoundingClientRect()
  controller.doubleClick({
    sx: e.clientX - box.left,
    sy: e.clientY - box.top,
    button: 0,
    shift: e.shiftKey,
    alt: e.altKey,
    ctrl: e.ctrlKey
  })
  schedule()
}
function onLeave(): void {
  controller.hover = null
  docs.cursor = null
  schedule()
}
function onWheel(e: WheelEvent): void {
  if (!ws) return
  e.preventDefault()
  const box = stage.value!.getBoundingClientRect()
  ws.viewport.stepZoom(e.deltaY < 0 ? 1 : -1, e.clientX - box.left, e.clientY - box.top)
  ws.refreshView()
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
    controller.spaceDown = true
    e.preventDefault()
  }
}
function onKeyUp(e: KeyboardEvent): void {
  if (e.code === 'Space') controller.spaceDown = false
}

let ro: ResizeObserver | null = null
onMounted(() => {
  gl = new GlView(glCanvas.value!)
  gl.refreshColors()
  ro = new ResizeObserver(schedule)
  ro.observe(stage.value!)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  ants = window.setInterval(() => {
    if (ws?.session.selection.mask) {
      dash = (dash + 1) % 8
      schedule()
    }
  }, 120)
  bind(docs.active)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  clearInterval(ants)
  setActiveController(null)
  cancelAnimationFrame(raf)
  bind(null)
})

watch(
  () => docs.activeId,
  () => {
    controller.cancelInteraction()
    bind(docs.active)
  }
)
// El overlay (selección) y el cursor dependen del modelo; la rejilla y el tema, de la UI.
watch(() => [docs.rev, tools.active, tools.brushSize, tools.brushShape, ui.pixelGrid], schedule)
// Al cambiar de herramienta se termina el trazado de la Pluma en curso.
watch(
  () => tools.active,
  (now, before) => {
    if (before === 'pen' && now !== 'pen') controller.shapes.finishPen(false)
  }
)
watch(
  () => ui.theme,
  () => {
    gl?.refreshColors()
    schedule()
  }
)

const cursorClass = () =>
  tools.active === 'hand' ? 'grab' : tools.active === 'sel' ? 'default' : 'cross'
</script>

<template>
  <section class="pt-viewport is-current" :aria-label="t('viewer.name', { n: 1 })">
    <div class="pt-vhead pt-vhead--overlay">
      <span class="pt-vhead__lbl">{{ t('viewer.image') }}</span>
      <button type="button" class="pt-select image" :aria-label="t('viewer.image')">
        <span>{{ docs.active?.session.image.name ?? t('viewer.followsActive') }}</span>
        <PtIcon name="chevDown" />
      </button>
      <span class="pt-sep sep" />
      <button type="button" class="pt-select zoom" :aria-label="t('status.zoom')">
        <span class="pt-mono">{{ docs.zoomPercent }} %</span>
        <PtIcon name="chevDown" />
      </button>
      <span class="pt-sep sep" />
      <ActionButton id="view.pixelGrid" :on="ui.pixelGrid" />
      <ActionButton id="view.hidePaths" :on="ui.showPaths" />
      <ActionButton id="view.onion" />
      <span class="pt-sep sep" />
      <ActionButton id="view.play" />
      <div class="pt-spacer" />
      <button
        type="button"
        class="pt-iconbtn"
        :data-tip="t('viewer.more')"
        :aria-label="t('viewer.more')"
      >
        <PtIcon name="more" />
      </button>
    </div>

    <div
      ref="stage"
      class="pt-stage stage"
      :class="cursorClass()"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="onLeave"
      @dblclick="onDouble"
      @wheel="onWheel"
      @contextmenu.prevent
    >
      <canvas
        ref="glCanvas"
        class="layer"
        role="img"
        :aria-label="
          docs.active
            ? t('docs.canvasLabel', {
                w: docs.active.session.image.width,
                h: docs.active.session.image.height,
                zoom: docs.zoomPercent
              })
            : t('docs.noDocument')
        "
      />
      <canvas ref="ovCanvas" class="layer" aria-hidden="true" />
      <p v-if="isolated" class="notice" role="status">
        {{ t('notice.isolation') }}
      </p>
      <p v-else-if="notice" class="notice" role="status">{{ t(`notice.${notice}`) }}</p>
    </div>
  </section>
</template>

<style scoped>
.image {
  width: 178px;
}
.zoom {
  width: 74px;
}
.sep {
  margin: 5px 2px;
}
.stage {
  display: block;
  overflow: hidden;
  touch-action: none;
}
.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.stage.cross {
  cursor: crosshair;
}
.stage.grab {
  cursor: grab;
}
.stage.default {
  cursor: default;
}
.notice {
  position: absolute;
  left: 50%;
  bottom: var(--space-3);
  transform: translateX(-50%);
  margin: 0;
  padding: var(--space-1) var(--space-3);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 4px);
  color: var(--text-secondary);
}
</style>
