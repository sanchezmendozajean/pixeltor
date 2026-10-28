const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Generador de IDs de 10 caracteres. `rng` inyectable para pruebas deterministas. */
export function newId(rng: () => number = Math.random): string {
  let s = ''
  for (let i = 0; i < 10; i++) s += ALPHABET[Math.floor(rng() * ALPHABET.length)]
  return s
}
