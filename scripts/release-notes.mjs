// Extrae de CHANGELOG.md la sección de una versión: node scripts/release-notes.mjs 0.8.1
import { readFileSync } from 'node:fs'

const version = (process.argv[2] ?? '').replace(/^v/, '')
const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split(/\r?\n/)
const start = lines.findIndex((l) => l.startsWith(`## [${version}]`))
if (start < 0) {
  console.error(`No hay sección ${version} en CHANGELOG.md`)
  process.exit(1)
}
let end = lines.findIndex((l, i) => i > start && l.startsWith('## ['))
if (end < 0) end = lines.length
console.log(lines.slice(start + 1, end).join('\n').trim())
