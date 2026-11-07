// Cálculo asíncrono de efectos para el visor (specs/03, «Workers»): los efectos costosos se
// ejecutan fuera del hilo principal. Mientras un resultado no está listo se muestra el último
// válido de esa ranura (sin parpadeo). El ejecutor concreto (pool de Workers) se inyecta, así
// que esta lógica es pura y se prueba en Node.

import type { Effect } from '../model/types'
import type { Rect } from '../raster/bitmap'
import { type Region, cropRegion, expandRect } from './region'
import { applyEffects, effectsInfluence } from './registry'
import type { EffectContext } from './types'

/** Trabajo para el ejecutor: aplicar `effects` a `input` y devolver los bytes de `out`. */
export interface FxJob {
  effects: Effect[]
  input: Region
  out: Rect
  ctx: EffectContext
}

export type FxExecutor = (job: FxJob) => Promise<Uint8ClampedArray>

/** Quien aplica efectos durante la composición (síncrono o asíncrono). */
export interface FxProvider {
  /** `slot` identifica de dónde sale el resultado (capa o forma) para conservar el último válido. */
  apply(
    slot: string,
    effects: readonly Effect[],
    input: Region,
    out: Rect,
    ctx: EffectContext
  ): Region
}

/** Proveedor síncrono (exportar, estampar, pruebas). */
export const syncFx: FxProvider = {
  apply: (_slot, effects, input, out, ctx) => applyEffects(effects, input, out, ctx)
}

/**
 * Firma de 64 bits (dos hashes de 32 con semillas distintas, estilo murmur3) del contenido.
 * Debe mezclar bien todos los bits: con FNV por palabras, píxeles que sólo difieren en el byte
 * alto (negro opaco vs. transparente) casi no cambiaban el hash y estados distintos colisionaban,
 * mostrando el resultado en caché de otra forma.
 */
function contentHash(d: Uint8ClampedArray): string {
  const rotl = (x: number, r: number): number => (x << r) | (x >>> (32 - r))
  let h1 = 0x9747b28c
  let h2 = 0x85ebca6b
  const mix = (h: number, w: number): number => {
    let k = Math.imul(w, 0xcc9e2d51)
    k = Math.imul(rotl(k, 15), 0x1b873593)
    h ^= k
    return (Math.imul(rotl(h, 13), 5) + 0xe6546b64) | 0
  }
  // de 4 en 4 bytes (4× menos vueltas) cuando el búfer está alineado
  if (d.byteOffset % 4 === 0 && d.length % 4 === 0) {
    const w = new Uint32Array(d.buffer, d.byteOffset, d.length >> 2)
    for (let i = 0; i < w.length; i++) {
      h1 = mix(h1, w[i]!)
      h2 = mix(h2, (w[i]! ^ i) >>> 0)
    }
  } else {
    for (let i = 0; i < d.length; i++) {
      h1 = mix(h1, d[i]!)
      h2 = mix(h2, d[i]! ^ i)
    }
  }
  const fin = (h: number): number => {
    h ^= d.length
    h ^= h >>> 16
    h = Math.imul(h, 0x85ebca6b)
    h ^= h >>> 13
    h = Math.imul(h, 0xc2b2ae35)
    return (h ^ (h >>> 16)) >>> 0
  }
  return `${fin(h1).toString(36)}${fin(h2).toString(36)}`
}

/** Áreas pequeñas se calculan en línea: más barato que ir y volver de un worker. */
const SYNC_AREA = 96 * 96

export class AsyncFxProvider implements FxProvider {
  private readonly cache = new Map<string, Region>()
  private readonly last = new Map<string, Region>()
  private readonly inflight = new Set<string>()
  private readonly queued = new Map<string, { key: string; job: FxJob }>()
  private pending = 0

  constructor(
    private readonly exec: FxExecutor,
    /** Se llama cuando hay un resultado nuevo: hay que recomponer. */
    private readonly onReady: () => void,
    private readonly onBusy: (busy: boolean) => void = () => {},
    private readonly maxEntries = 48
  ) {}

  get busy(): boolean {
    return this.pending > 0
  }

  apply(
    slot: string,
    effects: readonly Effect[],
    input: Region,
    out: Rect,
    ctx: EffectContext
  ): Region {
    const reach = effectsInfluence(effects, ctx)
    const need = expandRect(out, reach)
    if (need.w * need.h <= SYNC_AREA) return applyEffects(effects, input, out, ctx)

    // sólo viajan (y se firman) los píxeles que el cálculo puede leer
    const sub = cropRegion(input, need)
    const key = `${slot}|${JSON.stringify(effects)}|${out.x},${out.y},${out.w},${out.h}|${ctx.width}x${ctx.height}${ctx.draft ? '|draft' : ''}|${sub.rect.x},${sub.rect.y},${sub.rect.w}x${sub.rect.h}|${contentHash(sub.data)}`
    const hit = this.cache.get(key)
    if (hit) {
      this.cache.delete(key)
      this.cache.set(key, hit)
      this.last.set(slot, hit)
      return hit
    }
    this.schedule(slot, key, {
      effects: JSON.parse(JSON.stringify(effects)) as Effect[],
      input: sub,
      out: { ...out },
      ctx
    })
    const prev = this.last.get(slot)
    const same =
      prev &&
      prev.rect.x === out.x &&
      prev.rect.y === out.y &&
      prev.rect.w === out.w &&
      prev.rect.h === out.h
    return same ? prev : cropRegion(input, out)
  }

  private schedule(slot: string, key: string, job: FxJob): void {
    if (this.inflight.has(slot)) {
      // sólo interesa la petición más reciente de cada ranura
      this.queued.set(slot, { key, job })
      return
    }
    this.start(slot, key, job)
  }

  private start(slot: string, key: string, job: FxJob): void {
    this.inflight.add(slot)
    this.setPending(1)
    this.exec(job)
      .then((data) => {
        const res: Region = { rect: { ...job.out }, data }
        this.cache.set(key, res)
        while (this.cache.size > this.maxEntries) this.cache.delete(this.cache.keys().next().value!)
        this.last.set(slot, res)
      })
      .catch(() => {
        // un fallo del worker no debe reintentarse en bucle: se muestra la entrada sin efecto
        this.cache.set(key, cropRegion(job.input, job.out))
      })
      .finally(() => {
        this.inflight.delete(slot)
        this.setPending(-1)
        const next = this.queued.get(slot)
        if (next) {
          this.queued.delete(slot)
          this.start(slot, next.key, next.job)
        }
        this.onReady()
      })
  }

  private setPending(d: number): void {
    const was = this.pending > 0
    this.pending += d
    const now = this.pending > 0
    if (was !== now) this.onBusy(now)
  }

  clear(): void {
    this.cache.clear()
    this.last.clear()
    this.queued.clear()
  }
}
