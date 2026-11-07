<script setup lang="ts">
// Panel Efectos (specs/06): lista los efectos del objetivo (la forma seleccionada o, si no hay,
// la capa activa) con sus parámetros en línea. Los ajustes se ven en vivo y registran un solo
// paso de historial al soltar.
import { computed, ref } from 'vue'
import {
  type Effect,
  type EffectTarget,
  type ParamDef,
  type ParamValue,
  activePalette,
  applyEffectPreset,
  commitEffectEdit,
  duplicateEffect,
  effectDef,
  getEffects,
  getShape,
  liveUpdateEffect,
  moveEffect,
  rasterizeLayerEffects,
  removeEffect,
  stampShapes,
  updateEffect
} from '@core/index'
import PtIcon from '@/components/PtIcon.vue'
import { useDocumentsStore } from '@/stores/documents'
import ColorButton from '@/components/ColorButton.vue'
import { t, type I18nKey } from '@/i18n'

const docs = useDocumentsStore()

const target = computed<EffectTarget | null>(() => {
  void docs.rev
  const s = docs.session
  if (!s) return null
  const id = s.selectedShapes[0]
  if (id && getShape(s, id) && getShape(s, id)!.kind !== 'group') return { kind: 'shape', id }
  return { kind: 'layer', id: s.activeLayerId }
})

const title = computed(() => {
  void docs.rev
  const s = docs.session
  const tg = target.value
  if (!s || !tg) return t('effects.noTarget')
  if (tg.kind === 'shape') return t('effects.targetShape', { name: getShape(s, tg.id)?.name ?? '' })
  return t('effects.targetLayer', { name: s.activeLayer.name })
})

const list = computed<Effect[]>(() => {
  void docs.rev
  const s = docs.session
  const tg = target.value
  return s && tg ? [...getEffects(s, tg)] : []
})

const palettes = computed(() => {
  void docs.rev
  const p = docs.session ? activePalette(docs.session) : null
  return p ? [p] : []
})

const label = (key: string): string => t(`effects.params.${key}` as I18nKey)
const typeName = (type: string): string => t(`effects.types.${type}` as I18nKey)
const optionName = (v: string): string => t(`effects.options.${v}` as I18nKey)
const defs = (fx: Effect): ParamDef[] => effectDef(fx.type)?.params ?? []

const liveKey = (fx: Effect, key: string): string => `fx:${fx.id}:${key}`

function live(fx: Effect, key: string, value: ParamValue): void {
  if (docs.session && target.value)
    liveUpdateEffect(docs.session, target.value, fx.id, liveKey(fx, key), {
      params: { [key]: value }
    })
}
function commit(fx: Effect, key: string): void {
  if (docs.session) commitEffectEdit(docs.session, liveKey(fx, key))
}
function setNow(fx: Effect, patch: Parameters<typeof updateEffect>[3]): void {
  if (docs.session && target.value) updateEffect(docs.session, target.value, fx.id, patch)
}
function num(e: Event): number {
  return Number.parseFloat((e.target as HTMLInputElement).value)
}
function onNum(fx: Effect, d: ParamDef, e: Event): void {
  const v = num(e)
  if (Number.isFinite(v)) live(fx, d.key, v)
}

// ---- presets (se recuerdan en este equipo) ----
interface Preset {
  name: string
  effects: Omit<Effect, 'id'>[]
}
const PRESET_KEY = 'pixeltor.fxPresets'
function loadPresets(): Preset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PRESET_KEY) ?? '[]') as unknown
    return Array.isArray(raw)
      ? (raw as Preset[]).filter((p) => p && p.name && Array.isArray(p.effects))
      : []
  } catch {
    return []
  }
}
const presets = ref<Preset[]>(loadPresets())
const presetName = ref('')
function savePreset(): void {
  const name = presetName.value.trim()
  if (!name || !list.value.length) return
  const effects = list.value.map(({ type, enabled, params, output }) => ({
    type,
    enabled,
    params: { ...params },
    ...(output ? { output: { ...output } } : {})
  }))
  presets.value = [...presets.value.filter((p) => p.name !== name), { name, effects }]
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(presets.value))
  } catch {
    // sin almacenamiento: el preset dura la sesión
  }
  presetName.value = ''
}
function applyPreset(e: Event): void {
  const sel = e.target as HTMLSelectElement
  const p = presets.value.find((x) => x.name === sel.value)
  sel.value = ''
  if (p && docs.session && target.value) applyEffectPreset(docs.session, target.value, p.effects)
}

