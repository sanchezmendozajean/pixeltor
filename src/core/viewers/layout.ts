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
