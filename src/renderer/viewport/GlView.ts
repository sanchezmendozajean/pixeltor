// Render WebGL2 de un visor: tablero de transparencia, imagen con filtro NEAREST y cuadrícula
// de píxeles. Solo muestra; la composición es de CPU (specs/03).

import type { Bitmap, Rect } from '@core/index'
import type { Viewport } from './Viewport'

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_size;      // tamaño de la imagen (px)
uniform vec2 u_pan;       // origen de la imagen en px de dispositivo
uniform float u_zoom;     // px de dispositivo por px de imagen
uniform vec2 u_view;      // alto/ancho del canvas
uniform vec4 u_bg;
uniform vec4 u_checkA;
uniform vec4 u_checkB;
uniform float u_checkSize;
uniform float u_grid;     // 0/1
uniform vec4 u_gridColor;
out vec4 outColor;
void main() {
  vec2 p = vec2(gl_FragCoord.x, u_view.y - gl_FragCoord.y);
  vec2 rel = p - u_pan;
  vec2 img = rel / u_zoom;
  if (img.x < 0.0 || img.y < 0.0 || img.x >= u_size.x || img.y >= u_size.y) {
    outColor = u_bg;
    return;
  }
  vec2 cell = floor(rel / u_checkSize);
  vec4 base = mod(cell.x + cell.y, 2.0) < 1.0 ? u_checkA : u_checkB;
  vec4 px = texelFetch(u_tex, ivec2(floor(img)), 0);
  vec3 col = mix(base.rgb, px.rgb, px.a);
  if (u_grid > 0.5) {
    vec2 f = mod(rel, u_zoom);
    if (f.x < 1.0 || f.y < 1.0) col = mix(col, u_gridColor.rgb, u_gridColor.a);
  }
  outColor = vec4(col, 1.0);
}`

export interface ViewColors {
  bg: string
  checkerA: string
  checkerB: string
  grid: string
}

function parseCss(color: string): [number, number, number, number] {
  const c = document.createElement('canvas').getContext('2d')!
  c.fillStyle = '#000'
  c.fillStyle = color
  const v = c.fillStyle
  if (v.startsWith('#')) {
    const n = Number.parseInt(v.slice(1), 16)
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]
  }
  const m = /rgba?\(([^)]+)\)/.exec(v)
  const p = (m?.[1] ?? '0,0,0').split(',').map(Number.parseFloat)
  return [(p[0] ?? 0) / 255, (p[1] ?? 0) / 255, (p[2] ?? 0) / 255, p[3] ?? 1]
}

export class GlView {
  private gl: WebGL2RenderingContext
  private prog: WebGLProgram
  private tex: WebGLTexture
  private texW = 0
  private texH = 0
  private colors: Record<keyof ViewColors, [number, number, number, number]> = {
    bg: [0, 0, 0, 1],
    checkerA: [0.23, 0.23, 0.23, 1],
    checkerB: [0.18, 0.18, 0.18, 1],
    grid: [1, 1, 1, 0.2]
  }
  private uniforms = new Map<string, WebGLUniformLocation | null>()

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true
    })
    if (!gl) throw new Error('WebGL2 no disponible')
    this.gl = gl
    const compile = (type: number, src: string): WebGLShader => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    this.prog = gl.createProgram()!
    gl.attachShader(this.prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(this.prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(this.prog)
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(this.prog) ?? 'link')
    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(this.prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    this.tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  /** Lee los colores del tema vigente (tokens CSS, nunca valores fijos). */
  refreshColors(): void {
    const cs = getComputedStyle(document.documentElement)
    const get = (n: string) => cs.getPropertyValue(n).trim()
    this.colors = {
      bg: parseCss(get('--canvas-bg')),
      checkerA: parseCss(get('--checker-a')),
      checkerB: parseCss(get('--checker-b')),
      grid: parseCss(get('--pixel-grid'))
    }
  }

  /** Sube la imagen entera o solo la región sucia. */
  upload(bmp: Bitmap, rect?: Rect): void {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    if (bmp.width !== this.texW || bmp.height !== this.texH || !rect) {
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0)
      gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0)
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        bmp.width,
        bmp.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bmp.data
      )
      this.texW = bmp.width
      this.texH = bmp.height
      return
    }
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, bmp.width)
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, rect.x)
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, rect.y)
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      bmp.data
    )
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0)
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0)
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0)
  }

  private u(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name))
      this.uniforms.set(name, this.gl.getUniformLocation(this.prog, name))
    return this.uniforms.get(name) ?? null
  }

  draw(vp: Viewport, gridOn: boolean): void {
    const gl = this.gl
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(vp.width * dpr))
    const h = Math.max(1, Math.round(vp.height * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    gl.viewport(0, 0, w, h)
    gl.useProgram(this.prog)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.uniform1i(this.u('u_tex'), 0)
    gl.uniform2f(this.u('u_size'), vp.imageW, vp.imageH)
    gl.uniform2f(this.u('u_pan'), vp.panX * dpr, vp.panY * dpr)
    gl.uniform1f(this.u('u_zoom'), vp.zoom * dpr)
    gl.uniform2f(this.u('u_view'), w, h)
    gl.uniform4fv(this.u('u_bg'), this.colors.bg)
    gl.uniform4fv(this.u('u_checkA'), this.colors.checkerA)
    gl.uniform4fv(this.u('u_checkB'), this.colors.checkerB)
    gl.uniform1f(this.u('u_checkSize'), 8 * dpr)
    gl.uniform1f(this.u('u_grid'), gridOn && vp.zoom >= 8 ? 1 : 0)
    gl.uniform4fv(this.u('u_gridColor'), this.colors.grid)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}
