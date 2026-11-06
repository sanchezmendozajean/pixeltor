<script setup lang="ts">
// Un visor (specs/09): WebGL2 para la imagen + Canvas2D para el overlay (selección, cursor de pincel).
// Toda la lógica de herramientas vive en tools/controller.ts; cada visor tiene su propio controlador.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PtIcon from '@/components/PtIcon.vue'
import ActionButton from '@/components/ActionButton.vue'
import { actionLabel, execute } from '@/actions/registry'
import { useDocumentsStore } from '@/stores/documents'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import { cursorCss, type CursorKind } from '@/tools/cursors'
import {
  CanvasController,
  type Notice,
  activeController,
  setActiveController
} from '@/tools/controller'
import { GlView } from '@/viewport/GlView'
import { drawOverlay } from '@/viewport/overlay'
import { RULER, drawRuler, rulerColors } from '@/viewport/rulers'
import { GuideDrag, setActiveImage } from '@core/index'
import type { Workspace } from '@/session/workspace'
import { type TileMode, type ViewerState, mirrorViewerFlags } from '@/session/viewer'
import { t } from '@/i18n'

const props = defineProps<{ ws: Workspace; viewer: ViewerState }>()

const docs = useDocumentsStore()
const ui = useUiStore()
const tools = useToolsStore()

const stage = ref<HTMLDivElement>()
const glCanvas = ref<HTMLCanvasElement>()
const rulerH = ref<HTMLCanvasElement>()
const rulerV = ref<HTMLCanvasElement>()
const ovCanvas = ref<HTMLCanvasElement>()
const notice = ref<Notice>(null)
// Los visores no son reactivos: esta revisión fuerza el repintado de la cabecera.
const rev = ref(0)
const isolated = computed(() => (docs.rev, docs.session?.isolatedGroup ?? null))
const isActive = computed(() => (rev.value, props.ws.activeViewerId === props.viewer.id))
const single = computed(() => (rev.value, props.ws.viewers.length === 1))

let gl: GlView | null = null
let unsubs: (() => void)[] = []
let raf = 0
let pendingUpload: {
  full: boolean
  rect: { x: number; y: number; w: number; h: number } | null
} | null = { full: true, rect: null }
let lastBmp: unknown = null
let shownZoom = 0
let dash = 0
let ants = 0

const controller = new CanvasController(
  () => props.ws,
  (n) => (notice.value = n)
)

const v = (): ViewerState => props.viewer
/** Este visor pasa a atender la entrada: las herramientas leen su Viewport. */
const enter = (): void => {
  props.ws.enterViewer(props.viewer)
}

function schedule(): void {
  if (!raf) raf = requestAnimationFrame(frame)
}

const TILES: Record<TileMode, [boolean, boolean]> = {
  none: [false, false],
  both: [true, true],
  h: [true, false],
  v: [false, true]
}

function frame(): void {
  raf = 0
  const ws = props.ws
  const view = v()
  if (!gl || !stage.value) return
  enter()
  const vp = view.viewport
  const box = stage.value.getBoundingClientRect()
  vp.resize(box.width, box.height)
  const { bmp, own } = ws.displayFor(view)
  ;[vp.tileX, vp.tileY] = TILES[view.tiled]
  if (!view.fitted) {
    view.fitted = true
    vp.fit()
  }
  // una composición propia (fijada o en reproducción) se sube entera; la compartida, por regiones
  if (bmp !== lastBmp || own) {
    gl.upload(bmp)
    lastBmp = bmp
    pendingUpload = null
  } else if (pendingUpload) {
    gl.upload(bmp, pendingUpload.full ? undefined : (pendingUpload.rect ?? undefined))
    pendingUpload = null
  }
  gl.draw(vp, view.pixelGrid)

  const ov = ovCanvas.value!
  const dpr = window.devicePixelRatio || 1
  const w = Math.round(vp.width * dpr)
  const h = Math.round(vp.height * dpr)
  if (ov.width !== w || ov.height !== h) {
    ov.width = w
    ov.height = h
  }
  drawOverlay(ov.getContext('2d')!, vp, controller.overlayState(dash), dpr)
  drawRulers(vp, dpr)
  if (isActive.value && docs.zoomPercent !== vp.zoomPercent) docs.zoomPercent = vp.zoomPercent
  // la etiqueta de zoom de la cabecera se actualiza también cuando cambia sin pasar por la rueda (encajar)
  if (shownZoom !== vp.zoomPercent) {
    shownZoom = vp.zoomPercent
    rev.value++
  }
}

