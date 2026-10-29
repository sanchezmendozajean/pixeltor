// Worker de efectos: aplica una cadena de efectos a una región y devuelve los bytes de salida.
/// <reference lib="webworker" />
import { applyEffects, type FxJob } from '@core/index'

interface Request {
  id: number
  job: FxJob
}

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, job } = e.data
  try {
    const res = applyEffects(job.effects, job.input, job.out, job.ctx)
    const data = new Uint8ClampedArray(res.data)
    ;(self as unknown as Worker).postMessage({ id, data }, [data.buffer])
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: String(err) })
  }
}
