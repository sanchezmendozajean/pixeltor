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
