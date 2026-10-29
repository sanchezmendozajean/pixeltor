// Cursores propios de las herramientas de trazados: dibujos SVG en línea (sin recursos externos).

export type CursorKind =
  'pen' | 'pen-plus' | 'pen-minus' | 'pen-convert' | 'direct' | 'direct-anchor' | 'direct-handle'

/** Flecha de selección directa: contorno negro con relleno blanco (hueca), como en Illustrator. */
const ARROW = '<path d="M4 2 L4 19 L8.5 15 L11.5 21.5 L14.5 20 L11.5 13.8 L17.5 13.8 Z"'

/** Pluma: plumín apuntando abajo-izquierda; la punta es el punto activo. */
const NIB =
  '<path d="M3 22 L6.5 11 L13 6 L19 12 L14 18.5 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>' +
  '<path d="M6.5 11 L12 16.5" stroke="#000" stroke-width="1.2"/>' +
  '<circle cx="11" cy="11" r="1.6" fill="#000"/>'

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">${body}</svg>`

const badge = (inner: string): string =>
  `<g transform="translate(16 15)"><rect x="0" y="0" width="9" height="9" rx="1" fill="#fff" stroke="#000"/>${inner}</g>`

const BODY: Record<CursorKind, { svg: string; x: number; y: number }> = {
  pen: { svg: svg(NIB), x: 3, y: 22 },
  'pen-plus': {
    svg: svg(NIB + badge('<path d="M2 4.5 H7 M4.5 2 V7" stroke="#000" stroke-width="1.4"/>')),
    x: 3,
    y: 22
  },
  'pen-minus': {
    svg: svg(NIB + badge('<path d="M2 4.5 H7" stroke="#000" stroke-width="1.4"/>')),
    x: 3,
    y: 22
  },
  'pen-convert': {
    svg: svg(
      NIB +
        badge('<path d="M1.5 6.5 L4.5 2.5 L7.5 6.5" fill="none" stroke="#000" stroke-width="1.3"/>')
    ),
    x: 3,
    y: 22
  },
  direct: {
    svg: svg(`${ARROW} fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>`),
    x: 4,
    y: 2
  },
  'direct-anchor': {
    svg: svg(
      `${ARROW} fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>` +
        '<rect x="17" y="17" width="6" height="6" fill="#000"/>'
    ),
    x: 4,
    y: 2
  },
  'direct-handle': {
    svg: svg(
      `${ARROW} fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>` +
        '<circle cx="20" cy="20" r="3.2" fill="#000"/>'
    ),
    x: 4,
    y: 2
  }
}

/** Valor CSS de `cursor` para el tipo indicado. */
export function cursorCss(kind: CursorKind): string {
  const c = BODY[kind]
  const fallback = kind.startsWith('pen') ? 'crosshair' : 'default'
  return `url("data:image/svg+xml,${encodeURIComponent(c.svg)}") ${c.x} ${c.y}, ${fallback}`
}
