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

test('agrupar una capa, plegar el grupo, recortar y desagrupar', async () => {
  await page.locator('.pt-ptab', { hasText: 'Capas' }).click()
  await page.keyboard.press('Control+Shift+n') // segunda capa
  const rows = page.locator('.layers li.pt-lrow:not(.pt-srow)')
  await expect(rows).toHaveCount(2)

  // agrupar la capa activa desde el menú Capa
  await page.getByRole('button', { name: 'Capa', exact: true }).click()
  await page.getByRole('menuitem', { name: /^Agrupar capa/ }).click()
  await expect(rows).toHaveCount(3)
  await expect(rows.first()).toHaveClass(/is-group/)
  await expect(rows.nth(1)).toHaveClass(/is-member/)

  // plegar oculta al miembro; desplegar lo devuelve
  await rows.first().getByRole('button', { name: 'Plegar grupo' }).click()
  await expect(rows).toHaveCount(2)
  await rows.first().getByRole('button', { name: 'Desplegar grupo' }).click()
  await expect(rows).toHaveCount(3)

  // máscara de recorte sobre la capa de abajo (la capa suelta es la base)
  await rows.nth(2).click()
  await page.keyboard.press('Control+Alt+g')
  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  await expect(page.getByRole('button', { name: 'Propiedades de capa' }).last()).toBeVisible()

  // desagrupar
  await page.locator('.pt-ptab', { hasText: 'Capas' }).click()
  await rows.first().click()
  await page.getByRole('button', { name: 'Capa', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Desagrupar capas' }).click()
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).not.toHaveClass(/is-group/)

  // todo se deshace
  await page.keyboard.press('Control+z')
  await expect(rows).toHaveCount(3)
})