function drawRulers(vp: ViewerState['viewport'], dpr: number): void {
  const h = rulerH.value
  const vv = rulerV.value
  if (!h || !vv) return
  const colors = rulerColors()
  const hw = Math.round(vp.width * dpr)
  const hh = Math.round(RULER * dpr)
  if (h.width !== hw || h.height !== hh) {
    h.width = hw
    h.height = hh
  }
  const vh = Math.round(vp.height * dpr)
  if (vv.width !== hh || vv.height !== vh) {
    vv.width = hh
    vv.height = vh
  }
  drawRuler(h, vp, 'h', colors, dpr)
  drawRuler(vv, vp, 'v', colors, dpr)
}

/** Arrastrar desde una regla crea una guía; soltarla sobre la misma regla la elimina. */
function onRulerDown(axis: 'h' | 'v', e: PointerEvent): void {
  const ws = props.ws
  const vp = v().viewport
  const stageBox = stage.value!.getBoundingClientRect()
  const at = (ev: PointerEvent) => {
    const pt = vp.toImageRaw(ev.clientX - stageBox.left, ev.clientY - stageBox.top)
    return axis === 'h' ? pt.y : pt.x
  }
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const gd = GuideDrag.create(ws.session, axis, at(e))
  el.onpointermove = (ev) => gd.moveTo(at(ev))
  el.onpointerup = (ev) => {
    el.onpointermove = null
    el.onpointerup = null
    const over =
      axis === 'h' ? ev.clientY - stageBox.top < RULER : ev.clientX - stageBox.left < RULER
    gd.end(over)
  }
}

function bind(): void {
  const ws = props.ws
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
    ws.onView(() => {
      rev.value++
      schedule()
    }),
    ws.onLayout(() => {
      rev.value++
      schedule()
    })
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
    ctrl: e.ctrlKey || e.metaKey,
    // sólo un lápiz de tableta aporta presión; con ratón el tamaño no varía
    pressure: e.pointerType === 'pen' ? e.pressure : undefined
  }
}

/** Hace activo este visor (y su controlador, que atiende Intro/Esc de la Pluma). */
function activate(): void {
  const ws = props.ws
  enter()
  setActiveController(controller)
  if (ws.activeViewerId !== props.viewer.id) {
    ws.setActiveViewer(props.viewer.id)
    mirrorViewerFlags(ws)
  }
}

function onDown(e: PointerEvent): void {
  if (e.button === 1) e.preventDefault()
  activate()
  const ws = props.ws
  const view = v()
  // un puntero sintético (pruebas, accesibilidad) no admite captura: se ignora
  try {
    stage.value!.setPointerCapture(e.pointerId)
  } catch {
    /* sin captura */
  }
  // un visor en reproducción sólo se mira; uno fijado a otra imagen la activa al editar
  if (view.playImageId) return
  if (view.imageId && view.imageId !== ws.session.activeImageId) {
    controller.cancelInteraction()
    setActiveImage(ws.session, view.imageId)
  }
  controller.down(info(e))
  schedule()
}
/** Último puntero conocido (para recalcular el cursor al pulsar Ctrl/Alt sin mover el ratón). */
let lastInfo: ReturnType<typeof info> | null = null

