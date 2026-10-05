import { describe, expect, it } from 'vitest'
import { Position } from './position'

describe('position fluide', () => {
  it('avance avec la vitesse entre deux fixes', () => {
    const p = new Position(); p.step(1, 8); p.step(1, 8)
    expect(p.d).toBeCloseTo(16)
  })
  it('résorbe un écart en 3 s, sans saut', () => {
    const p = new Position(); p.fix(0); p.step(1, 10)
    p.fix(p.d + 15)
    const a = p.step(1, 10)
    expect(a - 10).toBeCloseTo(15, -1) // 10 de vitesse + 5 de rattrapage
    p.step(1, 10); const c = p.step(1, 10)
    expect(c).toBeCloseTo(10 + 15 + 30 + 0, 0)
  })
  it('ne recule jamais pour un petit écart négatif', () => {
    const p = new Position(); p.step(1, 10); let prev = p.d
    p.fix(p.d - 25)
    for (let i = 0; i < 5; i++) { const d = p.step(1, 10); expect(d).toBeGreaterThanOrEqual(prev); prev = d }
  })
  it('saute au-delà de 100 m', () => {
    const p = new Position(); p.step(1, 10); p.fix(5000)
    expect(p.d).toBe(5000)
  })
  it('s’arrête à la fin du parcours', () => {
    const p = new Position(100); p.step(1, 200)
    expect(p.d).toBe(100)
  })
})
