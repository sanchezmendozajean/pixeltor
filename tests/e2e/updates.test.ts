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

async function openHelp(): Promise<void> {
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click()
}

test('Ayuda › Buscar actualizaciones avisa de que esta instalación no se actualiza sola', async () => {
  // en desarrollo la aplicación no está empaquetada: el diálogo nativo se sustituye por un espía
  await app.evaluate(({ dialog }) => {
    const g = globalThis as unknown as { __boxes: string[] }
    g.__boxes = []
    dialog.showMessageBox = (async (a: unknown, b?: unknown) => {
      const o = (b ?? a) as { message?: string }
      g.__boxes.push(o.message ?? '')
      return { response: 1, checkboxChecked: false }
    }) as typeof dialog.showMessageBox
  })
  await openHelp()
  await page.getByRole('menuitem', { name: 'Buscar actualizaciones…' }).click()
  await expect
    .poll(() =>
      app.evaluate(() => (globalThis as unknown as { __boxes: string[] }).__boxes.join('|'))
    )
    .toContain('no se actualiza sola')
})

test('buscar actualizaciones al iniciar se puede desactivar y se recuerda', async () => {
  await openHelp()
  const item = () => page.getByRole('menuitem', { name: 'Buscar actualizaciones al iniciar' })
  // la marca de verificación es el icono de la columna izquierda del elemento
  await expect(item().locator('.pt-mi__ic svg')).toHaveCount(1)
  await item().click()
  await openHelp()
  await expect(item().locator('.pt-mi__ic svg')).toHaveCount(0)
  const saved = await page.evaluate(() =>
    (
      globalThis as unknown as {
        pixeltor: { settings: { get(): Promise<{ autoUpdate: boolean }> } }
      }
    ).pixeltor.settings.get()
  )
  expect(saved.autoUpdate).toBe(false)
})
