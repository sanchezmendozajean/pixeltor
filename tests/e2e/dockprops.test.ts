import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DocumentSession,
  addShape,
  makeAppearance,
  makeRect,
  color,
  saveDocument
} from '../../src/core/index'

test('el dock se redimensiona y los campos de caja aceptan operaciones', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixeltor-e2e-'))
  const s = DocumentSession.create(64, 64, 'caja')
  addShape(s, makeRect(10, 12, 20, 10, makeAppearance(color(255, 0, 0), null)))
  const file = join(dir, 'caja.pixeltor')
  writeFileSync(file, saveDocument(s.doc, s.rasters))
  const env = { ...process.env } as Record<string, string>
  delete env['ELECTRON_RUN_AS_NODE']
  const app = await electron.launch({
    env,
    args: ['.', `--user-data-dir=${join(dir, 'data')}`, file]
  })
  try {
    const page = await app.firstWindow()
    await page.waitForSelector('.pt-stage canvas')
    await page.waitForTimeout(800)
    // ancho del dock: arrastrar el borde izquierdo hacia la izquierda lo ensancha
    const dock = page.locator('.pt-dock')
    const w0 = (await dock.boundingBox())!.width
    const edge = (await page.getByTestId('dock-edge').boundingBox())!
    await page.mouse.move(edge.x + 3, edge.y + 200)
    await page.mouse.down()
    await page.mouse.move(edge.x - 57, edge.y + 200, { steps: 4 })
    await page.mouse.up()
    expect((await dock.boundingBox())!.width).toBeCloseTo(w0 + 60, -1)
    // alto del grupo Propiedades
    const props = page.locator('.pt-panel').first().locator('.body')
    const h0 = (await props.boundingBox())!.height
    const sp = (await page.getByTestId('dock-split-props').boundingBox())!
    await page.mouse.move(sp.x + 30, sp.y + 2)
    await page.mouse.down()
    await page.mouse.move(sp.x + 30, sp.y + 42, { steps: 4 })
    await page.mouse.up()
    expect((await props.boundingBox())!.height).toBeCloseTo(h0 + 40, -1)
    // seleccionar la forma desde la lista de capas y editar con operaciones
    await page.locator('.pt-panel', { hasText: 'Capas' }).getByText('Rectángulo').first().click()
    await expect(page.getByTestId('prop-x')).toBeVisible()
    const x = page.getByTestId('prop-x')
    await expect(x).toHaveValue('10')
    await x.fill('30-5')
    await x.press('Enter')
    await expect(x).toHaveValue('25')
    const wi = page.getByTestId('prop-w')
    await wi.fill('(10+4)*2')
    await wi.press('Enter')
    await expect(wi).toHaveValue('28')
    // punto de referencia: el centro (25 + 28/2) en X
    await page.getByTestId('origin-11').click()
    await expect(x).toHaveValue('39')
    // proporción bloqueada: la forma mide 28×10; An=14 → Al=5
    await page.getByTestId('prop-lock').click()
    await wi.fill('14')
    await wi.press('Enter')
    await expect(page.getByTestId('prop-h')).toHaveValue('5')
  } finally {
    await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => undefined)
  }
})
