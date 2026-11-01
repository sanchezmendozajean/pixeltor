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
test('varias imágenes: crear, cambiar duración, reordenar con el menú y deshacer', async () => {
  const frames = page.locator('.pt-strip .pt-frame')
  await expect(frames).toHaveCount(1)

  await page.keyboard.press('Control+Alt+n')
  await expect(frames).toHaveCount(2)
  await expect(frames.nth(1)).toHaveClass(/is-active/)

  // panel desplegado: se edita la duración y se actualiza el total
  await page.getByRole('button', { name: 'Expandir panel Imágenes' }).click()
  const dur = page.locator('.pt-strip .pt-fdur').nth(1)
  await dur.fill('250')
  await dur.press('Enter')
  await expect(page.locator('.pt-strip .total')).toContainText('350')

  // la tecla «,» (con el foco fuera del campo) vuelve a la primera
  await page.locator('.pt-stage').click({ position: { x: 40, y: 40 } })
  await page.keyboard.press(',')
  await expect(frames.nth(0)).toHaveClass(/is-active/)

  // menú contextual: excluir de la animación y eliminar
  await frames.nth(1).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Excluir de la animación' }).click()
  await expect(page.locator('.pt-strip .total')).toContainText('100')
  await frames.nth(1).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Eliminar', exact: true }).click()
  await expect(frames).toHaveCount(1)

  await page.keyboard.press('Control+z')
  await expect(frames).toHaveCount(2)
})

test('reproducción de una vez y papel cebolla', async () => {
  await page.keyboard.press('Control+Alt+n')
  const frames = page.locator('.pt-strip .pt-frame')
  await expect(frames).toHaveCount(3)
  await page.getByRole('combobox', { name: 'Modo de reproducción' }).selectOption('once')
  await page.getByRole('combobox', { name: 'Velocidad' }).selectOption('0.25')

  // empieza por la imagen activa (la última) y termina sola; no cambia la imagen activa
  await page.keyboard.press('Control+Enter')
  await expect(
    page.locator('.pt-strip .total').locator('xpath=preceding-sibling::span[1]')
  ).toContainText('fps')
  await expect(page.getByText(/ fps$/)).toHaveCount(0, { timeout: 10_000 })
  await expect(frames.nth(2)).toHaveClass(/is-active/)

  // papel cebolla: el botón queda activo y aparecen sus opciones
  await page.locator('.pt-stage').click({ position: { x: 40, y: 40 } })
  await page.keyboard.press('o')
  await expect(page.getByLabel('Antes')).toBeVisible()
  await page.keyboard.press('o')
  await expect(page.getByLabel('Antes')).toHaveCount(0)
})
