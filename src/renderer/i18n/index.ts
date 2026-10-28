import es from './es.json'

type Dict = typeof es

/** Claves de la forma `seccion.clave`, derivadas de es.json. */
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>
}[keyof T & string]

export type I18nKey = Paths<Dict>

const dict: Record<string, unknown> = es

/** Traducción mínima (UI en español; el inglés llega con en.json). Admite `{nombre}`. */
export function t(key: I18nKey, params?: Record<string, string | number>): string {
  let node: unknown = dict
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part]
  }
  let text = typeof node === 'string' ? node : key
  if (params)
    for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v))
  return text
}