/** Aplicar efecto: capa → estampa hasta este efecto; forma → estampa la forma con sus efectos. */
function applyFx(fx: Effect): void {
  const s = docs.session
  const tg = target.value
  if (!s || !tg) return
  if (tg.kind === 'layer') rasterizeLayerEffects(s, tg.id, fx.id)
  else stampShapes(s, [tg.id])
}

const outAlpha = (fx: Effect): string => fx.output?.alpha ?? 'keep'
function setOutput(fx: Effect, alpha: string): void {
  setNow(fx, {
    output: {
      ...fx.output,
      alpha: alpha as 'keep' | 'threshold' | 'dither',
      threshold: fx.output?.threshold ?? 128
    }
  })
}
function setThreshold(fx: Effect, e: Event): void {
  const v = Math.min(255, Math.max(0, Math.round(num(e))))
  if (Number.isFinite(v)) setNow(fx, { output: { alpha: outAlpha(fx) as 'keep', threshold: v } })
}
function setPalette(fx: Effect, e: Event): void {
  const id = (e.target as HTMLSelectElement).value
  const base = { alpha: outAlpha(fx) as 'keep', threshold: fx.output?.threshold ?? 128 }
  setNow(fx, { output: id ? { ...base, quantizeToPalette: id } : base })
}
</script>

