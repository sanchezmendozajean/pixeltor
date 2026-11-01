<script setup lang="ts">
// Nodo del árbol de visores (specs/09): una hoja es un visor; una división reparte el espacio
// entre dos nodos con un separador arrastrable (doble clic: iguala; arrastrar al borde: cierra).
import { ref } from 'vue'
import { type LayoutNode, clampRatio } from '@core/index'
import type { Workspace } from '@/session/workspace'
import ViewerPane from './ViewerPane.vue'

const props = defineProps<{ node: LayoutNode; ws: Workspace; tick: number }>()

const box = ref<HTMLElement>()
const hover = ref(false)

function style(): Record<string, string> {
  void props.tick
  const n = props.node
  return n.kind === 'split' ? { flexDirection: n.dir === 'v' ? 'row' : 'column' } : {}
}
const grow = (side: 'a' | 'b'): Record<string, string> => {
  void props.tick
  const n = props.node
  if (n.kind !== 'split') return {}
  return { flex: `${side === 'a' ? n.ratio : 1 - n.ratio} 1 0`, minWidth: '0', minHeight: '0' }
}

function onSplitterDown(e: PointerEvent): void {
  const n = props.node
  if (n.kind !== 'split' || !box.value) return
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const r = box.value.getBoundingClientRect()
  let raw = n.ratio
  el.onpointermove = (ev) => {
    raw = n.dir === 'v' ? (ev.clientX - r.left) / r.width : (ev.clientY - r.top) / r.height
    n.ratio = clampRatio(raw)
    props.ws.touchLayout()
  }
  el.onpointerup = () => {
    el.onpointermove = null
    el.onpointerup = null
    // arrastrar hasta el borde colapsa el visor de ese lado (si es un visor, no otra división)
    if (raw < 0.04 && n.a.kind === 'leaf') props.ws.closeViewer(n.a.viewer)
    else if (raw > 0.96 && n.b.kind === 'leaf') props.ws.closeViewer(n.b.viewer)
  }
}

function onSplitterDouble(): void {
  props.ws.equalizeLayout()
}
</script>

<template>
  <ViewerPane
    v-if="node.kind === 'leaf' && ws.viewer(node.viewer)"
    :key="node.viewer"
    :ws="ws"
    :viewer="ws.viewer(node.viewer)!"
    class="node"
  />
  <div v-else-if="node.kind === 'split'" ref="box" class="split node" :style="style()">
    <div class="side" :style="grow('a')">
      <ViewerNode :node="node.a" :ws="ws" :tick="tick" />
    </div>
    <div
      class="pt-splitter"
      :class="{ 'is-hover': hover, 'pt-splitter--h': node.dir === 'h' }"
      role="separator"
      :aria-orientation="node.dir === 'v' ? 'vertical' : 'horizontal'"
      @pointerenter="hover = true"
      @pointerleave="hover = false"
      @pointerdown.prevent="onSplitterDown"
      @dblclick="onSplitterDouble"
    />
    <div class="side" :style="grow('b')">
      <ViewerNode :node="node.b" :ws="ws" :tick="tick" />
    </div>
  </div>
</template>

<style scoped>
.node {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.split {
  display: flex;
}
.side {
  display: flex;
  min-width: 0;
  min-height: 0;
}
</style>
