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

test('Espejo: menú de tipos, icono en la fila que lo activa y desactiva, y Ver líneas espejo', async () => {
  const row = page.locator('.pt-lrow').first()
  await expect(row.locator('.pt-lcol--mirror')).toHaveCount(0)

  await page.locator('[data-action="layer.mirrorMenu"]').click()
  await expect(page.getByRole('menuitem')).toHaveCount(7)
  await page.getByRole('menuitem', { name: 'Espejo 45° y 135°' }).click()

  const icon = row.locator('.pt-lcol--mirror')
  await expect(icon).toHaveCount(1)
  await expect(icon).toHaveAttribute('aria-pressed', 'true')
  await icon.click()
  await expect(icon).toHaveAttribute('aria-pressed', 'false')

  // el botón Duplicar capa ahora está en el pie del panel
  await expect(page.locator('.pt-pfoot [data-action="layer.duplicate"]')).toHaveCount(1)

  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Ver líneas espejo' })).toHaveCount(1)
})
