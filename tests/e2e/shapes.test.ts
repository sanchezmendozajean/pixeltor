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

  // Visibilidad por forma y plegado de la capa desde el panel Capas
  const eye = rows.first().getByRole('button', { name: 'Mostrar u ocultar forma' })
  await eye.click()
  await expect(rows.first()).toHaveClass(/is-hidden/)
  await eye.click()
  await expect(rows.first()).not.toHaveClass(/is-hidden/)
  const layerRow = page.locator('.layers li.pt-lrow:not(.pt-srow)').first()
  await layerRow.getByRole('button', { name: 'Plegar' }).click()
  await expect(rows).toHaveCount(0)
  await layerRow.getByRole('button', { name: 'Desplegar' }).click()
  await expect(rows).toHaveCount(2)

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
  // la caja acaba un píxel más allá del cursor; su tirador está en el centro de ese último píxel
  const zoom =
    Number.parseInt(
      (await page.locator('.pt-viewport .pt-select.zoom').first().innerText()).replace(/D/g, ''),
      10
    ) / 100
  await page.mouse.move(cx + zoom / 2, cy + zoom / 2)
  await page.mouse.down()
  await page.mouse.move(cx + 70, cy + 70, { steps: 6 })
  await page.mouse.up()
  // la esquina escalada queda en la arista que sigue al píxel bajo el cursor
  const corner = (v: number) => (Math.floor(v / zoom) + 1) * zoom
  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  await expect(page.getByRole('button', { name: 'Escalar' })).toBeVisible()

  await page.getByRole('button', { name: 'Objeto' }).click()
  await page.getByRole('menuitem', { name: 'Convertir en trazado' }).click()
  await expect(page.getByRole('button', { name: 'Convertir en trazado' })).toBeVisible()

  await page.keyboard.press('a')
  // el ancla de la esquina del rectángulo convertido está en el centro de su último píxel
  await page.mouse.move(cx + corner(70) - zoom / 2, cy + corner(70) - zoom / 2)
  await page.mouse.down()
  await page.mouse.move(cx + 90, cy + 50, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Mover ancla' })).toBeVisible()
  await page.screenshot({ path: 'test-results/f2-anclas.png' })
})

test('rotar con la caja y mover una forma a otra capa arrastrando su fila', async () => {
  await page.keyboard.press('Control+n')
  await page.locator('#nw').fill('64')
  await page.locator('#nh').fill('64')
  await page.getByRole('button', { name: 'Crear', exact: true }).click()
  await page.keyboard.press('m')
  await drag(-60, -60, 0, 0)
  await page.keyboard.press('v')
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  // fuera de la esquina inferior derecha de la caja (zona de rotación)
  await page.mouse.move(cx + 22, cy + 22)
  await page.mouse.down()
  await page.mouse.move(cx - 40, cy + 40, { steps: 8 })
  await page.mouse.up()
  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  await expect(page.getByRole('button', { name: 'Rotar' })).toBeVisible()

  await page.locator('.pt-ptab', { hasText: 'Capas' }).click()
  await page.keyboard.press('Control+Shift+n')
  await expect(page.locator('.layers li:not(.pt-srow)')).toHaveCount(2)
  const shapeRow = page.locator('.layers .pt-srow').first()
  const lower = page.locator('.layers li:not(.pt-srow)').last()
  await shapeRow.dragTo(page.locator('.layers li:not(.pt-srow)').first())
  await expect(page.locator('.layers .pt-srow')).toHaveCount(1)
  void lower
})

