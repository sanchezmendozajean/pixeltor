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

test('con la pluma: clic en un segmento añade un ancla y clic en un ancla la elimina; Supr con anclas', async () => {
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.keyboard.press('m')
  await page.mouse.move(cx - 60, cy - 60)
  await page.mouse.down()
  await page.mouse.move(cx + 60, cy + 60, { steps: 4 })
  await page.mouse.up()
  await page.keyboard.press('Control+k')
  await page
    .getByRole('dialog', { name: 'Paleta de comandos' })
    .locator('input')
    .fill('convertir en trazado')
  await page.keyboard.press('Enter')

  const hist = page.locator('.pt-ptab', { hasText: 'Historial' })
  await hist.click()
  const entries = (name: string) => page.locator('.hist').getByRole('button', { name })

  // pluma: clic sobre el borde superior → ancla nueva
  await page.keyboard.press('p')
  await page.mouse.click(cx, cy - 60)
  await expect(entries('Añadir ancla')).toHaveCount(1)

  // selección directa: marco que abarca todas las anclas, Supr las elimina de golpe
  await page.keyboard.press('a')
  await page.mouse.move(cx - 90, cy - 90)
  await page.mouse.down()
  await page.mouse.move(cx + 20, cy + 20, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.press('Delete')
  await expect(
    page.locator('.hist').getByRole('button', { name: /Eliminar \d+ anclas|Eliminar ancla/ })
  ).toHaveCount(1)
})

test('Ctrl con la pluma mueve un ancla y Alt+arrastrar saca los tiradores', async () => {
  // documento nuevo y limpio
  await page.keyboard.press('Control+n')
  await page.getByRole('button', { name: 'Crear', exact: true }).click()
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.keyboard.press('m')
  await page.mouse.move(cx - 60, cy - 60)
  await page.mouse.down()
  await page.mouse.move(cx + 60, cy + 60, { steps: 4 })
  await page.mouse.up()
  await page.keyboard.press('Control+k')
  await page
    .getByRole('dialog', { name: 'Paleta de comandos' })
    .locator('input')
    .fill('convertir en trazado')
  await page.keyboard.press('Enter')
  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  const entries = (name: string) => page.locator('.hist').getByRole('button', { name })

  // pluma + Ctrl: se comporta como la selección directa y mueve el ancla
  await page.keyboard.press('p')
  const stage = page.locator('.pt-stage')
  await page.mouse.move(cx + 200, cy + 200)
  const penCursor = await stage.evaluate((el) => (el as HTMLElement).style.cursor)
  expect(penCursor).toContain('data:image/svg')
  await page.keyboard.down('Control')
  await page.mouse.move(cx + 201, cy + 200)
  const ctrlCursor = await stage.evaluate((el) => (el as HTMLElement).style.cursor)
  expect(ctrlCursor).toContain('data:image/svg')
  expect(ctrlCursor).not.toBe(penCursor) // flecha de anclas en vez de pluma
  await page.mouse.move(cx - 60, cy - 60)
  await page.mouse.down()
  await page.mouse.move(cx - 80, cy - 80, { steps: 4 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  await expect(entries('Mover ancla')).toHaveCount(1)

  // selección directa + Alt: arrastrar un ancla saca los tiradores
  await page.keyboard.press('a')
  await page.keyboard.down('Alt')
  await page.mouse.move(cx - 80, cy - 80)
  await page.mouse.down()
  await page.mouse.move(cx - 40, cy - 100, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(entries('Sacar tiradores')).toHaveCount(1)
})
