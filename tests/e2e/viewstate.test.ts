import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DocumentSession,
  addImage,
  leaf,
  saveDocument,
  type SavedViewers
} from '../../src/core/index'

test('al abrir un archivo se restauran la división, el zoom y el tamaño de los visores', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixeltor-e2e-'))
  const s = DocumentSession.create(32, 32, 'vista')
  s.doc.viewers = {
    layout: { kind: 'split', dir: 'v', ratio: 0.7, a: leaf('v1'), b: leaf('v2') },
    active: 'v1',
    viewers: [
      { id: 'v1', zoom: 8, centerX: 16, centerY: 16 },
      { id: 'v2', zoom: 2, centerX: 10, centerY: 10 }
    ]
  } as SavedViewers
  const file = join(dir, 'vista.pixeltor')
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
    const views = page.locator('.pt-viewport')
    await expect(views).toHaveCount(2)
    const zoomOf = (i: number) => views.nth(i).locator('.pt-select.zoom').innerText()
    await expect.poll(() => zoomOf(0)).toContain('800')
    await expect.poll(() => zoomOf(1)).toContain('200')
    const w0 = (await views.nth(0).boundingBox())!.width
    const w1 = (await views.nth(1).boundingBox())!.width
    expect(w0 / (w0 + w1)).toBeGreaterThan(0.65)
    await page.screenshot({ path: 'test-results/vista-restaurada.png' })
  } finally {
    await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
  }
})

test('un archivo sin zoom guardado encaja la imagen en cada visor', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixeltor-e2e-'))
  const s = DocumentSession.create(32, 32, 'sinzoom')
  s.doc.viewers = {
    layout: { kind: 'split', dir: 'v', ratio: 0.64, a: leaf('v1'), b: leaf('v2') },
    active: 'v1',
    viewers: [{ id: 'v1' }, { id: 'v2' }]
  } as SavedViewers
  const file = join(dir, 'sinzoom.pixeltor')
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
    const views = page.locator('.pt-viewport')
    await expect(views).toHaveCount(2)
    const zoomOf = (i: number) => views.nth(i).locator('.pt-select.zoom').innerText()
    await expect.poll(() => zoomOf(0)).not.toContain('100 %')
    await expect.poll(() => zoomOf(1)).not.toContain('100 %')
    await page.screenshot({ path: 'test-results/vista-sinzoom.png' })
  } finally {
    await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
  }
})

test('cada imagen del archivo recuerda su propio zoom y posición', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixeltor-e2e-'))
  const s = DocumentSession.create(32, 32, 'imagenes')
  const first = s.activeImageId
  const second = addImage(s, 'duplicate')!
  s.doc.viewers = {
    layout: leaf('v1'),
    active: 'v1',
    viewers: [
      {
        id: 'v1',
        views: {
          [first]: { zoom: 8, centerX: 16, centerY: 16 },
          [second]: { zoom: 3, centerX: 10, centerY: 10 }
        }
      }
    ]
  } as SavedViewers
  const file = join(dir, 'imagenes.pixeltor')
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
    const zoom = () => page.locator('.pt-viewport .pt-select.zoom').first().innerText()
    const frames = page.locator('.pt-strip .pt-frame')
    await expect(frames).toHaveCount(2)
    await frames.nth(0).click()
    await expect.poll(zoom).toContain('800')
    // cambiar el zoom de la primera y volver a la segunda: cada una conserva el suyo
    await page.locator('.pt-stage').hover()
    await page.mouse.wheel(0, -120)
    await expect.poll(zoom).not.toContain('800')
    const changed = await zoom()
    await frames.nth(1).click()
    await expect.poll(zoom).toContain('300')
    await frames.nth(0).click()
    await expect.poll(zoom).toBe(changed)
  } finally {
    await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
  }
})
