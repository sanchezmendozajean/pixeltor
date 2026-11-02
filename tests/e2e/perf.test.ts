import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Mediciones en la aplicación real (specs/03 · Rendimiento). Los límites son holgados para no
// fallar por el equipo o la carga; lo importante es el informe que se imprime.

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const env = { ...process.env } as Record<string, string>
  delete env['ELECTRON_RUN_AS_NODE']
  app = await electron.launch({
    env,
    args: ['.', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pixeltor-e2e-'))}`]
  })
  page = await app.firstWindow()
  await page.waitForSelector('.pt-stage canvas')
  await page.keyboard.press('Control+n')
  await page.locator('#nw').fill('1000')
  await page.locator('#nh').fill('1000')
  await page.getByRole('button', { name: 'Crear' }).click()
  await page.waitForTimeout(300)
})

test.afterAll(async () => {
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
})

interface Stats {
  frames: number
  mean: number
  p95: number
  max: number
}

type Probe = { __frames?: number[]; __stop?: boolean }

async function startProbe(): Promise<void> {
  await page.evaluate(() => {
    const w = globalThis as unknown as Probe & {
      requestAnimationFrame(cb: (t: number) => void): void
      performance: { now(): number }
    }
    w.__frames = []
    w.__stop = false
    let last = w.performance.now()
    const loop = (t: number): void => {
      w.__frames!.push(t - last)
      last = t
      if (!w.__stop) w.requestAnimationFrame(loop)
    }
    w.requestAnimationFrame(loop)
  })
}

async function stopProbe(): Promise<Stats> {
  const f = await page.evaluate(() => {
    const w = globalThis as unknown as Probe
    w.__stop = true
    return w.__frames!.slice(2)
  })
  const sorted = [...f].sort((a, b) => a - b)
  return {
    frames: f.length,
    mean: f.reduce((a, b) => a + b, 0) / Math.max(1, f.length),
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    max: sorted[sorted.length - 1] ?? 0
  }
}

async function stroke(box: { x: number; y: number; width: number; height: number }) {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx - 200, cy - 100)
  await page.mouse.down()
  for (let i = 0; i < 120; i++)
    await page.mouse.move(cx - 200 + i * 3.5, cy - 100 + Math.sin(i / 8) * 80)
  await page.mouse.up()
}

const fmt = (s: Stats): string =>
  `${s.frames} fotogramas · media ${s.mean.toFixed(1)} ms · p95 ${s.p95.toFixed(1)} ms · máx ${s.max.toFixed(1)} ms`

test('trazo de pincel en 1000×1000 con 20 capas', async () => {
  for (let i = 0; i < 19; i++) await page.keyboard.press('Control+Shift+n')
  await page.locator('.pt-ptab', { hasText: 'Capas' }).click()
  await page.keyboard.press('b')
  const box = (await page.locator('.pt-stage').boundingBox())!
  await startProbe()
  await stroke(box)
  const s = await stopProbe()
  console.log(`[perf] pincel 1000×1000, 20 capas: ${fmt(s)}`)
  expect(s.p95).toBeLessThan(100)
  // el trazo se registró de verdad (no se midió un gesto vacío)
  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  await expect(page.getByRole('button', { name: 'Trazo de pincel' })).toBeVisible()
})

test('el mismo trazo con 4 visores abiertos', async () => {
  await page.keyboard.press('Control+Alt+v')
  await page.keyboard.press('Control+Alt+h')
  await page.keyboard.press('Control+Alt+h')
  await expect(page.locator('.pt-viewport')).toHaveCount(4)
  const box = (await page.locator('.pt-viewport .pt-stage').first().boundingBox())!
  await startProbe()
  await stroke(box)
  const s = await stopProbe()
  console.log(`[perf] pincel con 4 visores: ${fmt(s)}`)
  expect(s.p95).toBeLessThan(150)
  await page.keyboard.press('Control+Z')
})

test('desenfoque gaussiano de una forma grande: tiempo hasta el primer resultado', async () => {
  // un solo visor para medir sólo el cálculo del efecto
  await page.getByRole('button', { name: 'Ventana' }).click()
  await page.getByRole('menuitem', { name: 'Disposición de visores' }).hover()
  await page.getByRole('menuitem', { name: 'Disposición: un visor' }).click()
  const box = (await page.locator('.pt-stage').boundingBox())!
  await page.keyboard.press('m')
  await page.mouse.move(box.x + 100, box.y + 100)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 100, box.y + box.height - 100, { steps: 4 })
  await page.mouse.up()

  await page.keyboard.press('Control+k')
  await page
    .getByRole('dialog', { name: 'Paleta de comandos' })
    .locator('input')
    .fill('desenfoque gaussiano')
  const t0 = Date.now()
  await page.keyboard.press('Enter')
  await expect(page.locator('.fx .card')).toHaveCount(1)
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 15_000 })
  const ms = Date.now() - t0
  console.log(`[perf] gaussiano (añadir y calcular, incluye la UI): ${ms} ms`)
  expect(ms).toBeLessThan(5000)
})

test('scrubbing del radio del gaussiano: tiempo de cada resultado', async () => {
  const range = page.locator('.fx .card input[type="range"]').first()
  await expect(range).toBeVisible()
  const max = Number(await range.getAttribute('max'))
  const min = Number(await range.getAttribute('min'))
  const times = await range.evaluate(
    async (el, [lo, hi]) => {
      const input = el as { value: string; dispatchEvent(e: unknown): void }
      const g = globalThis as unknown as {
        Event: new (t: string, o?: unknown) => unknown
        document: { querySelector(s: string): unknown }
        performance: { now(): number }
        requestAnimationFrame(cb: () => void): void
      }
      const frame = () => new Promise<void>((r) => g.requestAnimationFrame(() => r()))
      const out: number[] = []
      for (let i = 0; i < 10; i++) {
        const v = Math.round(lo! + ((hi! - lo!) * (i + 1)) / 11)
        const t0 = g.performance.now()
        input.value = String(v)
        input.dispatchEvent(new g.Event('input', { bubbles: true }))
        // el indicador «Calculando…» aparece y desaparece al llegar el resultado
        let seen = false
        for (let n = 0; n < 400; n++) {
          await frame()
          const busy = !!g.document.querySelector('[role="status"]')
          if (busy) seen = true
          else if (seen || n > 3) break
        }
        out.push(g.performance.now() - t0)
      }
      return out
    },
    [min, max]
  )
  const sorted = [...times].sort((a, b) => a - b)
  console.log(
    `[perf] scrubbing gaussiano: mediana ${sorted[5]!.toFixed(0)} ms · p90 ${sorted[8]!.toFixed(0)} ms · máx ${sorted[9]!.toFixed(0)} ms (${times.map((t) => t.toFixed(0)).join(', ')})`
  )
  expect(sorted[9]!).toBeLessThan(3000)
})
