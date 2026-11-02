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

// Misma carpeta de usuario en todas las pruebas: los espacios propios deben sobrevivir al reabrir.
const userData = mkdtempSync(join(tmpdir(), 'pixeltor-e2e-'))
let app: ElectronApplication
let page: Page

async function launch(): Promise<void> {
  const env = { ...process.env } as Record<string, string>
  delete env['ELECTRON_RUN_AS_NODE']
  app = await electron.launch({ env, args: ['.', `--user-data-dir=${userData}`] })
  page = await app.firstWindow()
  await page.waitForSelector('.pt-stage canvas')
}

test.afterEach(async () => {
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
})

const selector = () => page.getByRole('button', { name: /^Espacio de trabajo:/ })

test.describe.configure({ mode: 'serial' })

test('los espacios integrados cambian los paneles visibles', async () => {
  await launch()
  await expect(selector()).toContainText('Esenciales')
  await expect(page.locator('.pt-dock')).toBeVisible()
  await expect(page.locator('.pt-strip')).toBeVisible()

  await selector().click()
  await page.getByRole('menuitemradio', { name: 'Mínimo' }).click()
  await expect(page.locator('.pt-dock')).toHaveCount(0)
  await expect(page.locator('.pt-strip')).toHaveCount(0)

  await selector().click()
  await page.getByRole('menuitemradio', { name: 'Animación' }).click()
  await expect(page.locator('.pt-dock')).toBeVisible()
  await expect(page.locator('.pt-ptab', { hasText: 'Capas' })).toBeVisible()
  await expect(page.locator('.pt-ptab', { hasText: 'Propiedades' })).toHaveCount(0)
  await expect(page.locator('.pt-strip')).toHaveClass(/open/)
})

test('crear un espacio propio con paneles ocultos y recuperarlo al reabrir', async () => {
  await launch()
  // el último espacio usado (Animación) se recuerda
  await expect(selector()).toContainText('Animación')

  // ocultar el panel Muestras desde Ventana › Paneles y guardar el estado como espacio nuevo
  await page.getByRole('button', { name: 'Ventana', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Paneles', exact: true }).hover()
  await page.getByRole('menuitem', { name: 'Muestras', exact: true }).click()
  await expect(page.locator('.pt-ptab', { hasText: 'Muestras' })).toHaveCount(0)

  await selector().click()
  await page.getByRole('menuitem', { name: 'Nuevo espacio de trabajo…' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nuevo espacio de trabajo' })
  await dlg.getByRole('textbox').fill('Mi pixel art')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(selector()).toContainText('Mi pixel art')

  // al cambiar a otro y volver, vuelve con Muestras oculto
  await selector().click()
  await page.getByRole('menuitemradio', { name: 'Esenciales' }).click()
  await expect(page.locator('.pt-ptab', { hasText: 'Muestras' })).toBeVisible()
  await selector().click()
  await page.getByRole('menuitemradio', { name: 'Mi pixel art' }).click()
  await expect(page.locator('.pt-ptab', { hasText: 'Muestras' })).toHaveCount(0)
})

test('el espacio propio persiste, se renombra y se elimina', async () => {
  await launch()
  await expect(selector()).toContainText('Mi pixel art')
  await expect(page.locator('.pt-ptab', { hasText: 'Muestras' })).toHaveCount(0)

  await selector().click()
  await page.getByRole('menuitem', { name: 'Renombrar espacio de trabajo…' }).click()
  const dlg = page.getByRole('dialog', { name: 'Renombrar espacio de trabajo' })
  await dlg.getByRole('textbox').fill('Sprites')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(selector()).toContainText('Sprites')

  // eliminar: vuelve a Esenciales
  await selector().click()
  await page.getByRole('menuitem', { name: 'Eliminar espacio de trabajo' }).click()
  await expect(selector()).toContainText('Esenciales')
  await selector().click()
  await expect(page.getByRole('menuitemradio', { name: 'Sprites' })).toHaveCount(0)
})