/** Cursor de la herramienta: guías, trazados (pluma, flecha de anclas) o el predeterminado. */
function applyCursor(p: ReturnType<typeof info> | null): void {
  const el = stage.value
  if (!el) return
  enter()
  if (controller.guideHover) {
    el.style.cursor = controller.guideHover === 'v' ? 'ew-resize' : 'ns-resize'
    return
  }
  if (controller.mirrorHover) {
    const mh = controller.mirrorHover
    el.style.cursor = mh === 'x' ? 'ew-resize' : mh === 'y' ? 'ns-resize' : 'move'
    return
  }
  const kind = p ? controller.cursorHint(p) : null
  el.style.cursor = kind ? cursorCss(kind) : toolCursor()
}

/** Cursor de una herramienta de trazados con el puntero fuera del lienzo o sin moverse. */
function toolCursor(): string {
  const map: Record<string, CursorKind> = {
    pen: 'pen',
    dsel: 'direct',
    addAnchor: 'pen-plus',
    delAnchor: 'pen-minus',
    convAnchor: 'pen-convert'
  }
  const k = map[tools.active]
  return k ? cursorCss(k) : ''
}

function onMove(e: PointerEvent): void {
  enter()
  const p = info(e)
  lastInfo = p
  if (v().playImageId) return
  controller.moveTo(p)
  props.ws.syncFrom(v())
  applyCursor(p)
  schedule()
}
function onUp(e: PointerEvent): void {
  enter()
  controller.up()
  if (stage.value?.hasPointerCapture(e.pointerId)) stage.value.releasePointerCapture(e.pointerId)
  schedule()
}
function onDouble(e: MouseEvent): void {
  enter()
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
  lastInfo = null
  docs.cursor = null
  schedule()
}
function onWheel(e: WheelEvent): void {
  enter()
  e.preventDefault()
  const box = stage.value!.getBoundingClientRect()
  v().viewport.stepZoom(e.deltaY < 0 ? 1 : -1, e.clientX - box.left, e.clientY - box.top)
  props.ws.syncFrom(v())
  props.ws.refreshView()
}

