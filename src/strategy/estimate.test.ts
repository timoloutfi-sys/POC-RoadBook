import { describe, expect, it } from 'vitest'
import { defaultRider } from './rider'
import { estimateCourse } from './estimate'

describe('estimation d’une course sans GPX', () => {
  it('ultra 500 km, 4 200 m D+, vallonné : dans les repères validés (19–23 h de roulage, 22–27 h au total)', () => {
    const e = estimateCourse({ km: 500, dplus: 4200, terrain: 'vallonne' }, { ...defaultRider(), ftp: 240 }, '2027-04-10T06:00')
    expect(e.H).toBeGreaterThan(18); expect(e.H).toBeLessThan(25)
    expect(e.total).toBeGreaterThan(e.H)
    expect(e.nights).toBeGreaterThanOrEqual(1)
  })
  it('plus de dénivelé, plus long ; montagne plus lent que plat à D+ égal', () => {
    const r = { ...defaultRider(), ftp: 240 }
    const flat = estimateCourse({ km: 200, dplus: 500, terrain: 'plat' }, r, '2027-04-10T06:00')
    const hilly = estimateCourse({ km: 200, dplus: 3500, terrain: 'montagne' }, r, '2027-04-10T06:00')
    expect(hilly.H).toBeGreaterThan(flat.H * 1.1)
  })
})
