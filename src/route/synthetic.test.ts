import { describe, expect, it } from 'vitest'
import { findClimbs } from './route'
import { syntheticRoute } from './synthetic'

describe('parcours fictif', () => {
  for (const terrain of ['plat', 'vallonne', 'montagne'] as const) {
    it(`${terrain} : bonne longueur et bon dénivelé`, () => {
      const r = syntheticRoute('x', { km: 500, dplus: 4200, terrain })
      expect(r.synthetic).toBe(true)
      expect(r.total / 1000).toBeGreaterThan(499); expect(r.total / 1000).toBeLessThan(501)
      expect(r.dplus).toBeGreaterThan(4200 * 0.97); expect(r.dplus).toBeLessThan(4200 * 1.03)
      expect(Array.from(r.ele).every(Number.isFinite)).toBe(true)
    })
  }
  it('la montagne a de vrais cols, le plat n’en a pas', () => {
    expect(findClimbs(syntheticRoute('m', { km: 300, dplus: 6000, terrain: 'montagne' })).length).toBeGreaterThanOrEqual(3)
    expect(findClimbs(syntheticRoute('p', { km: 300, dplus: 600, terrain: 'plat' })).length).toBe(0)
  })
  it('garde des pentes réalistes', () => {
    const r = syntheticRoute('m', { km: 200, dplus: 3500, terrain: 'vallonne' })
    expect(Math.max(...Array.from(r.grade).map(Math.abs))).toBeLessThan(12)
  })
  it('un dénivelé nul donne une route plate', () => {
    const r = syntheticRoute('z', { km: 50, dplus: 0, terrain: 'plat' })
    expect(r.dplus).toBeLessThan(1)
  })
})
