// Conversión entre los colores `#RRGGBB[AA]` de la UI y el entero 0xRRGGBBAA del core.

export function hexToRgba(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const r = Number.parseInt(full.slice(0, 2), 16) || 0
  const g = Number.parseInt(full.slice(2, 4), 16) || 0
  const b = Number.parseInt(full.slice(4, 6), 16) || 0
  const a = full.length >= 8 ? Number.parseInt(full.slice(6, 8), 16) : 255
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0
}

export function rgbaToHex(c: number): string {
  const p = (n: number) => n.toString(16).padStart(2, '0')
  const hex = `#${p((c >>> 24) & 255)}${p((c >>> 16) & 255)}${p((c >>> 8) & 255)}`.toUpperCase()
  return (c & 255) === 255 ? hex : `${hex}${p(c & 255).toUpperCase()}`
}

export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  const to = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`.toUpperCase()
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const c = hexToRgba(hex)
  const r = ((c >>> 24) & 255) / 255
  const g = ((c >>> 16) & 255) / 255
  const b = ((c >>> 8) & 255) / 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  return { h: h * 60, s: max ? d / max : 0, v: max }
}
