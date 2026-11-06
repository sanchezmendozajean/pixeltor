import { app } from 'electron'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { BUILTIN_WORKSPACES, sanitizeWorkspaces } from '@shared/workspaces'
import { DEFAULT_SETTINGS, MAX_RECENT, type Settings, type ThemeId } from '@shared/ipc'

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
    if ((raw as Partial<Settings>).autoUpdate === false) out.autoUpdate = false
    const rf = (raw as Partial<Settings>).recentFiles
    if (Array.isArray(rf))
      out.recentFiles = rf
        .filter((p): p is string => typeof p === 'string' && p.length > 0 && p.length < 1024)
        .slice(0, MAX_RECENT)
    const dir = (raw as Partial<Settings>).lastOpenDir
    if (typeof dir === 'string' && dir.length < 1024) out.lastOpenDir = dir
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

/** Pone `path` el primero de los recientes (sin duplicados). */
export async function addRecent(path: string): Promise<void> {
  const rest = current.recentFiles.filter((p) => p !== path)
  await updateSettings({ recentFiles: [path, ...rest].slice(0, MAX_RECENT) })
}

export async function removeRecent(path: string): Promise<void> {
  if (current.recentFiles.includes(path))
    await updateSettings({ recentFiles: current.recentFiles.filter((p) => p !== path) })
}

/** Recuerda la carpeta de `filePath` para que el diálogo Abrir empiece ahí la próxima vez. */
export async function rememberOpenDir(filePath: string): Promise<void> {
  const dir = dirname(filePath)
  if (dir !== current.lastOpenDir) await updateSettings({ lastOpenDir: dir })
}

/** `defaultPath` para el diálogo Abrir: la última carpeta si todavía existe. */
export function openDialogDir(): string | undefined {
  const dir = current.lastOpenDir
  return dir && existsSync(dir) ? dir : undefined
}
