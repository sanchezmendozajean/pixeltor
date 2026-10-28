// Reglas del visor: marcas y etiquetas en píxeles de imagen, con el color de los tokens del tema.

import type { Viewport } from './Viewport'

export const RULER = 16

const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]

/** Intervalo (px de imagen) entre marcas principales: al menos ~48 px de pantalla. */
export function rulerStep(zoom: number): number {
  return STEPS.find((s) => s * zoom >= 48) ?? STEPS[STEPS.length - 1]!
}

interface Colors {
  bg: string
  tick: string
  text: string
  edge: string
}

export function rulerColors(): Colors {
  const cs = getComputedStyle(document.documentElement)
  const get = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb
  return {
    bg: get('--bg-panel', '#2a2a2a'),
    tick: get('--text-secondary', '#9a9a9a'),
    text: get('--text-secondary', '#9a9a9a'),
    edge: get('--border', '#444')
  }
}

/** Dibuja la regla horizontal (`axis` 'h') o vertical ('v') en un canvas ya dimensionado. */
export function drawRuler(
  canvas: HTMLCanvasElement,
  vp: Viewport,
  axis: 'h' | 'v',
  colors: Colors,
  dpr: number
): void {
  const ctx = canvas.getContext('2d')!
  const len = axis === 'h' ? vp.width : vp.height
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, axis === 'h' ? len : RULER, axis === 'h' ? RULER : len)
  ctx.strokeStyle = colors.edge
  ctx.beginPath()
  if (axis === 'h') {
    ctx.moveTo(0, RULER - 0.5)
    ctx.lineTo(len, RULER - 0.5)
  } else {
    ctx.moveTo(RULER - 0.5, 0)
    ctx.lineTo(RULER - 0.5, len)
  }
  ctx.stroke()

  const step = rulerStep(vp.zoom)
  const origin = axis === 'h' ? vp.panX : vp.panY
  const size = axis === 'h' ? vp.imageW : vp.imageH
  ctx.strokeStyle = colors.tick
  ctx.fillStyle = colors.text
  ctx.font = '9px "JetBrains Mono", monospace'
  ctx.textBaseline = 'top'
  const first = Math.ceil(-origin / vp.zoom / step) * step
  const last = Math.floor((len - origin) / vp.zoom / step) * step
  for (let v = first; v <= last; v += step) {
    if (v < 0 || v > size) continue
    const pos = Math.round(origin + v * vp.zoom) + 0.5
    ctx.beginPath()
    if (axis === 'h') {
      ctx.moveTo(pos, RULER - 7)
      ctx.lineTo(pos, RULER)
    } else {
      ctx.moveTo(RULER - 7, pos)
      ctx.lineTo(RULER, pos)
    }
    ctx.stroke()
    if (axis === 'h') ctx.fillText(String(v), pos + 2, 1)
    else {
      ctx.save()
      ctx.translate(1, pos - 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(String(v), 0, 0)
      ctx.restore()
    }
  }
}
