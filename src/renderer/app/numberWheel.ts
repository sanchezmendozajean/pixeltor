/**
 * Rueda del ratón sobre un input numérico enfocado: ±1 (o su `step`),
 * Mayús ±10, Alt ±0,1 (solo en inputs con decimales). Respeta min/max y emite `input` y `change` para que v-model y @change reaccionen.
 */
function onWheel(e: WheelEvent): void {
  const el = document.activeElement
  if (!(el instanceof HTMLInputElement) || el.disabled || el.readOnly) return
  // type=number o texto con inputmode numérico (varios campos de los paneles son así)
  const numeric = el.type === 'number' || (el.type === 'text' && /^(numeric|decimal)$/.test(el.inputMode))
  if (!numeric) return
  if (e.target !== el) return
  // Con Mayús algunos sistemas convierten la rueda vertical en horizontal
  const delta = e.deltaY || e.deltaX
  if (!delta) return
  e.preventDefault()

  // Alt (0,1) solo si el input admite decimales (step="any" o fraccionario); si no, se ignora
  const stepNum = parseFloat(el.step)
  const decimals =
    el.inputMode === 'decimal' || el.step === 'any' || (stepNum > 0 && stepNum % 1 !== 0)
  const fine = e.altKey && decimals
  const base = e.shiftKey ? 10 : fine ? 0.1 : stepNum > 0 ? stepNum : 1
  const dir = delta < 0 ? 1 : -1
  const current = el.value === '' ? 0 : parseFloat(el.value)
  if (!Number.isFinite(current)) return

  let next = Math.round((current + dir * base) * 1e6) / 1e6
  const min = el.min !== '' ? parseFloat(el.min) : -Infinity
  const max = el.max !== '' ? parseFloat(el.max) : Infinity
  next = Math.min(max, Math.max(min, next))
  if (next === current && el.value !== '') return

  el.value = String(next)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

export function installNumberWheel(): void {
  document.addEventListener('wheel', onWheel, { passive: false })
}