test('agrupar, aislar con doble clic y desagrupar', async () => {
  await page.keyboard.press('Control+n')
  await page.locator('#nw').fill('64')
  await page.locator('#nh').fill('64')
  await page.getByRole('button', { name: 'Crear', exact: true }).click()
  await page.keyboard.press('m')
  await drag(-80, -80, -30, -30)
  await drag(-20, -20, 30, 30)
  await page.keyboard.press('v')
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.click(cx - 50, cy - 50)
  await page.keyboard.down('Shift')
  await page.mouse.click(cx + 5, cy + 5)
  await page.keyboard.up('Shift')
  await page.keyboard.press('Control+g')
  await expect(page.locator('.layers .pt-srow', { hasText: 'Grupo' })).toHaveCount(1)
  await page.mouse.dblclick(cx - 50, cy - 50)
  await page.screenshot({ path: 'test-results/f2-aislar.png' })
  await expect(page.locator('.notice')).toContainText('aislamiento')
  await page.keyboard.press('Escape')
  await expect(page.locator('.notice')).toHaveCount(0)
  await page.keyboard.press('Control+Shift+g')
  await expect(page.locator('.layers .pt-srow', { hasText: 'Grupo' })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/f2-grupos.png' })
})

test('V sobre el fondo dibuja un marco que selecciona las formas que toca', async () => {
  await page.keyboard.press('Control+n')
  await page.getByRole('button', { name: 'Crear', exact: true }).click()
  await page.locator('.pt-ptab', { hasText: 'Capas' }).click()
  await page.keyboard.press('m')
  await drag(-100, -100, -20, -20)
  await page.keyboard.press('v')
  const selected = page.locator('.layers .pt-srow.is-selected')
  // un clic en el vacío deselecciona
  await drag(100, 100, 100, 100)
  await expect(selected).toHaveCount(0)
  // un marco que sólo roza la esquina de la forma la selecciona
  await drag(-130, -130, -60, -60)
  await expect(selected).toHaveCount(1)
  // un marco en el vacío deselecciona
  await drag(60, -140, 100, -120)
  await expect(selected).toHaveCount(0)
})

test('Ctrl+Z con la pluma en curso quita la última ancla sin tocar el documento', async () => {
  await page.keyboard.press('m')
  await drag(-120, -120, -80, -80)
  const rows = page.locator('.layers .pt-srow')
  const n0 = await rows.count()
  await page.keyboard.press('p')
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  for (const [dx, dy] of [
    [20, 20],
    [80, 30],
    [120, 90]
  ] as const) {
    await page.mouse.click(cx + dx, cy + dy)
  }
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Enter')
  // el rectángulo sigue ahí y se creó el trazado de 2 anclas
  await expect(rows).toHaveCount(n0 + 1)
})

test('Esc con la pluma termina el trazado abierto sin descartarlo', async () => {
  const rows = page.locator('.layers .pt-srow')
  const n0 = await rows.count()
  await page.keyboard.press('p')
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.click(cx - 100, cy + 100)
  await page.mouse.click(cx - 40, cy + 120)
  await page.mouse.click(cx + 20, cy + 90)
  await page.keyboard.press('Escape')
  await expect(rows).toHaveCount(n0 + 1)
})

test('doble clic en el cuadro de color de Apariencia abre el selector y cambia el color', async () => {
  await page.keyboard.press('m')
  await drag(-130, 40, -90, 80)
  await page.locator('.pt-ptab', { hasText: 'Apariencia' }).click()
  const sw = page.locator('.app .row .sw').first()
  const before = await sw.getAttribute('style')
  await sw.dblclick()
  const dlg = page.getByRole('dialog', { name: 'Selector de color' })
  await expect(dlg).toBeVisible()
  const hexInput = dlg.getByLabel('Valor hexadecimal')
  await hexInput.fill('#12AB34')
  await hexInput.press('Tab')
  await dlg.getByRole('button', { name: 'Aceptar' }).click()
  await expect(dlg).toBeHidden()
  await expect.poll(() => sw.getAttribute('style')).not.toBe(before)
})

test('el selector de color es siempre el mismo y aparece junto al cuadro que lo abre', async () => {
  await page.locator('.pt-ptab', { hasText: 'Propiedades' }).click()
  const btn = page.locator('.pt-dock .cbtn').first()
  await btn.click()
  const dlg = page.getByRole('dialog', { name: 'Selector de color' })
  await expect(dlg).toBeVisible()
  const b = (await btn.boundingBox())!
  const d = (await dlg.boundingBox())!
  // pegado al cuadro: su borde queda a menos de 40 px del cuadro (debajo o encima)
  const gap = Math.min(Math.abs(d.y - (b.y + b.height)), Math.abs(b.y - (d.y + d.height)))
  expect(gap).toBeLessThan(40)
  await dlg.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dlg).toBeHidden()
  await expect(page.locator('input[type="color"]')).toHaveCount(0)
})

