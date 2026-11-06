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
  await page.getByTestId('welcome-32').click()
  await page.waitForSelector('.pt-stage canvas')
})

test.afterAll(async () => {
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
})

test('Buscatrazos: unir dos rectángulos solapados en una sola forma y deshacer', async () => {
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.keyboard.press('m') // rectángulo
  await page.mouse.move(cx - 80, cy - 80)
  await page.mouse.down()
  await page.mouse.move(cx, cy, { steps: 4 })
  await page.mouse.up()
  await page.mouse.move(cx - 40, cy - 40)
  await page.mouse.down()
  await page.mouse.move(cx + 40, cy + 40, { steps: 4 })
  await page.mouse.up()

  // seleccionar las dos (clic y Mayús+clic en zonas que no se solapan) y unir desde el menú Objeto
  await page.locator('.pt-ptab', { hasText: 'Capas' }).click()
  const rows = page.locator('.layers .pt-srow')
  await rows.nth(0).click()
  await rows.nth(1).click({ modifiers: ['Shift'] })
  await page.getByRole('button', { name: 'Objeto', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Buscatrazos' }).hover()
  await page.getByRole('menuitem', { name: 'Unir', exact: true }).click()

  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  await expect(page.getByRole('button', { name: 'Unir formas' })).toBeVisible()
  await page.keyboard.press('Control+z')
  await expect(page.locator('.hist .undone')).toHaveCount(1)
})
