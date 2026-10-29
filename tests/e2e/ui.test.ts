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

test('la barra de herramientas pasa a dos columnas y se recuerda al reabrir', async () => {
  await launch()
  const bar = page.locator('.pt-toolbar')
  const w1 = (await bar.boundingBox())!.width
  await bar.getByRole('button', { name: 'Barra de herramientas en dos columnas' }).click()
  await expect(bar).toHaveClass(/is-two/)
  expect((await bar.boundingBox())!.width).toBeGreaterThan(w1 + 20)
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
  await new Promise((r) => setTimeout(r, 500))

  await launch()
  await expect(page.locator('.pt-toolbar')).toHaveClass(/is-two/)
  await page
    .locator('.pt-toolbar')
    .getByRole('button', { name: /una columna/ })
    .click()
  await expect(page.locator('.pt-toolbar')).not.toHaveClass(/is-two/)
})

test('el selector de color cambia el relleno y el elemento activo queda encima', async () => {
  await launch()
  const fill = page.locator('.pt-fswidget__fill')
  const stroke = page.locator('.pt-fswidget__stroke')
  await expect(fill).toHaveClass(/is-top/)
  await stroke.click()
  await expect(stroke).toHaveClass(/is-top/)
  await expect(fill).not.toHaveClass(/is-top/)

  await fill.dblclick({ position: { x: 4, y: 4 } })
  const dlg = page.getByRole('dialog', { name: 'Selector de color' })
  await expect(dlg).toBeVisible()
  await dlg.locator('input.hex').fill('FF8000')
  await dlg.locator('input.hex').press('Enter')
  await expect(dlg).toHaveCount(0)
  await expect(fill).toHaveCSS('background-color', 'rgb(255, 128, 0)')

  // cancelar no cambia nada
  await fill.dblclick({ position: { x: 4, y: 4 } })
  await dlg.getByRole('spinbutton', { name: 'R' }).fill('0')
  await dlg.getByRole('button', { name: 'Cancelar' }).click()
  await expect(fill).toHaveCSS('background-color', 'rgb(255, 128, 0)')
})
