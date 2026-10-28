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

async function drag(dx0: number, dy0: number, dx1: number, dy1: number): Promise<void> {
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx + dx0, cy + dy0)
  await page.mouse.down()
  await page.mouse.move(cx + dx1, cy + dy1, { steps: 6 })
  await page.mouse.up()
}

test('crear rectángulo y elipse, seleccionar, mover y estampar', async () => {
  await page.keyboard.press('m')
  await drag(-100, -100, -20, -20)
  await page.keyboard.press('l')
  await drag(20, 20, 120, 100)

  const rows = page.locator('.layers .pt-srow')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('Elipse')
  await page.screenshot({ path: 'test-results/f2-formas.png' })

  // Seleccionar la elipse con V y comprobar que Propiedades muestra su apariencia.
  await page.keyboard.press('v')
  await drag(70, 60, 70, 60)
  await page.locator('.pt-ptab', { hasText: 'Propiedades' }).click()
  await expect(page.locator('.pt-dock .props').first()).toContainText('Elipse')

  // Mover con el teclado (un solo paso fusionado) y deshacer.
  await page.keyboard.press('ArrowRight')
  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  await expect(page.getByRole('button', { name: 'Mover forma' })).toBeVisible()

  // Estampar: la elipse desaparece de la lista de formas.
  await page.keyboard.press('Control+e')
  await expect(rows).toHaveCount(1)
  await page.keyboard.press('Control+z')
  await expect(rows).toHaveCount(2)
  await page.screenshot({ path: 'test-results/f2-estampado.png' })
})

test('escalar con la caja, convertir en trazado y mover un ancla', async () => {
  // Partimos de un lienzo limpio: nuevo documento 64×64 con el atajo y el diálogo.
  await page.keyboard.press('Control+n')
  await page.locator('#nw').fill('64')
  await page.locator('#nh').fill('64')
  await page.getByRole('button', { name: 'Crear', exact: true }).click()
  await page.keyboard.press('m')
  await drag(-60, -60, 0, 0)
  await page.keyboard.press('v')
  await page.screenshot({ path: 'test-results/f2-caja.png' })
  // tirador inferior derecho de la caja: justo en la esquina del rectángulo dibujado
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx + 10, cy + 10)
  await page.mouse.down()
  await page.mouse.move(cx + 70, cy + 70, { steps: 6 })
  await page.mouse.up()
  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  await expect(page.getByRole('button', { name: 'Escalar' })).toBeVisible()

  await page.getByRole('button', { name: 'Objeto' }).click()
  await page.getByRole('menuitem', { name: 'Convertir en trazado' }).click()
  await expect(page.getByRole('button', { name: 'Convertir en trazado' })).toBeVisible()

  await page.keyboard.press('a')
  await page.mouse.move(cx + 70, cy + 70)
  await page.mouse.down()
  await page.mouse.move(cx + 90, cy + 50, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Mover ancla' })).toBeVisible()
  await page.screenshot({ path: 'test-results/f2-anclas.png' })
})
