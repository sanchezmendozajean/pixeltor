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

test('alinear a la izquierda, distribuir y objeto clave', async () => {
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const rect = async (x0: number, y0: number, x1: number, y1: number) => {
    await page.mouse.move(cx + x0, cy + y0)
    await page.mouse.down()
    await page.mouse.move(cx + x1, cy + y1, { steps: 4 })
    await page.mouse.up()
  }
  await page.keyboard.press('m')
  await rect(-200, -120, -140, -80)
  await rect(-60, -40, 20, 20)
  await rect(80, 40, 120, 120)
  await page.keyboard.press('v')
  await page.mouse.click(cx - 170, cy - 100)
  await page.keyboard.down('Shift')
  await page.mouse.click(cx - 20, cy - 10)
  await page.mouse.click(cx + 100, cy + 80)
  await page.keyboard.up('Shift')

  await page.locator('.pt-ptab', { hasText: 'Alinear' }).click()
  await page.getByRole('button', { name: 'Alinear a la izquierda' }).click()
  await page.getByRole('button', { name: 'Espaciado vertical' }).click()
  await page.screenshot({ path: 'test-results/f3-alinear.png' })

  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  await page.screenshot({ path: 'test-results/f3-alinear-historial.png' })
  await expect(
    page.locator('.hist').getByRole('button', { name: 'Alinear a la izquierda' })
  ).toHaveCount(1)
  await expect(
    page.locator('.hist').getByRole('button', { name: /Distribuir espaciado/ })
  ).toHaveCount(1)
})
