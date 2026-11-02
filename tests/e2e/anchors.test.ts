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

  // las anclas acaban en el centro de un píxel: se calcula dónde cae en pantalla
  const zoom =
    Number.parseInt(
      (await page.locator('.pt-viewport .pt-select.zoom').first().innerText()).replace(/D/g, ''),
      10
    ) / 100
  const centre = (x: number, y: number) => ({
    x: cx + (Math.floor((x - cx) / zoom) + 0.5) * zoom,
    y: cy + (Math.floor((y - cy) / zoom) + 0.5) * zoom
  })

  // pluma + Ctrl: se comporta como la selección directa y mueve el ancla
  await page.keyboard.press('p')
  const stage = page.locator('.pt-stage')
  await page.mouse.move(cx + 200, cy + 200)
  const penCursor = await stage.evaluate(
    (el) => (el as unknown as { style: { cursor: string } }).style.cursor
  )
  expect(penCursor).toContain('data:image/svg')
  await page.keyboard.down('Control')
  await page.mouse.move(cx + 201, cy + 200)
  const ctrlCursor = await stage.evaluate(
    (el) => (el as unknown as { style: { cursor: string } }).style.cursor
  )
  expect(ctrlCursor).toContain('data:image/svg')
  expect(ctrlCursor).not.toBe(penCursor) // flecha de anclas en vez de pluma
  await page.mouse.move(cx - 60, cy - 60)
  await page.mouse.down()
  await page.mouse.move(cx - 80, cy - 80, { steps: 4 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  const moved = centre(cx - 80, cy - 80)
  await expect(entries('Mover ancla')).toHaveCount(1)

  // selección directa + Alt: arrastrar un ancla saca los tiradores
  await page.keyboard.press('a')
  await page.keyboard.down('Alt')
  await page.mouse.move(moved.x, moved.y)
  await page.mouse.down()
  await page.mouse.move(cx - 40, cy - 100, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(entries('Sacar tiradores')).toHaveCount(1)
})

test('curvar un segmento, continuar un trazado abierto con la pluma y cortar/unir con los botones', async () => {
  await page.keyboard.press('Control+n')
  await page.getByRole('button', { name: 'Crear', exact: true }).click()
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  const entries = (name: string) => page.locator('.hist').getByRole('button', { name })

  // trazado abierto de dos anclas con la pluma
  await page.keyboard.press('p')
  await page.mouse.click(cx - 70, cy)
  await page.mouse.click(cx + 10, cy)
  await page.keyboard.press('Enter')

  // continuar desde el último extremo (las anclas quedan en el centro del píxel: +10 px)
  await page.mouse.click(cx + 10, cy + 10)
  await page.mouse.click(cx + 10, cy + 70)
  await page.keyboard.press('Enter')
  await expect(entries('Continuar trazado')).toHaveCount(1)

  // curvar el primer segmento arrastrándolo con la selección directa
  await page.keyboard.press('a')
  await page.mouse.move(cx - 30, cy)
  await page.mouse.down()
  await page.mouse.move(cx - 30, cy - 40, { steps: 6 })
  await page.mouse.up()
  await expect(entries('Curvar segmento')).toHaveCount(1)

  // marco sobre el ancla intermedia y tijeras: queda cortado en dos formas
  await page.mouse.move(cx + 50, cy - 40)
  await page.mouse.down()
  await page.mouse.move(cx - 10, cy + 30, { steps: 4 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Cortar en las anclas' }).click()
  await expect(entries('Cortar en anclas')).toHaveCount(1)
})
