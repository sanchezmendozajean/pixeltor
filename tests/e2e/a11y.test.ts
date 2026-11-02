import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import axe from 'axe-core'
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

type AxeResult = {
  violations: { id: string; impact?: string | null; nodes: { html: string }[] }[]
}

/** Electron no admite `newPage` (lo que usa @axe-core/playwright): se inyecta axe a mano. */
async function violations() {
  await page.evaluate(axe.source)
  const r = (await page.evaluate(() =>
    (globalThis as unknown as { axe: { run(): Promise<unknown> } }).axe.run()
  )) as AxeResult
  return r.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.length,
    sample: v.nodes[0]?.html.slice(0, 140)
  }))
}

/** Sin infracciones graves (critical/serious) en ningún estado de la interfaz. */
async function expectClean(): Promise<void> {
  const v = await violations()
  expect(v.filter((x) => x.impact === 'critical' || x.impact === 'serious')).toEqual([])
}

test('el shell no tiene infracciones graves de accesibilidad', async () => {
  await expectClean()
})

test('tampoco con visores divididos y paneles de capas y color', async () => {
  await page.keyboard.press('Control+Alt+v')
  await expect(page.locator('.pt-viewport')).toHaveCount(2)
  await page.locator('.pt-ptab', { hasText: 'Capas' }).click()
  await page.keyboard.press('Control+Shift+n')
  await page.locator('.pt-ptab', { hasText: 'Color' }).click()
  await expectClean()
})

test('ni con los diálogos de color y de atajos abiertos', async () => {
  await page.getByRole('button', { name: 'Ayuda' }).click()
  await page.getByRole('menuitem', { name: /Atajos de teclado/ }).click()
  await expect(page.getByRole('dialog', { name: 'Atajos de teclado' })).toBeVisible()
  await expectClean()
  await page.keyboard.press('Escape')
  await page.locator('.pt-fswidget__fill').dblclick({ position: { x: 4, y: 4 } })
  await expect(page.getByRole('dialog', { name: 'Selector de color' })).toBeVisible()
  await expectClean()
})
