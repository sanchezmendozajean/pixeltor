import type { PixeltorDocument } from '../../model/types'

// Cada migración sube una versión mayor: migrate_1_to_2(doc), etc. (specs/10).
// De momento solo existe el formato 1.x, así que no hay nada que migrar.
export function migrate(doc: PixeltorDocument): PixeltorDocument {
  return doc
}
