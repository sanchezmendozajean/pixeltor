import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DocumentSession, saveDocument } from '../../src/core/index'

test('un .pixeltor pasado por la línea de comandos se abre al arrancar', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixeltor-e2e-'))
  const s = DocumentSession.create(20, 12, 'desde-argumento')
  const file = join(dir, 'desde-argumento.pixeltor')
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
    await expect(page.locator('.pt-doctab', { hasText: 'desde-argumento' })).toHaveCount(1)
  } finally {
    await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
  }
})

test('Imagen › Tamaño de lienzo cambia las dimensiones de la imagen', async () => {
  const env = { ...process.env } as Record<string, string>
  delete env['ELECTRON_RUN_AS_NODE']
  const app = await electron.launch({
    env,
    args: ['.', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pixeltor-e2e-'))}`]
  })
  try {
    const page = await app.firstWindow()
    await page.getByTestId('welcome-32').click()
    await page.waitForSelector('.pt-stage canvas')
    await page.getByRole('button', { name: 'Imagen', exact: true }).click()
    await page.getByRole('menuitem', { name: /Tamaño de lienzo/ }).click()
    await page.getByLabel('Ancho').fill('48')
    await page.getByLabel('Alto').fill('16')
    await page.getByRole('button', { name: 'Aceptar' }).click()
    await expect(page.locator('.pt-status')).toContainText(/48\s*×\s*16/)
  } finally {
    await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
  }
})
