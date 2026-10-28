<script setup lang="ts">
// Tooltips globales por delegación: `data-action="id"` (nombre + atajo del registro) o `data-tip="texto"`.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { actionLabel, actionShortcut } from '@/actions/registry'

const DELAY_MS = 500
/** Tras ocultar un tooltip, el siguiente aparece al instante si llega antes de este plazo. */
const GRACE_MS = 300

const text = ref('')
const kbd = ref('')
const visible = ref(false)
const pos = ref({ left: 0, top: 0 })
const el = ref<HTMLElement | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
let hiddenAt = 0
let current: Element | null = null

function describe(target: Element): { text: string; kbd: string } | null {
  const id = target.getAttribute('data-action')
  if (id) return { text: actionLabel(id), kbd: actionShortcut(id) ?? '' }
  const tip = target.getAttribute('data-tip')
  return tip ? { text: tip, kbd: '' } : null
}

function show(target: Element): void {
  const d = describe(target)
  if (!d) return
  text.value = d.text
  kbd.value = d.kbd
  visible.value = true
  requestAnimationFrame(() => {
    const r = target.getBoundingClientRect()
    const w = el.value?.offsetWidth ?? 0
    const left = Math.max(4, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 4))
    pos.value = { left, top: r.bottom + 6 }
  })
}

function hide(): void {
  clearTimeout(timer)
  if (visible.value) hiddenAt = performance.now()
  visible.value = false
  current = null
}

function onOver(e: PointerEvent): void {
  const target = (e.target as Element | null)?.closest('[data-action],[data-tip]') ?? null
  if (target === current) return
  hide()
  if (!target) return
  current = target
  const instant = performance.now() - hiddenAt < GRACE_MS
  timer = setTimeout(() => show(target), instant ? 0 : DELAY_MS)
}

onMounted(() => {
  document.addEventListener('pointerover', onOver)
  document.addEventListener('pointerdown', hide, true)
  window.addEventListener('blur', hide)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerover', onOver)
  document.removeEventListener('pointerdown', hide, true)
  window.removeEventListener('blur', hide)
  clearTimeout(timer)
})
</script>

<template>
  <div
    v-show="visible"
    ref="el"
    class="pt-tip tip-host"
    role="tooltip"
    :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
  >
    {{ text }}<span v-if="kbd">{{ kbd }}</span>
  </div>
</template>

<style scoped>
.tip-host {
  position: fixed;
  z-index: 100;
  pointer-events: none;
}
</style>
