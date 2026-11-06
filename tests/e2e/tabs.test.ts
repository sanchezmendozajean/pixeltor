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

test('clic derecho en una pestaña: cerrar, cerrar otros y cerrar todo', async () => {
  const tabs = page.locator('.pt-doctab')
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Control+n')
    await page.getByRole('button', { name: 'Crear' }).click()
  }
  await expect(tabs).toHaveCount(3)

  await tabs.nth(1).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Cerrar', exact: true }).click()
  await expect(tabs).toHaveCount(2)

  await tabs.nth(0).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Cerrar otros' }).click()
  await expect(tabs).toHaveCount(1)

  // Esc cierra el menú sin hacer nada
  await tabs.nth(0).click({ button: 'right' })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)

  await tabs.nth(0).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Cerrar todo' }).click()
  await expect(tabs).toHaveCount(0)
})
