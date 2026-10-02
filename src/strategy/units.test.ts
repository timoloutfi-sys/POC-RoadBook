import { describe, expect, it } from 'vitest'
import { pctToValue, valueToPct } from './units'
import { HR_ZONES, hrRatioForPowerRatio, powerRatioForHrRatio, zoneBandPct } from './zones'

describe('unités de pilotage', () => {
  it('la conversion FC → puissance inverse bien la conversion puissance → FC', () => {
    for (const p of [0.5, 0.65, 0.8, 0.95, 1.1]) expect(powerRatioForHrRatio(hrRatioForPowerRatio(p))).toBeCloseTo(p, 2)
  })
  it('valeur ↔ % FTP en puissance et en cardio', () => {
    expect(pctToValue(75, 'power', 240, 170)).toBe(180)
    expect(valueToPct(180, 'power', 240, 170)).toBe(75)
    const bpm = pctToValue(75, 'hr', 240, 170)!
    expect(bpm).toBeGreaterThan(130)
    expect(bpm).toBeLessThan(150)
    expect(valueToPct(bpm, 'hr', 240, 170)).toBeCloseTo(75, -1)
  })
  it('sans FC seuil, pas de bpm', () => {
    expect(pctToValue(75, 'hr', 240, null)).toBeNull()
    expect(valueToPct(140, 'hr', 240, null)).toBeNull()
  })
  it('les zones choisies en cardio donnent des bandes de puissance cohérentes et ordonnées', () => {
    let prevHi = 0
    for (let z = 0; z < HR_ZONES.length; z++) {
      const [lo, hi] = zoneBandPct(z, 'hr')
      expect(lo).toBeLessThan(hi)
      expect(lo).toBeGreaterThanOrEqual(prevHi - 3)
      prevHi = hi
    }
    // Z2 cardio ≈ Z2 puissance (55–75 % FTP)
    const [lo, hi] = zoneBandPct(1, 'hr')
    expect(lo).toBeGreaterThanOrEqual(50)
    expect(hi).toBeLessThanOrEqual(80)
  })
  it('bandes de zones de puissance recadrées', () => {
    expect(zoneBandPct(0, 'power')[0]).toBe(40)
    expect(zoneBandPct(6, 'power')[1]).toBe(180)
    expect(zoneBandPct(3, 'power')).toEqual([90, 105])
  })
})
