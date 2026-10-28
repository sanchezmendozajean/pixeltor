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
})

test.afterAll(async () => {
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
})

test('apariencia: varios rellenos, degradado con tramado y reordenar', async () => {
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.keyboard.press('m')
  await page.mouse.move(cx - 120, cy - 120)
  await page.mouse.down()
  await page.mouse.move(cx + 120, cy + 120, { steps: 6 })
  await page.mouse.up()

  await page.screenshot({ path: 'test-results/f3-dbg.png' })
  await page.locator('.pt-ptab', { hasText: 'Apariencia' }).click()
  const rows = page.locator('.app .row')
  await expect(rows).toHaveCount(2)

  await page.getByRole('button', { name: '+ Relleno' }).click()
  await expect(rows).toHaveCount(3)

  // el relleno nuevo queda abierto: pasa a degradado lineal con tramado
  await page.locator('.app .editor select').first().selectOption('linear')
  await page.locator('.app .editor select').nth(1).selectOption('dither')
  await expect(page.locator('.app .editor')).toContainText('Ajedrez')
  await page.screenshot({ path: 'test-results/f3-degradado.png' })

  // reordenar: bajar el relleno nuevo (primera fila) un puesto
  await rows.first().getByRole('button', { name: /Bajar/ }).click()
  await expect(rows).toHaveCount(3)
  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  await expect(page.getByRole('button', { name: 'Reordenar apariencia' })).toBeVisible()
})

test('panel Degradado: añadir parada, ubicación, tipo y modo de píxel', async () => {
  await page.locator('.pt-ptab', { hasText: 'Degradado' }).click()
  const panel = page.locator('.gradient-panel')
  await expect(panel).toBeVisible()
  const stops = panel.locator('.stop')
  const before = await stops.count()
  // clic en el hueco bajo la barra: nueva parada
  const track = panel.locator('.track')
  const tb = (await track.boundingBox())!
  await page.mouse.click(tb.x + tb.width * 0.3, tb.y + 16)
  await expect(stops).toHaveCount(before + 1)
  // la parada nueva queda seleccionada: cambiar su ubicación
  await panel.getByLabel('Ubicación').fill('42.5')
  await panel.getByLabel('Ubicación').press('Enter')
  await panel.getByLabel('Ubicación').blur()
  await expect(panel.getByLabel('Ubicación')).toHaveValue('42.5')
  await panel.getByRole('button', { name: 'Degradado radial' }).click()
  await expect(panel.getByRole('button', { name: 'Degradado radial' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await panel.getByLabel('Modo de píxel').selectOption('bands')
  await expect(panel.getByLabel('Escalones')).toBeVisible()
  await page.screenshot({ path: 'test-results/f3-panel-degradado.png' })
  await panel.getByRole('button', { name: 'Eliminar parada' }).click()
  await expect(stops).toHaveCount(before)
})

test('arrastrar una parada solo crea un paso de historial, al soltar', async () => {
  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  const entries = page.locator('.hist button')
  const before = await entries.count()
  await page.locator('.pt-ptab', { hasText: 'Degradado' }).click()
  const stop = page.locator('.gradient-panel .stop').nth(1)
  const sb = (await stop.boundingBox())!
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
  await page.mouse.down()
  await page.mouse.move(sb.x + sb.width / 2 + 20, sb.y + 6, { steps: 4 })
  // durante el arrastre el historial no cambia
  await page.locator('.pt-ptab', { hasText: 'Historial' }).isVisible()
  await page.mouse.move(sb.x + sb.width / 2 + 40, sb.y + 6, { steps: 4 })
  await page.mouse.up()
  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  await expect(entries).toHaveCount(before + 1)
  await expect(entries.last()).toContainText('Editar degradado')
})

test('herramienta Degradado: arrastrar sobre la forma crea el degradado en un solo paso', async () => {
  await page.keyboard.press('Control+n')
  await page.locator('#nw').fill('64')
  await page.locator('#nh').fill('64')
  await page.getByRole('button', { name: 'Crear', exact: true }).click()
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.keyboard.press('m')
  await page.mouse.move(cx - 100, cy - 100)
  await page.mouse.down()
  await page.mouse.move(cx + 100, cy + 100, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.press('g')
  await page.mouse.move(cx - 80, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 80, cy, { steps: 8 })
  await page.mouse.up()
  await page.locator('.pt-ptab', { hasText: 'Apariencia' }).click()
  await expect(page.locator('.app .row', { hasText: 'Degradado lineal' })).toHaveCount(1)
  await page.screenshot({ path: 'test-results/f3-herramienta-g.png' })
  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  await expect(page.getByRole('button', { name: 'Editar degradado' })).toHaveCount(1)
})
