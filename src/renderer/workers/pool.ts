// Pool de workers de efectos: min(hardwareConcurrency − 1, 4) hilos, mínimo 1 (specs/03).

import type { FxExecutor, FxJob } from '@core/index'

interface Pending {
  job: FxJob
  resolve: (d: Uint8ClampedArray) => void
  reject: (e: Error) => void
}

class FxPool {
  private workers: Worker[] = []
  private idle: Worker[] = []
  private queue: Pending[] = []
  private running = new Map<Worker, { id: number; p: Pending }>()
  private nextId = 1

  private ensure(): void {
    if (this.workers.length) return
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1))
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./fx.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<{ id: number; data?: Uint8ClampedArray; error?: string }>) => {
        const run = this.running.get(w)
        if (!run || run.id !== e.data.id) return
        this.running.delete(w)
        this.idle.push(w)
        if (e.data.data) run.p.resolve(e.data.data)
        else run.p.reject(new Error(e.data.error ?? 'fallo del worker'))
        this.pump()
      }
      w.onerror = () => {
        const run = this.running.get(w)
        this.running.delete(w)
        this.idle.push(w)
        run?.p.reject(new Error('fallo del worker'))
        this.pump()
      }
      this.workers.push(w)
      this.idle.push(w)
    }
  }

  private pump(): void {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!
      const p = this.queue.shift()!
      const id = this.nextId++
      this.running.set(w, { id, p })
      // la entrada se copia al worker: el documento no se bloquea ni se comparte
      w.postMessage({ id, job: p.job })
    }
  }

  readonly exec: FxExecutor = (job) =>
    new Promise((resolve, reject) => {
      this.ensure()
      this.queue.push({ job, resolve, reject })
      this.pump()
    })
}

let pool: FxPool | null = null

/** Ejecutor compartido por todos los documentos. */
export function fxExecutor(): FxExecutor {
  pool ??= new FxPool()
  return pool.exec
}
