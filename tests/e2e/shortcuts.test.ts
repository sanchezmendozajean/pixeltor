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

type Bridge = { pixeltor: { settings: { get(): Promise<{ shortcuts: Record<string, string> }> } } }
const savedShortcuts = () =>
  page.evaluate(
    async () => (await (globalThis as unknown as Bridge).pixeltor.settings.get()).shortcuts
  )

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

test('atajos personalizados: cambiar, conflicto con reasignación, persistir y restablecer', async () => {
  await page.getByRole('button', { name: 'Ayuda' }).click()
  await page.getByRole('menuitem', { name: /Atajos de teclado/ }).click()
  const dlg = page.getByRole('dialog', { name: 'Atajos de teclado' })
  await expect(dlg).toBeVisible()
  await dlg.getByPlaceholder('Buscar acción…').fill('Pincel')

  // un atajo libre
  const row = dlg.locator('[data-action="tool.brush"]')
  await row.locator('.key').click()
  await page.keyboard.press('Control+Alt+Shift+9')
  await expect(row.locator('.key')).toHaveText('Ctrl+Alt+Mayús+9')

  // un atajo ocupado (V = Selección) avisa y se puede reasignar
  await row.locator('.key').click()
  await page.keyboard.press('v')
  await expect(dlg.getByRole('alert')).toContainText('Selección')
  await dlg.getByRole('button', { name: 'Reasignar' }).click()
  await expect(row.locator('.key')).toHaveText('V')

  // se guarda en los ajustes
  const saved = await savedShortcuts()
  expect(saved['tool.brush']).toBe('V')
  expect(saved['tool.sel']).toBe('')

  // fuera del diálogo, V activa ahora el pincel
  await dlg.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.locator('.pt-stage').click({ position: { x: 60, y: 60 } })
  await page.keyboard.press('v')
  await expect(page.locator('.pt-cbar')).toContainText('Pincel')

  // restablecer todo devuelve los atajos de fábrica
  await page.getByRole('button', { name: 'Ayuda' }).click()
  await page.getByRole('menuitem', { name: /Atajos de teclado/ }).click()
  await dlg.getByRole('button', { name: 'Restablecer todos' }).click()
  await dlg.getByRole('button', { name: 'Cerrar', exact: true }).click()
  expect(Object.keys(await savedShortcuts())).toEqual([])
  await page.keyboard.press('v')
  await expect(page.locator('.pt-cbar')).not.toContainText('Pincel')
})
