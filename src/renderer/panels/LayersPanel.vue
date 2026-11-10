<script setup lang="ts">
// Panel Capas: lista (arriba = capa superior), visibilidad, bloqueo, renombrar, reordenar
// arrastrando, y opacidad / modo de fusión / bloqueo de transparencia de la capa activa.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BLEND_MODES,
  type BlendMode,
  MIRROR_TYPES,
  moveShapesToLayer,
  reorderShapes,
  selectShapes,
  setLayerMirrorEnabled,
  updateShape
} from '@core/index'
import PtIcon from '@/components/PtIcon.vue'
import ActionButton from '@/components/ActionButton.vue'
import LayerThumb from './LayerThumb.vue'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { actionLabel, execute, isChecked, isEnabled } from '@/actions/registry'
import { t, type I18nKey } from '@/i18n'

const docs = useDocumentsStore()
const ui = useUiStore()
const editing = ref<string | null>(null)
const draft = ref('')
const dragId = ref<string | null>(null)
/** Forma arrastrada hacia otra capa. */
const dragShape = ref<string | null>(null)
const dropIndex = ref<number | null>(null)
/** Fila de forma sobre la que se suelta otra forma, y en qué mitad (encima/debajo en la lista). */
const dropShape = ref<{ id: string; pos: 'above' | 'below' } | null>(null)

function onShapeOver(id: string, e: DragEvent): void {
  if (!dragShape.value) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  // la lista muestra arriba lo que está encima en la pila
  dropShape.value = { id, pos: e.clientY < r.top + r.height / 2 ? 'above' : 'below' }
}
function onShapeDrop(id: string): void {
  const s = docs.session
  const drag = dragShape.value
  const pos = dropShape.value?.id === id ? dropShape.value.pos : 'above'
  dragShape.value = null
  dropShape.value = null
  dropIndex.value = null
  if (!s || !drag) return
  const ids = s.selectedShapes.includes(drag) ? s.selectedShapes : [drag]
  reorderShapes(s, ids, id, pos)
}

const active = computed(() => docs.layers.find((l) => l.active))
/** Grupos plegados: sus miembros no se listan. */
const folded = computed(
  () => new Set(docs.layers.filter((l) => l.isGroup && l.collapsed).map((l) => l.id))
)
const hidden = (l: { groupId: string | null }): boolean =>
  !!l.groupId && folded.value.has(l.groupId)
const opacityPct = computed(() => Math.round((active.value?.opacity ?? 1) * 100))

function onShapeClick(layerId: string, id: string, e: MouseEvent): void {
  const s = docs.session
  if (!s) return
  s.setActiveLayer(layerId)
  // Una capa bloqueada no permite seleccionar sus formas (igual que en el lienzo).
  if (docs.layers.find((l) => l.id === layerId)?.locked) return
  const cur = s.selectedShapes
  selectShapes(
    s,
    e.shiftKey ? (cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]) : [id]
  )
}

function toggleShape(id: string): void {
  const s = docs.session
  if (!s) return
  updateShape(
    s,
    id,
    (sh) => {
      sh.visible = !sh.visible
    },
    t('layers.shapeVisible')
  )
}

function setProps(
  id: string,
  patch: Parameters<NonNullable<typeof docs.session>['setLayerProps']>[1]
) {
  docs.session?.setLayerProps(id, patch)
}

async function startRename(id: string, name: string) {
  editing.value = id
  draft.value = name
  await nextTick()
  document.getElementById(`ren-${id}`)?.focus()
}
function commitRename() {
  const id = editing.value
  editing.value = null
  const name = draft.value.trim()
  if (id && name) setProps(id, { name })
}

function onOpacity(e: Event) {
  const v = Number.parseInt((e.target as HTMLInputElement).value, 10)
  if (active.value && Number.isFinite(v))
    setProps(active.value.id, { opacity: Math.min(100, Math.max(0, v)) / 100 })
}

