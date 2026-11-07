import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DocumentSession, addGuide, saveDocument } from '../../src/core/index'

test('doble clic en una guía abre el diálogo de posición y acepta expresiones', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixeltor-e2e-'))
  const s = DocumentSession.create(32, 32, 'guias')
  addGuide(s, 'v', 16)
  const file = join(dir, 'guias.pixeltor')
  writeFileSync(file, saveDocument(s.doc, s.rasters))
  const env = { ...process.env } as Record<string, string>
  delete env['ELECTRON_RUN_AS_NODE']
  const app = await electron.launch({
    env,
    args: ['.', `--user-data-dir=${join(dir, 'data')}`, file]
  })
  try {
    const page = await app.firstWindow()
    await page.waitForSelector('.pt-stage canvas')
    await page.waitForTimeout(800)
    const box = (await page.locator('.pt-stage').first().boundingBox())!
    // la imagen está encajada y centrada: la guía en 16 de 32 cae en el centro horizontal
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.dblclick(x, y)
    const input = page.getByTestId('guide-pos')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('16')
    await input.fill('100% - 10')
    await expect(page.locator('.pt-dialog .pt-hint').first()).toContainText('22')
    await input.press('Enter')
    await expect(input).toBeHidden()
    // segunda vez: la guía ya está en 22 (no en el centro); se busca con el menú de deshacer
    await page.keyboard.press('Control+z')
    await page.mouse.dblclick(x, y)
    await expect(page.getByTestId('guide-pos')).toHaveValue('16')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('guide-pos')).toBeHidden()
  } finally {
    await app.evaluate(({ app: a }) => a.exit(0))
  }
})