function onKeyDown(e: KeyboardEvent): void {
  if (lastInfo && (e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta'))
    applyCursor({ ...lastInfo, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, shift: e.shiftKey })
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
    controller.spaceDown = true
    e.preventDefault()
  }
}
function onKeyUp(e: KeyboardEvent): void {
  if (lastInfo && (e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta'))
    applyCursor({ ...lastInfo, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, shift: e.shiftKey })
  if (e.code === 'Space') controller.spaceDown = false
}

// ---- cabecera: menús del visor ----
type MenuKind = 'image' | 'zoom' | 'tile' | 'more'
const menu = ref<{ kind: MenuKind; x: number; y: number } | null>(null)
function openMenu(kind: MenuKind, e: MouseEvent): void {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  menu.value = { kind, x: r.left, y: r.bottom + 2 }
}
function dismiss(e: Event): void {
  if (!menu.value) return
  if (e instanceof KeyboardEvent && e.key !== 'Escape') return
  if (e instanceof PointerEvent && (e.target as HTMLElement).closest('.viewermenu')) return
  menu.value = null
}
function run(fn: () => void): void {
  menu.value = null
  fn()
  rev.value++
  schedule()
}
const images = computed(() => (docs.rev, rev.value, props.ws.session.doc.images))
const imageLabel = computed(() => {
  void rev.value
  void docs.rev
  const id = v().imageId
  const img = id ? props.ws.session.doc.images.find((i) => i.id === id) : null
  return img ? img.name : t('viewer.followsActive')
})
const pinned = (id: string | null): boolean => (rev.value, v().imageId === id)
function pin(id: string | null): void {
  run(() => {
    v().imageId = id
    props.ws.refreshView()
  })
}
function setZoom(z: number | 'fit'): void {
  run(() => {
    const vp = v().viewport
    if (z === 'fit') vp.fit()
    else vp.setZoom(z)
    props.ws.syncFrom(v())
    props.ws.refreshView()
  })
}
function setTile(m: TileMode): void {
  run(() => (v().tiled = m))
}
const TILE_OPTIONS: TileMode[] = ['none', 'both', 'h', 'v']
const ZOOMS = [0.5, 1, 2, 4, 8, 12, 16, 32]
const flag = (k: 'pixelGrid' | 'showPaths' | 'onion' | 'sync'): boolean => (rev.value, v()[k])
const tiledOn = computed(() => (rev.value, v().tiled !== 'none'))
const zoomLabel = computed(() => (rev.value, `${v().viewport.zoomPercent} %`))

let ro: ResizeObserver | null = null
onMounted(() => {
  gl = new GlView(glCanvas.value!)
  gl.refreshColors()
  ro = new ResizeObserver(schedule)
  ro.observe(stage.value!)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  document.addEventListener('pointerdown', dismiss, true)
  document.addEventListener('keydown', dismiss, true)
  ants = window.setInterval(() => {
    if (props.ws.session.selection.mask) {
      dash = (dash + 1) % 8
      schedule()
    }
  }, 120)
  if (props.ws.activeViewerId === props.viewer.id) setActiveController(controller)
  bind()
})

onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  document.removeEventListener('pointerdown', dismiss, true)
  document.removeEventListener('keydown', dismiss, true)
  clearInterval(ants)
  controller.cancelInteraction()
  if (activeController === controller) setActiveController(null)
  cancelAnimationFrame(raf)
  for (const u of unsubs) u()
  unsubs = []
})

watch(isActive, (on) => {
  if (on) setActiveController(controller)
})
// El overlay (selección) y el cursor dependen del modelo; la rejilla y el tema, de la UI.
watch(
  () => [
    docs.rev,
    tools.active,
    tools.brushSize,
    tools.brushShape,
    ui.pixelGrid,
    ui.showMirrorLines
  ],
  schedule
)
// Al cambiar de herramienta se termina el trazado de la Pluma en curso.
watch(
  () => tools.active,
  (now, before) => {
    if (before === 'pen' && now !== 'pen') controller.shapes.finishPen(false)
    if (isActive.value) applyCursor(lastInfo)
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
  <section
    class="pt-viewport"
    :class="{ 'is-current': isActive && !single }"
    :aria-label="t('viewer.name', { n: props.viewer.id.slice(1) })"
    @pointerdown.capture="activate"
  >
    <div class="pt-vhead pt-vhead--overlay">
      <span class="pt-vhead__lbl">{{ t('viewer.image') }}</span>
      <button
        type="button"
        class="pt-select image"
        :aria-label="`${t('viewer.image')}: ${imageLabel}`"
        @click="openMenu('image', $event)"
      >
        <span>{{ imageLabel }}</span>
        <PtIcon name="chevDown" />
      </button>
      <span class="pt-sep sep" />
      <button
        type="button"
        class="pt-select zoom"
        :aria-label="`${t('status.zoom')} ${zoomLabel}`"
        @click="openMenu('zoom', $event)"
      >
        <span class="pt-mono">{{ zoomLabel }}</span>
        <PtIcon name="chevDown" />
      </button>
      <span class="pt-sep sep" />
      <ActionButton id="view.pixelGrid" :on="flag('pixelGrid')" />
      <ActionButton id="view.hidePaths" :on="flag('showPaths')" />
      <ActionButton id="view.onion" :on="flag('onion')" />
      <button
        type="button"
        class="pt-iconbtn"
        :class="{ 'is-on': tiledOn }"
        :data-tip="t('viewer.mosaic')"
        :aria-label="t('viewer.mosaic')"
        @click="openMenu('tile', $event)"
      >
        <PtIcon name="tiled" />
      </button>
      <span class="pt-sep sep" />
      <ActionButton id="view.play" />
      <div class="pt-spacer" />
      <button
        type="button"
        class="pt-iconbtn"
        :data-tip="t('viewer.more')"
        :aria-label="t('viewer.more')"
        @click="openMenu('more', $event)"
      >
        <PtIcon name="more" />
      </button>
      <button
        v-if="!single"
        type="button"
        class="pt-iconbtn"
        :data-tip="actionLabel('window.closeViewer')"
        :aria-label="actionLabel('window.closeViewer')"
        @click="run(() => ws.closeViewer(viewer.id))"
      >
        <PtIcon name="close" />
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
          t('docs.canvasLabel', {
            w: ws.session.image.width,
            h: ws.session.image.height,
            zoom: viewer.viewport.zoomPercent
          })
        "
      />
      <canvas ref="ovCanvas" class="layer" aria-hidden="true" />
      <canvas
        ref="rulerH"
        class="ruler ruler-h"
        @pointerdown.stop.prevent="onRulerDown('h', $event)"
      />
      <canvas
        ref="rulerV"
        class="ruler ruler-v"
        @pointerdown.stop.prevent="onRulerDown('v', $event)"
      />
      <p v-if="isolated && isActive" class="notice" role="status">
        {{ t('notice.isolation') }}
      </p>
      <p v-else-if="notice" class="notice" role="status">{{ t(`notice.${notice}`) }}</p>
    </div>

    <Teleport to="body">
      <div
        v-if="menu"
        class="pt-menu viewermenu"
        role="menu"
        :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      >
        <template v-if="menu.kind === 'image'">
          <div class="pt-mi" role="menuitem" @click="pin(null)">
            <span class="chk">{{ pinned(null) ? '✓' : '' }}</span>
            {{ t('viewer.followsActive') }}
          </div>
          <div class="pt-msep" />
          <div
            v-for="img in images"
            :key="img.id"
            class="pt-mi"
            role="menuitem"
            @click="pin(img.id)"
          >
            <span class="chk">{{ pinned(img.id) ? '✓' : '' }}</span>
            {{ img.name }}
          </div>
        </template>
        <template v-else-if="menu.kind === 'zoom'">
          <div v-for="z in ZOOMS" :key="z" class="pt-mi" role="menuitem" @click="setZoom(z)">
            {{ Math.round(z * 100) }} %
          </div>
          <div class="pt-msep" />
          <div class="pt-mi" role="menuitem" @click="setZoom('fit')">
            {{ actionLabel('view.zoomFit') }}
          </div>
        </template>
        <template v-else-if="menu.kind === 'tile'">
          <div v-for="m in TILE_OPTIONS" :key="m" class="pt-mi" role="menuitem" @click="setTile(m)">
            <span class="chk">{{ viewer.tiled === m ? '✓' : '' }}</span>
            {{ t(`viewer.tile.${m}`) }}
          </div>
        </template>
        <template v-else>
          <div class="pt-mi" role="menuitem" @click="run(() => execute('window.splitV'))">
            {{ actionLabel('window.splitV') }}
          </div>
          <div class="pt-mi" role="menuitem" @click="run(() => execute('window.splitH'))">
            {{ actionLabel('window.splitH') }}
          </div>
          <div class="pt-msep" />
          <div class="pt-mi" role="menuitem" @click="run(() => execute('view.syncViewers'))">
            <span class="chk">{{ flag('sync') ? '✓' : '' }}</span>
            {{ actionLabel('view.syncViewers') }}
          </div>
        </template>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.image {
  width: 150px;
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
.ruler {
  position: absolute;
  left: 0;
  top: 0;
  cursor: crosshair;
}
.ruler-h {
  width: 100%;
  height: 16px;
}
.ruler-v {
  height: 100%;
  width: 16px;
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
.viewermenu {
  position: fixed;
  z-index: 80;
  min-width: 160px;
}
.chk {
  position: absolute;
  left: 10px;
  width: 14px;
}
</style>
