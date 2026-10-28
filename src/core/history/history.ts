// Historial deshacible por documento (specs/11).

export interface HistoryCommand<S> {
  label: string
  /** Bytes aproximados que retiene en memoria. */
  memorySize: number
  /** Si dos comandos consecutivos comparten clave (y llegan en < 1 s) se fusionan. */
  mergeKey?: string
  time: number
  redo(s: S): void
  undo(s: S): void
  /** Fusiona `next` en este comando; devuelve false si no es posible. */
  mergeWith?(next: HistoryCommand<S>): boolean
}

export interface HistoryLimits {
  maxSteps: number
  maxBytes: number
}

export const DEFAULT_LIMITS: HistoryLimits = { maxSteps: 200, maxBytes: 512 * 1024 * 1024 }
const MERGE_WINDOW_MS = 1000

export class History<S> {
  private stack: HistoryCommand<S>[] = []
  /** Número de comandos aplicados (los de índice >= cursor están "deshechos"). */
  private cursor = 0
  /** Cursor en el último guardado; -1 si ese estado ya no es alcanzable. */
  private savedCursor = 0
  limits: HistoryLimits

  constructor(
    private readonly state: S,
    limits: Partial<HistoryLimits> = {}
  ) {
    this.limits = { ...DEFAULT_LIMITS, ...limits }
  }

  get entries(): readonly HistoryCommand<S>[] {
    return this.stack
  }
  get position(): number {
    return this.cursor
  }
  get canUndo(): boolean {
    return this.cursor > 0
  }
  get canRedo(): boolean {
    return this.cursor < this.stack.length
  }
  get isDirty(): boolean {
    return this.savedCursor !== this.cursor
  }
  get totalBytes(): number {
    return this.stack.reduce((n, c) => n + c.memorySize, 0)
  }

  markSaved(): void {
    this.savedCursor = this.cursor
  }

  /** Registra un comando cuyo efecto YA está aplicado (trazos en vivo). */
  record(cmd: HistoryCommand<S>): void {
    if (this.savedCursor > this.cursor) this.savedCursor = -1
    this.stack.length = this.cursor
    const last = this.stack[this.cursor - 1]
    if (
      last &&
      cmd.mergeKey &&
      last.mergeKey === cmd.mergeKey &&
      cmd.time - last.time < MERGE_WINDOW_MS &&
      this.savedCursor !== this.cursor &&
      last.mergeWith?.(cmd)
    ) {
      last.time = cmd.time
      return
    }
    this.stack.push(cmd)
    this.cursor = this.stack.length
    this.trim()
  }

  run(cmd: HistoryCommand<S>): void {
    cmd.redo(this.state)
    this.record(cmd)
  }

  undo(): HistoryCommand<S> | null {
    if (!this.canUndo) return null
    const c = this.stack[--this.cursor]!
    c.undo(this.state)
    return c
  }

  redo(): HistoryCommand<S> | null {
    if (!this.canRedo) return null
    const c = this.stack[this.cursor++]!
    c.redo(this.state)
    return c
  }

  /** Vuelve al estado tras `position` comandos aplicados (0 = original). */
  goTo(position: number): void {
    const target = Math.max(0, Math.min(this.stack.length, position))
    while (this.cursor > target) this.undo()
    while (this.cursor < target) this.redo()
  }

  clear(): void {
    this.stack = []
    this.cursor = 0
    this.savedCursor = 0
  }

  private trim(): void {
    let drop = 0
    let bytes = this.totalBytes
    while (
      this.stack.length - drop > 1 &&
      (this.stack.length - drop > this.limits.maxSteps || bytes > this.limits.maxBytes)
    ) {
      bytes -= this.stack[drop]!.memorySize
      drop++
    }
    if (drop > 0) {
      this.stack.splice(0, drop)
      this.cursor -= drop
      if (this.savedCursor >= 0) this.savedCursor -= drop
      if (this.savedCursor < 0 || this.savedCursor > this.stack.length) this.savedCursor = -1
    }
  }
}
