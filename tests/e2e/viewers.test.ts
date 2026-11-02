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
  // hay cambios sin guardar: el cierre normal pediría confirmación (diálogo nativo)
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
})

test('dividir, pintar en un visor y verlo en los demás, límite de 4 y cerrar', async () => {
  const views = page.locator('.pt-viewport')
  await expect(views).toHaveCount(1)

  await page.keyboard.press('Control+Alt+v')
  await expect(views).toHaveCount(2)
  await expect(page.locator('.pt-splitter')).toHaveCount(1)

  // el visor nuevo es el activo; pintar en él debe verse también en el primero
  const first = views.nth(0)
  const before = await first.screenshot()
  await page.keyboard.press('n')
  const box = (await views.nth(1).locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 60, cy + 20, { steps: 6 })
  await page.mouse.up()
  await expect.poll(async () => !(await first.screenshot()).equals(before)).toBe(true)

  // zoom independiente: la rueda en un visor no mueve el otro
  const zoomOf = (i: number) => views.nth(i).locator('.pt-select.zoom').innerText()
  const z0 = await zoomOf(0)
  await page.mouse.move(cx, cy)
  await page.mouse.wheel(0, -120)
  await expect.poll(() => zoomOf(1)).not.toBe(z0)
  expect(await zoomOf(0)).toBe(z0)

  // hasta 4 visores
  await page.keyboard.press('Control+Alt+h')
  await page.keyboard.press('Control+Alt+h')
  await expect(views).toHaveCount(4)
  await page.keyboard.press('Control+Alt+h')
  await expect(views).toHaveCount(4)

  await page.screenshot({ path: 'test-results/f6-visores.png' })

  // la cabecera cierra visores
  await views
    .nth(3)
    .getByRole('button', { name: /Cerrar visor/ })
    .click()
  await expect(views).toHaveCount(3)
})

test('presets de disposición, imagen fijada y modo mosaico', async () => {
  const views = page.locator('.pt-viewport')
  await page.getByRole('button', { name: 'Ventana' }).click()
  await page.getByRole('menuitem', { name: 'Disposición de visores' }).hover()
  await page.getByRole('menuitem', { name: 'Disposición: un visor' }).click()
  await expect(views).toHaveCount(1)

  await page.keyboard.press('Control+Alt+n') // segunda imagen
  await page.keyboard.press('Control+Alt+v')
  await expect(views).toHaveCount(2)

  // fijar el segundo visor a la primera imagen
  await views.nth(1).getByRole('button', { name: /^Imagen:/ }).click()
  await page.getByRole('menuitem', { name: /Imagen 1/ }).click()
  await expect(views.nth(1).locator('.pt-select.image')).toContainText('Imagen 1')

  // mosaico en el segundo visor
  await views.nth(1).getByRole('button', { name: 'Modo mosaico' }).click()
  await page.getByRole('menuitem', { name: 'Repetir en X e Y' }).click()
  await expect(views.nth(1).getByRole('button', { name: 'Modo mosaico' })).toHaveClass(/is-on/)
})
