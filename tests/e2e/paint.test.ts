import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { mkdtempSync, readFileSync } from 'node:fs'
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
  await page.waitForSelector('.pt-app')
  await page.waitForSelector('.pt-stage canvas')
})

test.afterAll(async () => {
  // El documento tiene cambios y el cierre normal pediría confirmación (diálogo nativo).
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
})

test('dibujar con el lápiz crea un paso de historial y se puede deshacer', async () => {
  await page.keyboard.press('n')
  const stage = page.locator('.pt-stage')
  const box = (await stage.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 40, cy + 10, { steps: 5 })
  await page.mouse.up()

  await page.locator('.pt-ptab', { hasText: 'Historial' }).click()
  await expect(page.getByRole('button', { name: 'Trazo de lápiz' })).toBeVisible()
  await page.screenshot({ path: 'test-results/f1-trazo.png' })

  await page.keyboard.press('Control+z')
  await expect(page.locator('.hist .undone')).toHaveCount(1)
  await page.keyboard.press('Control+Shift+z')
  await expect(page.locator('.hist .undone')).toHaveCount(0)
})

test('crear, renombrar y ocultar capas', async () => {
  await page.locator('.pt-ptab', { hasText: 'Capas' }).click()
  await page.keyboard.press('Control+Shift+n')
  await expect(page.locator('.layers li')).toHaveCount(2)
  await page
    .getByRole('option')
    .first()
    .getByRole('button', { name: /Mostrar u ocultar/ })
    .click()
  await expect(page.locator('.layers li').first()).toHaveClass(/is-hidden/)
  await page.locator('.layers li').first().locator('.pt-lname').dblclick()
  await page.keyboard.type('Sombras')
  await page.keyboard.press('Enter')
  await expect(page.locator('.layers li').first()).toContainText('Sombras')
})

test('el visor muestra el lienzo con WebGL2', async () => {
  const ok = await page.evaluate(() => {
    const doc = (
      globalThis as unknown as {
        document: { createElement(t: string): { getContext(k: string): unknown } }
      }
    ).document
    return !!doc.createElement('canvas').getContext('webgl2')
  })
  expect(ok).toBe(true)
})

test('IPC de archivos: guardado atómico con .bak y autoguardado', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixeltor-files-'))
  const path = join(dir, 'a.pixeltor')
  const r = await page.evaluate(async (p) => {
    const api = (
      globalThis as unknown as {
        pixeltor: {
          files: {
            save(r: { path: string; suggestedName: string; bytes: Uint8Array }): Promise<string>
            open(p: string): Promise<{ bytes: Uint8Array } | null>
          }
          autosave: {
            write(id: string, n: string, b: Uint8Array): Promise<void>
            list(): Promise<{ docId: string; name: string }[]>
            read(id: string): Promise<Uint8Array | null>
            remove(id: string): Promise<void>
          }
        }
      }
    ).pixeltor
    await api.files.save({ path: p, suggestedName: 'a', bytes: new Uint8Array([1, 2, 3]) })
    await api.files.save({ path: p, suggestedName: 'a', bytes: new Uint8Array([4, 5]) })
    const opened = await api.files.open(p)
    await api.autosave.write('doc1', 'Mi dibujo', new Uint8Array([9, 9]))
    const list = await api.autosave.list()
    const back = await api.autosave.read('doc1')
    await api.autosave.remove('doc1')
    const after = await api.autosave.list()
    return {
      opened: Array.from(opened!.bytes),
      list: list.map((e) => e.name),
      back: Array.from(back!),
      after: after.length
    }
  }, path)
  expect(r.opened).toEqual([4, 5])
  expect(r.list).toContain('Mi dibujo')
  expect(r.back).toEqual([9, 9])
  expect(r.after).toBe(0)
  expect(readFileSync(`${path}.bak`)).toEqual(Buffer.from([1, 2, 3]))
})
