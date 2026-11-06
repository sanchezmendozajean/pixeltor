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

test('añadir una sombra paralela desde la paleta de comandos y editarla', async () => {
  const box = (await page.locator('.pt-stage').boundingBox())!
  await page.keyboard.press('m')
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2 - 40)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 40, { steps: 4 })
  await page.mouse.up()

  await page.keyboard.press('Control+k')
  await page
    .getByRole('dialog', { name: 'Paleta de comandos' })
    .locator('input')
    .fill('sombra paralela')
  await page.keyboard.press('Enter')

  const card = page.locator('.fx .card')
  await expect(card).toHaveCount(1)
  await expect(card.locator('strong')).toHaveText('Sombra paralela')

  // la fila de la forma muestra el indicador fx
  await page.locator('.pt-ptab', { hasText: 'Capas' }).click()
  await expect(page.locator('.layers .fx-tag')).toHaveCount(1)
  await page.locator('.pt-ptab', { hasText: 'Efectos' }).click()

  // arrastrar un deslizador: un solo paso de historial al soltar
  const slider = card.locator('input[type=range]').first()
  const hist = page.locator('.pt-ptab', { hasText: 'Historial' })
  await slider.fill('10')
  await hist.click()
  await expect(page.locator('.hist').getByRole('button', { name: 'Editar efecto' })).toHaveCount(1)
  await page.locator('.pt-ptab', { hasText: 'Efectos' }).click()
  await card.getByRole('button', { name: 'Eliminar efecto' }).click()
  await expect(card).toHaveCount(0)
})
