import { describe, expect, it } from 'vitest'
import { FORMAT_VERSION } from '@core/index'

describe('core', () => {
  it('expone la versión de formato semver', () => {
    expect(FORMAT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
