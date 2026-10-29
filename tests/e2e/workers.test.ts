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

test('los efectos de una imagen grande se calculan en un worker sin errores', async () => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.keyboard.press('Control+n')
  await page.locator('#nw').fill('256')
  await page.locator('#nh').fill('256')
  await page.getByRole('button', { name: 'Crear' }).click()
  await page.waitForTimeout(200)

  const box = (await page.locator('.pt-stage').boundingBox())!
  await page.keyboard.press('m')
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 60)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 60, { steps: 4 })
  await page.mouse.up()

  await page.keyboard.press('Control+k')
  await page
    .getByRole('dialog', { name: 'Paleta de comandos' })
    .locator('input')
    .fill('desenfoque gaussiano')
  await page.keyboard.press('Enter')
  await expect(page.locator('.fx .card')).toHaveCount(1)

  // el cálculo ocurre en un worker y el indicador desaparece al terminar
  await expect.poll(() => page.workers().length, { timeout: 10_000 }).toBeGreaterThan(0)
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 10_000 })
  expect(errors).toEqual([])
})
