import { app } from 'electron'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, type Settings, type ThemeId } from '@shared/ipc'

const THEMES: ThemeId[] = ['oscuro', 'gris', 'claro']

let current: Settings = { ...DEFAULT_SETTINGS }

function file(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function sanitize(raw: unknown): Settings {
  const out = { ...DEFAULT_SETTINGS }
  if (raw && typeof raw === 'object') {
    const theme = (raw as Partial<Settings>).theme
    if (theme && THEMES.includes(theme)) out.theme = theme
  }
  return out
}

export async function loadSettings(): Promise<Settings> {
  try {
    current = sanitize(JSON.parse(await readFile(file(), 'utf8')))
  } catch {
    current = { ...DEFAULT_SETTINGS }
  }
  return current
}

export function getSettings(): Settings {
  return current
}

/** Guardado atómico: escribe en .tmp y renombra. */
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  current = sanitize({ ...current, ...patch })
  const tmp = `${file()}.tmp`
  await writeFile(tmp, JSON.stringify(current, null, 2), 'utf8')
  await rename(tmp, file())
  return current
}