<template>
  <div class="fx">
    <p class="who">{{ title }}</p>
    <p v-if="!list.length" class="pt-sec2 none">{{ t('effects.none') }}</p>
    <div class="presets">
      <select
        class="pt-select"
        value=""
        :aria-label="t('effects.presetApply')"
        @change="applyPreset"
      >
        <option value="" disabled>{{ t('effects.presetApply') }}</option>
        <option v-for="p in presets" :key="p.name" :value="p.name">{{ p.name }}</option>
      </select>
      <input
        v-model="presetName"
        class="pt-input"
        :placeholder="t('effects.presetName')"
        :aria-label="t('effects.presetName')"
        @keydown.enter="savePreset"
      />
      <button
        type="button"
        class="pt-btn pt-btn--secondary"
        :disabled="!list.length || !presetName.trim()"
        @click="savePreset"
      >
        {{ t('effects.presetSave') }}
      </button>
    </div>
    <section v-for="(fx, i) in list" :key="fx.id" class="card" :class="{ off: !fx.enabled }">
      <header>
        <input
          type="checkbox"
          :checked="fx.enabled"
          :aria-label="t('effects.enabled')"
          @change="setNow(fx, { enabled: ($event.target as HTMLInputElement).checked })"
        />
        <strong>{{ typeName(fx.type) }}</strong>
        <span class="pt-spacer" />
        <button
          type="button"
          class="pt-iconbtn"
          :disabled="i === 0"
          :aria-label="t('effects.up')"
          @click="moveEffect(docs.session!, target!, fx.id, -1)"
        >
          <PtIcon name="chevUp" />
        </button>
        <button
          type="button"
          class="pt-iconbtn"
          :disabled="i === list.length - 1"
          :aria-label="t('effects.down')"
          @click="moveEffect(docs.session!, target!, fx.id, 1)"
        >
          <PtIcon name="chevDown" />
        </button>
        <button
          type="button"
          class="pt-iconbtn"
          :aria-label="t('effects.duplicate')"
          @click="duplicateEffect(docs.session!, target!, fx.id)"
        >
          <PtIcon name="plus" />
        </button>
        <button
          type="button"
          class="pt-iconbtn"
          :data-tip="t('effects.apply')"
          :aria-label="t('effects.apply')"
          @click="applyFx(fx)"
        >
          <PtIcon name="stamp" />
        </button>
        <button
          type="button"
          class="pt-iconbtn"
          :aria-label="t('effects.remove')"
          @click="removeEffect(docs.session!, target!, fx.id)"
        >
          <PtIcon name="trash" />
        </button>
      </header>

      <div v-for="d in defs(fx)" :key="d.key" class="row">
        <label>{{ label(d.key) }}</label>
        <template v-if="d.kind === 'int' || d.kind === 'float'">
          <input
            type="range"
            :min="d.min"
            :max="d.max"
            :step="d.kind === 'int' ? 1 : (d.step ?? 0.5)"
            :value="fx.params[d.key]"
            @input="onNum(fx, d, $event)"
            @change="commit(fx, d.key)"
          />
          <input
            type="number"
            class="pt-input w"
            :min="d.min"
            :max="d.max"
            :step="d.kind === 'int' ? 1 : (d.step ?? 0.5)"
            :value="fx.params[d.key]"
            @input="onNum(fx, d, $event)"
            @change="commit(fx, d.key)"
          />
        </template>
        <ColorButton
          v-else-if="d.kind === 'color'"
          :color="String(fx.params[d.key])"
          @pick="(h) => live(fx, d.key, h.slice(0, 7).toLowerCase())"
          @end="commit(fx, d.key)"
        />
        <input
          v-else-if="d.kind === 'bool'"
          type="checkbox"
          :checked="!!fx.params[d.key]"
          @change="setNow(fx, { params: { [d.key]: ($event.target as HTMLInputElement).checked } })"
        />
        <select
          v-else-if="d.kind === 'enum'"
          class="pt-select"
          :value="fx.params[d.key]"
          @change="setNow(fx, { params: { [d.key]: ($event.target as HTMLSelectElement).value } })"
        >
          <option v-for="o in d.options" :key="o" :value="o">{{ optionName(o) }}</option>
        </select>
      </div>

      <details class="out">
        <summary>{{ t('effects.output') }}</summary>
        <div class="row">
          <label>{{ t('effects.outAlpha') }}</label>
          <select
            class="pt-select"
            :value="outAlpha(fx)"
            @change="setOutput(fx, ($event.target as HTMLSelectElement).value)"
          >
            <option value="keep">{{ t('effects.keep') }}</option>
            <option value="threshold">{{ t('effects.threshold') }}</option>
            <option value="dither">{{ t('effects.dither') }}</option>
          </select>
        </div>
        <div v-if="outAlpha(fx) === 'threshold'" class="row">
          <label>{{ t('effects.thresholdValue') }}</label>
          <input
            type="number"
            class="pt-input w"
            min="0"
            max="255"
            :value="fx.output?.threshold ?? 128"
            @change="setThreshold(fx, $event)"
          />
        </div>
        <div class="row">
          <label>{{ t('effects.palette') }}</label>
          <select
            class="pt-select"
            :value="fx.output?.quantizeToPalette ?? ''"
            @change="setPalette(fx, $event)"
          >
            <option value="">{{ t('effects.paletteNone') }}</option>
            <option v-for="p in palettes" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
      </details>
    </section>
  </div>
</template>

<style scoped>
.fx {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--panel-pad-x);
  overflow-y: auto;
}
.who {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--text-secondary);
}
.card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.card.off {
  opacity: 0.55;
}
header {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fs-sm);
}
.row label {
  width: 96px;
  flex: none;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row input[type='range'] {
  flex: 1;
  min-width: 0;
}
.w {
  width: 52px;
}
.out summary {
  font-size: var(--fs-sm);
  color: var(--text-secondary);
}
.presets {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}
.presets .pt-input {
  flex: 1;
  min-width: 60px;
}
.none {
  padding: var(--space-2) 0;
}
</style>