test('el selector de color aplica en vivo, Aceptar confirma y Cancelar deshace', async () => {
  await page.keyboard.press('m')
  await drag(-60, 100, -20, 140)
  await page.locator('.pt-ptab', { hasText: 'Apariencia' }).click()
  const sw = page.locator('.app .row .sw').first()
  const before = await sw.getAttribute('style')
  await sw.dblclick()
  const dlg = page.getByRole('dialog', { name: 'Selector de color' })
  const hexInput = dlg.getByLabel('Valor hexadecimal')
  await hexInput.fill('#00FF00')
  await hexInput.press('Tab')
  // sin pulsar Aceptar el cuadro de la forma ya cambió
  await expect.poll(() => sw.getAttribute('style')).not.toBe(before)
  await dlg.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dlg).toBeHidden()
  await expect.poll(() => sw.getAttribute('style')).toBe(before)

  await sw.dblclick()
  await hexInput.fill('#00FF00')
  await hexInput.press('Tab')
  await dlg.getByRole('button', { name: 'Aceptar' }).click()
  await expect.poll(() => sw.getAttribute('style')).not.toBe(before)
})

test('Apariencia: parámetros bajo el elemento elegido, arrastrar para ordenar y pie con iconos', async () => {
  await page.keyboard.press('m')
  await drag(60, 100, 100, 140)
  await page.locator('.pt-ptab', { hasText: 'Apariencia' }).click()
  // los botones de capa sólo se ven en la pestaña Capas
  await expect(page.locator('[data-action="layer.duplicate"]')).toBeHidden()
  const rows = page.locator('.app li.row')
  await expect(rows).toHaveCount(2)
  await rows.nth(1).click()
  // el editor queda justo debajo de la fila elegida (la segunda), no al final de otra
  const editor = page.locator('.app li.editor')
  await expect(editor).toHaveCount(1)
  const rb = (await rows.nth(1).boundingBox())!
  const eb = (await editor.boundingBox())!
  expect(Math.abs(eb.y - (rb.y + rb.height))).toBeLessThan(4)
  // sin botones arriba/abajo
  await expect(page.getByRole('button', { name: 'Subir (dibujar más arriba)' })).toHaveCount(0)
  // arrastrar la segunda fila sobre la primera cambia el orden
  const first = await rows.nth(0).innerText()
  await rows.nth(1).dragTo(rows.nth(0))
  await expect.poll(async () => rows.nth(0).innerText()).not.toBe(first)
  // duplicar y eliminar el elemento elegido
  await page.getByRole('button', { name: 'Duplicar', exact: false }).last().click()
  await expect(rows).toHaveCount(3)
  await page
    .locator('.app .foot')
    .getByRole('button', { name: /Eliminar/ })
    .click()
  await expect(rows).toHaveCount(2)
  await page.locator('.pt-ptab', { hasText: 'Capas' }).click()
  await expect(page.locator('[data-action="layer.duplicate"]')).toBeVisible()
})

test('clic fuera del selector de color conserva el color elegido', async () => {
  await page.keyboard.press('m')
  await drag(-140, -140, -100, -100)
  await page.locator('.pt-ptab', { hasText: 'Apariencia' }).click()
  const sw = page.locator('.app .row .sw').first()
  const before = await sw.getAttribute('style')
  await sw.dblclick()
  const dlg = page.getByRole('dialog', { name: 'Selector de color' })
  const hexInput = dlg.getByLabel('Valor hexadecimal')
  await hexInput.fill('#FF00FF')
  await hexInput.press('Tab')
  await page.mouse.click(200, 700)
  await expect(dlg).toBeHidden()
  await expect.poll(() => sw.getAttribute('style')).not.toBe(before)
})
