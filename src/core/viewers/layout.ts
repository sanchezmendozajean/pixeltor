// Disposición de visores (specs/09): árbol binario de divisiones con hasta 4 visores.
// Lógica pura y sin DOM; la UI sólo la dibuja.

/** `v` = divisor vertical (visores lado a lado); `h` = divisor horizontal (uno encima de otro). */
export type SplitDir = 'v' | 'h'

export type LayoutNode =
  | { kind: 'leaf'; viewer: string }
  | { kind: 'split'; dir: SplitDir; ratio: number; a: LayoutNode; b: LayoutNode }

export const MAX_VIEWERS = 4
export const MIN_RATIO = 0.1

export type LayoutPreset = 'single' | '2v' | '2h' | '1+2' | '2x2'

export const PRESET_COUNT: Record<LayoutPreset, number> = {
  single: 1,
  '2v': 2,
  '2h': 2,
  '1+2': 3,
  '2x2': 4
}

export const leaf = (viewer: string): LayoutNode => ({ kind: 'leaf', viewer })

const split = (dir: SplitDir, a: LayoutNode, b: LayoutNode, ratio = 0.5): LayoutNode => ({
  kind: 'split',
  dir,
  ratio,
  a,
  b
})

/** Visores del árbol en orden de lectura. */
export function leaves(n: LayoutNode): string[] {
  return n.kind === 'leaf' ? [n.viewer] : [...leaves(n.a), ...leaves(n.b)]
}

/** Divide el visor `id`: el nuevo queda después (a la derecha o abajo). null si no cabe. */
export function splitLeaf(
  root: LayoutNode,
  id: string,
  dir: SplitDir,
  newId: string
): LayoutNode | null {
  if (leaves(root).length >= MAX_VIEWERS) return null
  const go = (n: LayoutNode): LayoutNode => {
    if (n.kind === 'leaf') return n.viewer === id ? split(dir, n, leaf(newId)) : n
    return { ...n, a: go(n.a), b: go(n.b) }
  }
  if (!leaves(root).includes(id)) return null
  return go(root)
}

/** Quita el visor `id`; su hermano ocupa el sitio. null si es el único. */
export function removeLeaf(root: LayoutNode, id: string): LayoutNode | null {
  if (root.kind === 'leaf') return null
  const go = (n: LayoutNode): LayoutNode => {
    if (n.kind === 'leaf') return n
    if (n.a.kind === 'leaf' && n.a.viewer === id) return n.b
    if (n.b.kind === 'leaf' && n.b.viewer === id) return n.a
    return { ...n, a: go(n.a), b: go(n.b) }
  }
  return leaves(root).includes(id) ? go(root) : null
}

/** Árbol del preset con los identificadores dados (hacen falta `PRESET_COUNT[preset]`). */
export function presetLayout(preset: LayoutPreset, ids: string[]): LayoutNode {
  const n = PRESET_COUNT[preset]
  if (ids.length < n) throw new Error('Faltan visores para la disposición.')
  const l = ids.map(leaf)
  switch (preset) {
    case 'single':
      return l[0]!
    case '2v':
      return split('v', l[0]!, l[1]!)
    case '2h':
      return split('h', l[0]!, l[1]!)
    case '1+2':
      return split('v', l[0]!, split('h', l[1]!, l[2]!), 0.6)
    case '2x2':
      return split('h', split('v', l[0]!, l[1]!), split('v', l[2]!, l[3]!))
  }
}

export const clampRatio = (r: number): number => Math.min(1 - MIN_RATIO, Math.max(MIN_RATIO, r))

/** Iguala todos los divisores (doble clic en un separador). */
export function equalize(n: LayoutNode): LayoutNode {
  return n.kind === 'leaf' ? n : { ...n, ratio: 0.5, a: equalize(n.a), b: equalize(n.b) }
}

/** Copia profunda: la disposición se guarda en el documento sin compartir nodos. */
export function cloneLayout(n: LayoutNode): LayoutNode {
  return n.kind === 'leaf'
    ? { kind: 'leaf', viewer: n.viewer }
    : { kind: 'split', dir: n.dir, ratio: n.ratio, a: cloneLayout(n.a), b: cloneLayout(n.b) }
}

// ---------- Persistencia ----------

const TILE_MODES = ['none', 'both', 'h', 'v']