/** Arrastrando hacia abajo la capa queda tras la fila destino: la línea va debajo. */
function dropAfter(i: number): boolean {
  return docs.layers.findIndex((x) => x.id === dragId.value) < i
}

/** ¿La capa muestra filas de formas bajo ella? (la línea de destino va tras la última) */
function hasKids(l: { groupId: string | null; collapsed: boolean; shapes: unknown[] }): boolean {
  return !hidden(l) && !l.collapsed && l.shapes.length > 0
}

// Reordenar: la lista está invertida (la fila 0 es la capa de más arriba).
function onDrop(rowIndex: number) {
  if (dragShape.value) {
    const s = docs.session
    const target = docs.layers[rowIndex]
    const ids =
      s && dragShape.value && s.selectedShapes.includes(dragShape.value)
        ? s.selectedShapes
        : [dragShape.value]
    dragShape.value = null
    dropIndex.value = null
    if (s && target) moveShapesToLayer(s, ids, target.id)
    return
  }
  const s = docs.session
  const id = dragId.value
  dragId.value = null
  dropIndex.value = null
  if (!s || !id) return
  const count = s.image.layers.length
  // Se suelta encima de la fila rowIndex → pasa a ocupar su posición.
  s.moveLayer(id, count - 1 - rowIndex)
}

const mirrorMenuEl = ref<HTMLElement | null>(null)
/** Posición final del menú: se desplaza para no salirse de la ventana. */
const mirrorPos = ref({ left: 0, top: 0 })
watch(
  () => ui.mirrorMenu,
  async (m) => {
    if (!m) return
    mirrorPos.value = { left: m.x, top: m.y }
    await nextTick()
    const el = mirrorMenuEl.value
    if (!el) return
    const r = el.getBoundingClientRect()
    mirrorPos.value = {
      left: Math.max(4, Math.min(m.x, window.innerWidth - r.width - 4)),
      top: Math.max(4, Math.min(m.y, window.innerHeight - r.height - 4))
    }
  }
)

