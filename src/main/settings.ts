import { app } from 'electron'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BUILTIN_WORKSPACES, sanitizeWorkspaces } from '@shared/workspaces'
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
    const cols = (raw as Partial<Settings>).toolbarColumns
    if (cols === 1 || cols === 2) out.toolbarColumns = cols
    out.workspaces = sanitizeWorkspaces((raw as Partial<Settings>).workspaces)
    const active = (raw as Partial<Settings>).activeWorkspace
    if (
      typeof active === 'string' &&
      (BUILTIN_WORKSPACES.some((b) => b.id === active) ||
        out.workspaces.some((w) => w.id === active))
    )
      out.activeWorkspace = active
    const scale = (raw as Partial<Settings>).uiScale
    if (typeof scale === 'number' && scale >= 0.75 && scale <= 2) out.uiScale = scale
    const sc = (raw as Partial<Settings>).shortcuts
    out.shortcuts = {}
    if (sc && typeof sc === 'object')
      for (const [id, v] of Object.entries(sc))
        if (id.length <= 64 && typeof v === 'string' && v.length <= 40) out.shortcuts[id] = v
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
let writing: Promise<unknown> = Promise.resolve()

export function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  current = sanitize({ ...current, ...patch })
  const snapshot = JSON.stringify(current, null, 2)
  const result = current
  // las escrituras se encadenan: dos cambios seguidos compartirían el mismo .tmp y el segundo
  // renombrado fallaría
  const run = async (): Promise<Settings> => {
    const tmp = `${file()}.tmp`
    await writeFile(tmp, snapshot, 'utf8')
    await rename(tmp, file())
    return result
  }
  const next = writing.then(run, run)
  writing = next.catch(() => undefined)
  return next
}
