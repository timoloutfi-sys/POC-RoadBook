import { describe, expect, it } from 'vitest'
import { powerFor, secondsPerWatt, speedFor, VMAX } from './physics'

const b = { mass: 82, cda: 0.3 }

describe('modèle physique', () => {
  it('speedFor inverse powerFor', () => {
    for (const g of [-0.02, 0, 0.04, 0.08]) {
      const v = speedFor(b, 200, g)
      expect(powerFor(b, v, g)).toBeCloseTo(200, 0)
    }
  })
  it('vitesse plausible : ≈ 33 km/h à 200 W sur le plat', () => {
    const kmh = speedFor(b, 200, 0) * 3.6
    expect(kmh).toBeGreaterThan(30)
    expect(kmh).toBeLessThan(36)
  })
  it('plafonne à 60 km/h en descente', () => {
    expect(speedFor(b, 200, -0.08)).toBe(VMAX)
  })
  it('un watt rapporte plus en montée que sur le plat, et rien en descente rapide', () => {
    const up = secondsPerWatt(b, 220, 0.06, 1000)
    const flat = secondsPerWatt(b, 220, 0, 1000)
    const down = secondsPerWatt(b, 220, -0.07, 1000)
    expect(up).toBeGreaterThan(flat * 2)
    expect(down).toBe(0)
  })
})