/** Menú de tipos de espejo (se abre desde el botón Espejo de la capa activa). */
function pickMirror(id: string): void {
  if (execute(id)) ui.mirrorMenu = null
}
function dismissMirrorMenu(e: Event): void {
  if (!ui.mirrorMenu) return
  if (e instanceof KeyboardEvent && e.key !== 'Escape') return
  if (e instanceof PointerEvent) {
    const el = e.target as HTMLElement
    if (el.closest('.mirrormenu') || el.closest('[data-action="layer.mirrorMenu"]')) return
  }
  ui.mirrorMenu = null
}
onMounted(() => {
  document.addEventListener('pointerdown', dismissMirrorMenu, true)
  document.addEventListener('keydown', dismissMirrorMenu, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', dismissMirrorMenu, true)
  document.removeEventListener('keydown', dismissMirrorMenu, true)
})
</script>

<template>
  <div class="layers">
    <div v-if="active" class="props">
      <label class="pt-num">
        <span class="pt-num__lbl">{{ t('layers.opacity') }}</span>
        <span class="pt-numbox">
          <input class="pt-input" :value="opacityPct" inputmode="numeric" @change="onOpacity" />
          <span class="pt-unit">%</span>
        </span>
      </label>
      <select
        class="pt-select mode"
        :value="active.blendMode"
        :aria-label="t('layers.blend')"
        @change="
          setProps(active.id, {
            blendMode: ($event.target as HTMLSelectElement).value as BlendMode
          })
        "
      >
        <option v-for="m in BLEND_MODES" :key="m" :value="m">
          {{ t(`layers.modes.${m}` as I18nKey) }}
        </option>
      </select>
      <ActionButton id="layer.lockAlpha" :on="active.lockAlpha" />
      <ActionButton id="layer.mirrorMenu" :on="!!active.mirror?.enabled" />
    </div>

    <Teleport to="body">
      <div
        v-if="ui.mirrorMenu"
        ref="mirrorMenuEl"
        class="pt-menu mirrormenu"
        role="menu"
        :style="{ left: `${mirrorPos.left}px`, top: `${mirrorPos.top}px` }"
      >
        <div
          v-for="m in MIRROR_TYPES"
          :key="m"
          class="pt-mi"
          role="menuitem"
          :class="{ 'is-disabled': !isEnabled(`layer.mirror.${m}`) }"
          @click="pickMirror(`layer.mirror.${m}`)"
        >
          <span class="pt-mi__ic"
            ><PtIcon v-if="isChecked(`layer.mirror.${m}`)" name="check"
          /></span>
          {{ actionLabel(`layer.mirror.${m}`) }}
        </div>
        <div class="pt-msep" role="separator" />
        <div
          class="pt-mi"
          role="menuitem"
          :class="{ 'is-disabled': !isEnabled('layer.mirror.off') }"
          @click="pickMirror('layer.mirror.off')"
        >
          <span class="pt-mi__ic" />
          {{ actionLabel('layer.mirror.off') }}
        </div>
      </div>
    </Teleport>

    <ul class="list pt-scroll" role="list" :aria-label="t('panels.layers')">
      <template v-for="(l, i) in docs.layers" :key="l.id">
        <li
          v-if="!hidden(l)"
          class="pt-lrow"
          :class="{
            'is-group': l.isGroup,
            'is-member': !!l.groupId,
            'is-clip': l.clip,
            'is-current': l.active,
            'is-hidden': !l.visible,
            'is-drop': dropIndex === i && dragId !== null && dragId !== l.id && !dropAfter(i),
            'is-drop-after':
              dropIndex === i && dragId !== null && dragId !== l.id && dropAfter(i) && !hasKids(l),
            'is-drop-into': dropIndex === i && dragShape !== null
          }"
          :aria-current="l.active || undefined"
          draggable="true"
          @click="docs.session?.setActiveLayer(l.id)"
          @dragstart="dragId = l.id"
          @dragover.prevent="dropIndex = i"
          @dragleave="dropIndex = null"
          @drop.prevent="onDrop(i)"
          @dragend="((dragId = null), (dropIndex = null))"
        >
          <button
            type="button"
            class="pt-lcol"
            :aria-label="t('layers.visible')"
            :aria-pressed="l.visible"
            @click.stop="setProps(l.id, { visible: !l.visible })"
          >
            <PtIcon :name="l.visible ? 'eye' : 'eyeOff'" />
          </button>
          <span class="pt-lbar" :style="{ background: l.color }" />
          <button
            v-if="l.isGroup || l.shapes.length"
            type="button"
            class="pt-lcol fold"
            :aria-label="t(l.collapsed ? 'layers.expand' : 'layers.collapse')"
            :aria-expanded="!l.collapsed"
            @click.stop="setProps(l.id, { collapsed: !l.collapsed })"
          >
            <PtIcon :name="l.collapsed ? 'chevRight' : 'chevDown'" />
          </button>
          <span v-else class="fold" />
          <PtIcon v-if="l.isGroup" name="folder" class="gicon" />
          <LayerThumb v-else :layer-id="l.id" />
          <PtIcon v-if="l.clip" name="chevRight" class="clip" :title="t('layers.clipped')" />
          <input
            v-if="editing === l.id"
            :id="`ren-${l.id}`"
            v-model="draft"
            class="pt-input rename"
            :aria-label="t('layers.rename')"
            @click.stop
            @keydown.enter.prevent="commitRename"
            @keydown.escape.prevent="editing = null"
            @blur="commitRename"
          />
          <span v-else class="pt-lname" @dblclick.stop="startRename(l.id, l.name)">
            {{ l.name }}
            <em v-if="l.lockAlpha"> · α</em>
          </span>
          <span
            v-if="l.fx"
            class="fx-tag"
            :title="t('effects.title')"
            @dblclick.stop="ui.requestTab = 'effects'"
            >fx</span
          >
          <button
            v-if="l.mirror"
            type="button"
            class="pt-lcol pt-lcol--mirror"
            :class="{ 'is-off': !l.mirror.enabled }"
            :aria-label="t('layers.mirrorToggle')"
            :data-tip="t('layers.mirrorToggle')"
            :aria-pressed="l.mirror.enabled"
            @click.stop="
              docs.session && setLayerMirrorEnabled(docs.session, l.id, !l.mirror.enabled)
            "
          >
            <PtIcon name="mirror" />
          </button>
          <button
            type="button"
            class="pt-lcol pt-lcol--lock"
            :aria-label="t('layers.lock')"
            :aria-pressed="l.locked"
            @click.stop="setProps(l.id, { locked: !l.locked })"
          >
            <PtIcon :name="l.locked ? 'lock' : 'unlock'" />
          </button>
        </li>
        <li
          v-for="(sh, si) in hidden(l) || l.collapsed ? [] : l.shapes"
          :key="sh.id"
          class="pt-lrow pt-srow"
          :class="{
            'is-selected': sh.selected,
            'is-hidden': !sh.visible,
            'is-drop': dropShape?.id === sh.id && dropShape.pos === 'above',
            'is-drop-after':
              (dropShape?.id === sh.id && dropShape.pos === 'below') ||
              (si === l.shapes.length - 1 &&
                dropIndex === i &&
                dragId !== null &&
                dragId !== l.id &&
                dropAfter(i))
          }"
          draggable="true"
          @dragstart.stop="dragShape = sh.id"
          @dragover.prevent="dragShape ? onShapeOver(sh.id, $event) : dragId && (dropIndex = i)"
          @dragleave="dragShape ? (dropShape = null) : dragId && (dropIndex = null)"
          @drop.prevent="dragShape ? onShapeDrop(sh.id) : dragId && onDrop(i)"
          @dragend="((dragShape = null), (dropShape = null), (dropIndex = null))"
          @click="onShapeClick(l.id, sh.id, $event)"
        >
          <button
            type="button"
            class="pt-lcol pt-lcol--shape"
            :aria-label="t('layers.shapeVisible')"
            :aria-pressed="sh.visible"
            @click.stop="toggleShape(sh.id)"
          >
            <PtIcon :name="sh.visible ? 'eye' : 'eyeOff'" />
          </button>
          <span class="indent" :style="{ width: `${16 + sh.depth * 14}px` }" />
          <span class="pt-lbar pt-lbar--shape" :style="{ background: l.color }" />
          <span class="pt-lname">{{ sh.name }}</span>
          <span
            v-if="sh.fx"
            class="fx-tag"
            :title="t('effects.title')"
            @dblclick.stop="ui.requestTab = 'effects'"
            >fx</span
          >
        </li>
      </template>
    </ul>
  </div>
</template>

<style scoped>
.mirrormenu {
  position: fixed;
  z-index: 80;
  min-width: 220px;
}
.mirrormenu .pt-mi:hover:not(.is-disabled) {
  background: var(--accent-solid);
  color: var(--on-accent);
}
button.pt-lcol--mirror {
  border: 0;
  background: none;
  padding: 0;
  color: var(--mirror-line);
}
button.pt-lcol--mirror.is-off {
  color: var(--icon);
  opacity: 0.55;
}
.layers {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
button.pt-lcol {
  border: 0;
  background: none;
  padding: 0;
}
.is-member {
  padding-left: 14px;
}
.fold {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--icon);
}
.gicon {
  width: 16px;
  height: 16px;
  margin: 0 4px;
  color: var(--icon);
}
.clip {
  width: 10px;
  height: 10px;
  transform: rotate(90deg);
  color: var(--text-secondary);
}
.indent {
  width: 38px;
  flex: none;
}
.rename {
  flex: 1;
  min-width: 0;
  margin-left: 6px;
}
.props {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--panel-pad-x);
  border-bottom: 1px solid var(--border-subtle);
}
.props .pt-num {
  width: 104px;
}
.mode {
  flex: 1;
  min-width: 0;
}
</style>
