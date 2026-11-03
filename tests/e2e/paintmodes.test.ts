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

async function drawRect(x0: number, y0: number, x1: number, y1: number): Promise<void> {
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx + x0, cy + y0)
  await page.mouse.down()
  await page.mouse.move(cx + x1, cy + y1, { steps: 5 })
  await page.mouse.up()
}

test('los modos de pintura del relleno: ninguno y degradado se aplican a las formas nuevas', async () => {
  const mode = (name: string) => page.locator('.modes').getByRole('button', { name, exact: true })
  await expect(mode('Color')).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('m')
  await mode('Ninguno').click()
  await expect(mode('Ninguno')).toHaveAttribute('aria-pressed', 'true')
  await expect(mode('Color')).toHaveAttribute('aria-pressed', 'false')
  await drawRect(-100, -100, -20, -20)
  await page.locator('.pt-ptab', { hasText: 'Propiedades' }).click()
  await expect(
    page.getByRole('region', { name: 'Propiedades' }).getByRole('checkbox', { name: 'Relleno' })
  ).not.toBeChecked()

  await mode('Degradado').click()
  await expect(mode('Degradado')).toHaveAttribute('aria-pressed', 'true')
  await drawRect(20, 20, 100, 100)
  await expect(
    page.getByRole('region', { name: 'Propiedades' }).getByRole('checkbox', { name: 'Relleno' })
  ).toBeChecked()
  await page.locator('.pt-ptab', { hasText: 'Apariencia' }).click()
  await expect(page.getByText('Lineal').first()).toBeVisible()

  // vuelve a color liso
  await mode('Color').click()
  await expect(mode('Color')).toHaveAttribute('aria-pressed', 'true')
})
