import { describe, expect, it } from 'vitest'
import { DocumentSession, addGuide, evalExpr, evalGuideExpr, setGuidePos } from '@core/index'

describe('posición de guías por expresión', () => {
  it('números, porcentajes y operaciones; siempre enteros', () => {
    expect(evalGuideExpr('40', 200)).toBe(40)
    expect(evalGuideExpr('40px', 200)).toBe(40)
    expect(evalGuideExpr('50%', 200)).toBe(100)
    expect(evalGuideExpr('100%', 200)).toBe(200)
    expect(evalGuideExpr('100% - 10', 200)).toBe(190)
    expect(evalGuideExpr('100% - 10px', 200)).toBe(190)
    expect(evalGuideExpr('25% + 4', 200)).toBe(54)
    expect(evalGuideExpr('50 %', 33)).toBe(17) // 16,5 → 17
    expect(evalGuideExpr('33.3%', 100)).toBe(33)
    expect(evalGuideExpr('(100% - 10) / 2', 200)).toBe(95)
    expect(evalGuideExpr('-5', 200)).toBe(-5)
    expect(evalGuideExpr('10,5', 200)).toBe(11)
  })

  it('rechaza expresiones no válidas', () => {
    for (const bad of ['', 'abc', '10 +', '(10', '10)', '5 5', '%', '1/0', '10 * ']) {
      expect(evalGuideExpr(bad, 100), bad).toBeNull()
    }
  })

  it('setGuidePos mueve la guía en un solo paso deshacible', () => {
    const s = DocumentSession.create(64, 32)
    const id = addGuide(s, 'v', 10)
    expect(setGuidePos(s, id, 30.4)).toBe(true)
    expect(s.image.guides![0]!.pos).toBe(30)
    expect(setGuidePos(s, id, 30)).toBe(false)
    s.undo()
    expect(s.image.guides![0]!.pos).toBe(10)
  })
})

describe('evalExpr (campos numéricos)', () => {
  it('evalúa operaciones sin porcentajes', () => {
    expect(evalExpr('30-5')).toBe(25)
    expect(evalExpr('(10+4)*2')).toBe(28)
    expect(evalExpr('100/3')).toBe(33)
    expect(evalExpr('50%')).toBeNull()
    expect(evalExpr('abc')).toBeNull()
  })
})
