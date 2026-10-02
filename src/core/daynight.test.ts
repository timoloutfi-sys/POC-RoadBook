import { describe, expect, it } from 'vitest'
import { nightAmount } from './daynight'

const paris = [48.85, 2.35] as const
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 5, 21, h, m)) // 21 juin : lever ≈ 3 h 47, coucher ≈ 19 h 58 UTC

describe('jour et nuit', () => {
  it('plein jour et pleine nuit', () => {
    expect(nightAmount(at(12), ...paris)).toBe(0)
    expect(nightAmount(at(22), ...paris)).toBe(1)
    expect(nightAmount(at(1), ...paris)).toBe(1)
  })
  it('fondu de 15 min avant le coucher', () => {
    expect(nightAmount(at(19, 40), ...paris)).toBe(0)
    const mid = nightAmount(at(19, 50), ...paris)
    expect(mid).toBeGreaterThan(0.2)
    expect(mid).toBeLessThan(0.8)
    expect(nightAmount(at(20, 5), ...paris)).toBe(1)
  })
  it('fondu avant le lever', () => {
    expect(nightAmount(at(3, 25), ...paris)).toBe(1)
    const mid = nightAmount(at(3, 40), ...paris)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    expect(nightAmount(at(4, 5), ...paris)).toBe(0)
  })
  it('jour polaire : toujours jour', () => {
    expect(nightAmount(at(23), 80, 10)).toBe(0)
  })
})
