import { describe, expect, it } from 'vitest'
import { sunTimes } from './sun'

describe('soleil', () => {
  it('Paris, 21 juin : lever vers 3 h 47 UTC, coucher vers 19 h 58 UTC', () => {
    const { rise, set } = sunTimes(new Date(Date.UTC(2026, 5, 21, 12)), 48.85, 2.35)
    expect(rise!.getUTCHours() * 60 + rise!.getUTCMinutes()).toBeGreaterThan(3 * 60 + 35)
    expect(rise!.getUTCHours() * 60 + rise!.getUTCMinutes()).toBeLessThan(4 * 60)
    expect(set!.getUTCHours() * 60 + set!.getUTCMinutes()).toBeGreaterThan(19 * 60 + 45)
    expect(set!.getUTCHours() * 60 + set!.getUTCMinutes()).toBeLessThan(20 * 60 + 10)
  })
})
