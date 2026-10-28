<script setup lang="ts">
// Panel Capas: lista (arriba = capa superior), visibilidad, bloqueo, renombrar, reordenar
// arrastrando, y opacidad / modo de fusión / bloqueo de transparencia de la capa activa.
import { computed, nextTick, ref } from 'vue'
import { BLEND_MODES, type BlendMode, moveShapesToLayer, selectShapes } from '@core/index'
import PtIcon from '@/components/PtIcon.vue'
import ActionButton from '@/components/ActionButton.vue'
import LayerThumb from './LayerThumb.vue'
import { useDocumentsStore } from '@/stores/documents'
import { t, type I18nKey } from '@/i18n'

const docs = useDocumentsStore()
const editing = ref<string | null>(null)
const draft = ref('')
const dragId = ref<string | null>(null)
/** Forma arrastrada hacia otra capa. */
const dragShape = ref<string | null>(null)
const dropIndex = ref<number | null>(null)

const active = computed(() => docs.layers.find((l) => l.active))
const opacityPct = computed(() => Math.round((active.value?.opacity ?? 1) * 100))

function onShapeClick(layerId: string, id: string, e: MouseEvent): void {
  const s = docs.session
  if (!s) return
  s.setActiveLayer(layerId)
  const cur = s.selectedShapes
  selectShapes(
    s,
    e.shiftKey ? (cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]) : [id]
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
</script>

<template>
  <div class="layers">
    <ul class="list pt-scroll" role="listbox" :aria-label="t('panels.layers')">
      <template v-for="(l, i) in docs.layers" :key="l.id">
        <li
          class="pt-lrow"
          :class="{
            'is-current': l.active,
            'is-hidden': !l.visible,
            'is-drop': dropIndex === i && dragId !== l.id
          }"
          role="option"
          :aria-selected="l.active"
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
          <LayerThumb :layer-id="l.id" />
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
          v-for="sh in l.shapes"
          :key="sh.id"
          class="pt-lrow pt-srow"
          :class="{ 'is-selected': sh.selected, 'is-hidden': !sh.visible }"
          draggable="true"
          @dragstart.stop="dragShape = sh.id"
          @dragend="((dragShape = null), (dropIndex = null))"
          @click="onShapeClick(l.id, sh.id, $event)"
        >
          <span class="indent" />
          <span class="pt-lbar" :style="{ background: l.color }" />
          <span class="pt-lname">{{ sh.name }}</span>
        </li>
      </template>
    </ul>

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
      <ActionButton id="layer.duplicate" />
    </div>
  </div>
</template>

<style scoped>
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
  border-top: 1px solid var(--border-subtle);
}
.props .pt-num {
  width: 104px;
}
.mode {
  flex: 1;
  min-width: 0;
}
</style>
