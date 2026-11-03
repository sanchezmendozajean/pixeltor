import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Flujo completo con diálogos nativos sustituidos: dibujar un sprite, animarlo, guardar,
// exportar un GIF, cerrar y reabrir el archivo.
const work = mkdtempSync(join(tmpdir(), 'pixeltor-flow-'))
let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const env = { ...process.env } as Record<string, string>
  delete env['ELECTRON_RUN_AS_NODE']
  app = await electron.launch({
    env,
    args: ['.', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pixeltor-e2e-'))}`]
  })
  // Los diálogos de guardar/abrir devuelven siempre «sprite» dentro de la carpeta de trabajo.
  await app.evaluate(({ dialog }, dir) => {
    dialog.showSaveDialog = (async (a: unknown, b?: unknown) => {
      const o = (b ?? a) as { defaultPath?: string }
      return {
        canceled: false,
        filePath: `${dir}/sprite${/\.\w+$/.exec(o.defaultPath ?? '')?.[0] ?? ''}`
      }
    }) as typeof dialog.showSaveDialog
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [`${dir}/sprite.pixeltor`]
    })) as typeof dialog.showOpenDialog
  }, work)
  page = await app.firstWindow()
  await page.waitForSelector('.pt-stage canvas')
})

test.afterAll(async () => {
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
})

async function scribble(dx: number, dy: number): Promise<void> {
  const box = (await page.locator('.pt-stage').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx - 60, cy - 60)
  await page.mouse.down()
  await page.mouse.move(cx + dx, cy + dy, { steps: 6 })
  await page.mouse.up()
}

test('dibujar, animar, guardar, exportar GIF y reabrir', async () => {
  const frames = page.locator('.pt-strip .pt-frame')
  await page.keyboard.press('n')
  await scribble(60, 20)
  await page.keyboard.press('Control+Alt+n')
  await expect(frames).toHaveCount(2)
  await scribble(20, 60)

  // guardar (el diálogo de guardar devuelve la ruta del archivo)
  await page.keyboard.press('Control+s')
  await expect.poll(() => existsSync(join(work, 'sprite.pixeltor'))).toBe(true)
  expect(readFileSync(join(work, 'sprite.pixeltor')).subarray(0, 2).toString('latin1')).toBe('PK')

  // exportar como GIF animado con las dos imágenes
  await page.keyboard.press('Control+Alt+s')
  const dlg = page.getByRole('dialog')
  await dlg.locator('#ef').selectOption('gif')
  await dlg.getByRole('button', { name: 'Exportar', exact: true }).click()
  await expect.poll(() => existsSync(join(work, 'sprite.gif'))).toBe(true)
  const gif = readFileSync(join(work, 'sprite.gif'))
  expect(gif.subarray(0, 6).toString('latin1')).toBe('GIF89a')
  // una extensión de control gráfico (21 F9) por cada imagen
  let n = 0
  for (let i = 0; i < gif.length - 1; i++) if (gif[i] === 0x21 && gif[i + 1] === 0xf9) n++
  expect(n).toBe(2)

  // cerrar (sin cambios pendientes) y reabrir: vuelven las dos imágenes
  await page.keyboard.press('Control+w')
  await expect(frames).toHaveCount(0) // sin documentos abiertos
  await page.keyboard.press('Control+o')
  await expect(frames).toHaveCount(2, { timeout: 10_000 })
  await expect(page.locator('.pt-doctab.is-active')).toContainText('.pixeltor')
})