/** Ajustes de un visor que se guardan en el documento (no el zoom ni el desplazamiento). */
export interface SavedViewer {
  id: string
  imageId?: string
  pixelGrid?: boolean
  showPaths?: boolean
  onion?: boolean
  tiled?: 'none' | 'both' | 'h' | 'v'
  sync?: boolean
  /** Zoom (px de pantalla por px de imagen). */
  zoom?: number
  /** Punto de la imagen que estaba en el centro del visor (independiente del tamaño del visor). */
  centerX?: number
  centerY?: number
  /** Zoom y centro recordados de cada imagen del archivo (clave = id de imagen). */
  views?: Record<string, SavedView>
}

export interface SavedView {
  zoom: number
  centerX: number
  centerY: number
}

const MAX_SAVED_VIEWS = 256

/** Valida una vista guardada (zoom acotado, números finitos) o devuelve undefined. */
function sanitizeView(raw: unknown): SavedView | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const v = raw as Record<string, unknown>
  const { zoom, centerX, centerY } = v
  if (
    typeof zoom !== 'number' ||
    typeof centerX !== 'number' ||
    typeof centerY !== 'number' ||
    !Number.isFinite(zoom) ||
    !Number.isFinite(centerX) ||
    !Number.isFinite(centerY)
  )
    return undefined
  return { zoom: Math.min(64, Math.max(0.25, zoom)), centerX, centerY }
}

export interface SavedViewers {
  layout: LayoutNode
  viewers: SavedViewer[]
  active?: string
}

function sanitizeNode(raw: unknown, depth: number, seen: Set<string>): LayoutNode | null {
  if (!raw || typeof raw !== 'object' || depth > 4) return null
  const n = raw as Record<string, unknown>
  if (n['kind'] === 'leaf') {
    const id = n['viewer']
    if (typeof id !== 'string' || !id || id.length > 32 || seen.has(id)) return null
    seen.add(id)
    return leaf(id)
  }
  if (n['kind'] !== 'split' || (n['dir'] !== 'v' && n['dir'] !== 'h')) return null
  const a = sanitizeNode(n['a'], depth + 1, seen)
  const b = sanitizeNode(n['b'], depth + 1, seen)
  if (!a || !b) return null
  const ratio = typeof n['ratio'] === 'number' && Number.isFinite(n['ratio']) ? n['ratio'] : 0.5
  return { kind: 'split', dir: n['dir'], ratio: clampRatio(ratio), a, b }
}

/** Valida lo leído de un archivo: devuelve undefined si no es una disposición utilizable. */
export function sanitizeViewers(raw: unknown): SavedViewers | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const seen = new Set<string>()
  const layout = sanitizeNode(r['layout'], 0, seen)
  if (!layout || seen.size > MAX_VIEWERS) return undefined
  const byId = new Map<string, SavedViewer>()
  if (Array.isArray(r['viewers']))
    for (const v of r['viewers'] as Record<string, unknown>[]) {
      if (!v || typeof v['id'] !== 'string' || !seen.has(v['id'])) continue
      const out: SavedViewer = { id: v['id'] }
      if (typeof v['imageId'] === 'string') out.imageId = v['imageId']
      for (const k of ['pixelGrid', 'showPaths', 'onion', 'sync'] as const)
        if (typeof v[k] === 'boolean') out[k] = v[k]
      const num = (k: string): number | undefined =>
        typeof v[k] === 'number' && Number.isFinite(v[k]) ? (v[k] as number) : undefined
      const zoom = num('zoom')
      const cx = num('centerX')
      const cy = num('centerY')
      if (zoom !== undefined && cx !== undefined && cy !== undefined) {
        out.zoom = Math.min(64, Math.max(0.25, zoom))
        out.centerX = cx
        out.centerY = cy
      }
      const rawViews = v['views']
      if (rawViews && typeof rawViews === 'object') {
        const views: Record<string, SavedView> = {}
        for (const [id, rv] of Object.entries(rawViews as Record<string, unknown>).slice(
          0,
          MAX_SAVED_VIEWS
        )) {
          const sv = id.length <= 64 ? sanitizeView(rv) : undefined
          if (sv) views[id] = sv
        }
        if (Object.keys(views).length) out.views = views
      }
      if (typeof v['tiled'] === 'string' && TILE_MODES.includes(v['tiled']))
        out.tiled = v['tiled'] as SavedViewer['tiled']
      byId.set(out.id, out)
    }
  // todo visor del árbol tiene ajustes (por defecto si faltan)
  const viewers = [...seen].map((id) => byId.get(id) ?? { id })
  const active = typeof r['active'] === 'string' && seen.has(r['active']) ? r['active'] : undefined
  return { layout, viewers, active }
}
