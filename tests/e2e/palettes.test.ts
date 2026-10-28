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

test('la paleta del documento: añadir, rampa, biblioteca y deshacer', async () => {
  await page.locator('.pt-ptab', { hasText: 'Muestras' }).click()
  const cells = page.locator('.sw .pt-swcell')
  const n0 = await cells.count()
  expect(n0).toBe(16) // PICO-8 por defecto

  await page.getByRole('button', { name: 'Rampa' }).click()
  await expect.poll(() => cells.count()).toBeGreaterThan(n0)
  const n1 = await cells.count()

  await page.locator('.sw select.lib').selectOption('endesga32')
  await expect(cells).toHaveCount(32)
  await page.keyboard.press('Control+z')
  await expect(cells).toHaveCount(n1)
})
