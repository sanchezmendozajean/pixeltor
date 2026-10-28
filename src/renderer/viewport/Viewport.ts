// Estado de un visor: zoom y desplazamiento. Es independiente del render para que
// F6 pueda tener varios visores sobre el mismo documento (specs/09).

export const ZOOM_STEPS = [0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64] as const

const MIN_ZOOM = 0.25
const MAX_ZOOM = 64

export class Viewport {
  /** Píxeles de pantalla por píxel de imagen. */
  zoom = 1
  /** Posición en pantalla (px CSS del visor) de la esquina superior izquierda de la imagen. */
  panX = 0
  panY = 0
  width = 1
  height = 1

  constructor(
    public imageW: number,
    public imageH: number
  ) {}

  resize(w: number, h: number): void {
    this.width = Math.max(1, w)
    this.height = Math.max(1, h)
  }

  toImage(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom }
  }

  toScreen(ix: number, iy: number): { x: number; y: number } {
    return { x: ix * this.zoom + this.panX, y: iy * this.zoom + this.panY }
  }

  /** Con zoom ≥ 1 el desplazamiento se ajusta a píxeles enteros de pantalla (specs/03). */
  private snap(): void {
    if (this.zoom >= 1) {
      this.panX = Math.round(this.panX)
      this.panY = Math.round(this.panY)
    }
  }

  centre(): void {
    this.panX = (this.width - this.imageW * this.zoom) / 2
    this.panY = (this.height - this.imageH * this.zoom) / 2
    this.snap()
  }

  /** Zoom que encaja la imagen con un margen; entero si el zoom resultante es ≥ 1. */
  fit(margin = 32): void {
    const raw = Math.min(
      (this.width - margin * 2) / this.imageW,
      (this.height - margin * 2) / this.imageH
    )
    this.zoom = raw >= 1 ? Math.floor(raw) : Math.max(MIN_ZOOM, raw)
    this.centre()
  }

  setZoom(z: number, anchorX = this.width / 2, anchorY = this.height / 2): void {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
    const before = this.toImage(anchorX, anchorY)
    this.zoom = clamped
    this.panX = anchorX - before.x * clamped
    this.panY = anchorY - before.y * clamped
    this.snap()
  }

  /** Siguiente nivel preferente por encima (dir = 1) o por debajo (dir = -1). */
  stepZoom(dir: 1 | -1, anchorX = this.width / 2, anchorY = this.height / 2): void {
    const cur = this.zoom
    const next =
      dir > 0
        ? (ZOOM_STEPS.find((z) => z > cur + 1e-9) ?? cur)
        : ([...ZOOM_STEPS].reverse().find((z) => z < cur - 1e-9) ?? cur)
    this.setZoom(next, anchorX, anchorY)
  }

  panBy(dx: number, dy: number): void {
    this.panX += dx
    this.panY += dy
    this.snap()
  }

  get zoomPercent(): number {
    return Math.round(this.zoom * 100)
  }
}
