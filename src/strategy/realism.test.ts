import { describe, expect, it } from 'vitest'
import { buildRoute } from '../route/route'
import { computePlan, defaultPlanCfg, type PlanCfg } from './plan'
import { estimateStops, ifForDuration } from './realism'

/** Parcours synthétique : `km` de long, collines de `amp` m tous les `period` km, légères courbes. */
const hilly = (km: number, amp: number, period: number) => {
  const n = Math.round(km * 10)
  return buildRoute('s', Array.from({ length: n + 1 }, (_, i) => {
    const m = i * 100, a = (m / 1000 / period) * 2 * Math.PI
    return { lat: 45 + m / 111320, lon: 2 + Math.sin(m / 3000) * 0.002, ele: 200 + amp * (Math.sin(a) + 0.4 * Math.sin(2.7 * a + 1)) }
  }))
}
const plan = (route: ReturnType<typeof hilly>, rider: { ftp: number; mass: number; cda: number }, cfg: Partial<PlanCfg>) =>
  computePlan({ route, body: { mass: rider.mass, cda: rider.cda, crr: 0.005 }, ftp: rider.ftp, unit: 'power', cfg: { ...defaultPlanCfg(), ...cfg } })

describe('scénarios réalistes', () => {
  it('sortie tranquille de 80 km peu vallonnée : 27 à 31 km/h pour 240 W de FTP', () => {
    const p = plan(hilly(80, 15, 8), { ftp: 240, mass: 82, cda: 0.32 }, { mode: 'tranquille' })
    expect(p.vavg).toBeGreaterThan(26.5)
    expect(p.vavg).toBeLessThan(31)
    expect(p.stops).toBe(0)
  })
  it('cyclosportive de 120 km et ~2000 m de D+ : 25 à 30 km/h, IF 0,76 à 0,84', () => {
    const r = hilly(120, 65, 10)
    expect(r.dplus).toBeGreaterThan(1700)
    expect(r.dplus).toBeLessThan(2300)
    const p = plan(r, { ftp: 250, mass: 78, cda: 0.32 }, { mode: 'course' })
    expect(p.vavg).toBeGreaterThan(23)
    expect(p.vavg).toBeLessThan(29)
    expect(p.IF).toBeGreaterThan(0.75)
    expect(p.IF).toBeLessThan(0.85)
    expect(p.range[0]).toBeLessThan(p.H)
    expect(p.range[1]).toBeGreaterThan(p.H)
  })
  it('ultra de 500 km (type Race Across Paris) : 19 à 23 h de roulage, 22 à 27 h au total', () => {
    const r = hilly(500, 60, 12)
    const p = plan(r, { ftp: 240, mass: 85, cda: 0.33 }, { mode: 'course', start: '2027-04-10T06:00' })
    expect(p.H).toBeGreaterThan(18.5)
    expect(p.H).toBeLessThan(23)
    expect(p.total).toBeGreaterThan(21.5)
    expect(p.total).toBeLessThan(27)
    expect(p.IF).toBeGreaterThan(0.55)
    expect(p.IF).toBeLessThan(0.66)
    expect(p.stops).toBeGreaterThan(150)
    expect(p.points.some(x => /éclairage/i.test(x.text))).toBe(true)
  })
})

describe('repères de durée', () => {
  it('intensité tenable', () => {
    expect(ifForDuration(1)).toBeCloseTo(0.97, 2)
    expect(ifForDuration(4)).toBeGreaterThan(0.78)
    expect(ifForDuration(24)).toBeGreaterThan(0.56)
    expect(ifForDuration(24)).toBeLessThan(0.62)
  })
  it('arrêts : rien sur une courte sortie, des heures sur un ultra', () => {
    expect(estimateStops(2)).toBe(0)
    expect(estimateStops(5)).toBe(20)
    expect(estimateStops(20, 1)).toBeGreaterThan(180)
  })
  it('course à intensité imposée : la puissance normalisée simulée tient la cible malgré les descentes', () => {
    const r = hilly(150, 120, 12)
    const p = plan(r, { ftp: 250, mass: 78, cda: 0.32 }, { mode: 'course', intensity: 78 })
    expect(Math.abs(p.IF - 0.78)).toBeLessThan(0.02)
  })
  it('arrêts d’un ultra : 12 min/h au-delà de 16 h, 45 min par nuit', () => {
    expect(estimateStops(20, 1)).toBe(20 * 12 + 45)
  })
  it('fourchette : au moins ±4 % sur une sortie courte', () => {
    const a = plan(hilly(60, 20, 6), { ftp: 250, mass: 78, cda: 0.32 }, { mode: 'course' })
    expect(a.range[0]).toBeLessThanOrEqual(a.H * 0.96)
    expect(a.range[1]).toBeGreaterThanOrEqual(a.H * 1.04)
  })
})
