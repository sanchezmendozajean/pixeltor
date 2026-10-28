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
  // VS Code define ELECTRON_RUN_AS_NODE y Electron arrancaría como Node.
  const env = { ...process.env } as Record<string, string>
  delete env['ELECTRON_RUN_AS_NODE']
  app = await electron.launch({
    env,
    args: ['.', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pixeltor-e2e-'))}`]
  })
  page = await app.firstWindow()
  await page.waitForSelector('.pt-app')
})

test.afterAll(async () => {
  await app.close()
})

test('la ventana abre con el shell completo', async () => {
  await expect(page).toHaveTitle('Pixeltor')
  for (const sel of [
    '.pt-titlebar',
    '.pt-cbar',
    '.pt-toolbar',
    '.pt-doctabs',
    '.pt-dock',
    '.pt-status'
  ]) {
    await expect(page.locator(sel)).toBeVisible()
  }
  await page.screenshot({ path: 'test-results/shell-oscuro.png' })
})

test('el menú muestra los atajos del registro', async () => {
  await page.getByRole('button', { name: 'Archivo' }).click()
  await expect(page.getByRole('menuitem', { name: /Guardar como/ })).toContainText('Ctrl+Mayús+S')
  await page.keyboard.press('Escape')
})

test('los atajos activan herramientas', async () => {
  await page.keyboard.press('b')
  await expect(page.locator('.pt-cbar')).toContainText('Pincel')
})

test('los temas conmutan y se persisten', async () => {
  await page.getByRole('button', { name: 'Ver' }).click()
  await page.getByRole('menuitem', { name: 'Tema' }).hover()
  await page.getByRole('menuitem', { name: 'Claro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'claro')
  await page.screenshot({ path: 'test-results/shell-claro.png' })
  const saved = await page.evaluate(() =>
    (
      globalThis as unknown as { pixeltor: { settings: { get(): Promise<{ theme: string }> } } }
    ).pixeltor.settings.get()
  )
  expect(saved.theme).toBe('claro')
})

test('Tab oculta los paneles', async () => {
  await page.locator('body').click({ position: { x: 600, y: 300 } })
  await page.keyboard.press('Tab')
  await expect(page.locator('.pt-dock')).toHaveCount(0)
  await page.keyboard.press('Tab')
  await expect(page.locator('.pt-dock')).toBeVisible()
})
