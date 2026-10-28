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

test('Ctrl+K busca un comando, navega con el teclado y lo ejecuta', async () => {
  await page.keyboard.press('Control+k')
  const input = page.getByRole('dialog', { name: 'Paleta de comandos' }).locator('input')
  await expect(input).toBeFocused()
  await input.fill('nuevo')
  const first = page.locator('.cmd [role=option]').first()
  await expect(first).toContainText('Nuevo')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Paleta de comandos' })).toHaveCount(0)
  await expect(page.locator('.pt-dialog').first()).toBeVisible()
  await page.keyboard.press('Escape')
})

test('Esc cierra la paleta sin ejecutar nada', async () => {
  await page.keyboard.press('Control+k')
  await page.keyboard.press('Escape')
  await expect(page.locator('.cmd')).toHaveCount(0)
})
