import { describe, expect, it } from 'vitest'
import { buildRoute, demoPoints } from '../route/route'
import { syntheticRoute } from '../route/synthetic'
import { computePlan, defaultPlanCfg } from './plan'
import { suggestPlan, suggestedMinutes, type Intent } from './suggest'

const route = buildRoute('Démo', demoPoints())
const inp = (unit: 'power' | 'hr' = 'power') => ({ route, body: { mass: 82, cda: 0.32, crr: 0.005 }, ftp: 240, unit, cfg: { ...defaultPlanCfg(), start: '2026-06-20T08:00' } })

describe('suggestion de plan', () => {
  it('course : cibles simples dont l’estimation reste proche du plan de course complet', () => {
    const s = suggestPlan(inp(), 'course')
    expect(s.manual.montee[1]).toBeGreaterThan(s.manual.plat[1])
    expect(s.manual.plat[0]).toBeGreaterThan(55)
    expect(s.manual.plat[1]).toBeLessThan(90)
    const full = computePlan({ ...inp(), cfg: { ...inp().cfg, mode: 'course' } })
    const est = computePlan({ ...inp(), cfg: { ...inp().cfg, mode: 'manuel', manual: s.manual, imposed: s.imposed } })
    expect(Math.abs(est.H - full.H) / full.H).toBeLessThan(0.08)
  })
  it('endurance : zone 2, aucune cible par tronçon', () => {
    const s = suggestPlan(inp(), 'endurance')
    expect(s.imposed).toHaveLength(0)
    expect(s.manual.plat).toEqual([65, 72])
  })
  it('seuil : des blocs Z4 modifiables, pour le temps demandé', () => {
    const s = suggestPlan(inp(), 'seuil', 30)
    expect(s.imposed.length).toBeGreaterThan(0)
    expect(s.imposed.every(x => x.locked && x.name.startsWith('Seuil') && x.min >= 90 && x.max <= 105)).toBe(true)
    const total = s.imposed.reduce((a, x) => a + (x.b - x.a), 0)
    expect(total).toBeGreaterThan(0)
  })
  it('les blocs suggérés se retrouvent dans l’estimation du plan', () => {
    const s = suggestPlan(inp(), 'tempo', 40)
    const r = computePlan({ ...inp(), cfg: { ...inp().cfg, mode: 'manuel', manual: s.manual, imposed: s.imposed } })
    expect(r.zt[2]).toBeGreaterThan(30 * 60)
  })
  it('progressive : trois tiers contigus Z2, Z3, Z4', () => {
    const s = suggestPlan(inp(), 'progressive')
    expect(s.imposed).toHaveLength(3)
    expect(s.imposed[0].a).toBe(0)
    expect(s.imposed[1].a).toBeCloseTo(s.imposed[0].b, 1)
    expect(s.imposed[2].min).toBeGreaterThan(s.imposed[1].min)
  })
  it('VO2max en cardio : retombe sur le seuil, jamais de Z5', () => {
    const s = suggestPlan(inp('hr'), 'vo2max')
    expect(s.imposed.every(x => x.name.startsWith('Seuil'))).toBe(true)
    expect(s.note).toMatch(/seuil/)
  })
  it('les minutes proposées respectent les limites', () => {
    expect(suggestedMinutes('seuil', 1)).toBeLessThanOrEqual(30)
    expect(suggestedMinutes('vo2max', 5)).toBeLessThanOrEqual(20)
    expect(suggestedMinutes('course' as Intent, 5)).toBe(0)
  })

  it('les efforts sont répartis sur le parcours, jamais collés (bug du 7 oct. : gros bloc en seuil)', () => {
    const hilly = { ...inp(), route: syntheticRoute('x', { km: 50, dplus: 650, terrain: 'vallonne' }) }
    const s = suggestPlan(hilly, 'seuil', 60)
    const b = [...s.imposed].sort((x, y) => x.a - y.a)
    expect(b.length).toBeGreaterThanOrEqual(3)
    for (let i = 1; i < b.length; i++) expect(b[i].a - b[i - 1].b).toBeGreaterThan(2.5) // de la récupération entre deux blocs
    const d = suggestPlan(inp(), 'seuil', 60).imposed.sort((x, y) => x.a - y.a)
    for (let i = 1; i < d.length; i++) expect(d[i].a - d[i - 1].b).toBeGreaterThan(8)
  })
  it('tempo sur un parcours vallonné : place des blocs malgré les descentes', () => {
    const hilly = { ...inp(), route: syntheticRoute('x', { km: 50, dplus: 650, terrain: 'vallonne' }) }
    expect(suggestPlan(hilly, 'tempo').imposed.length).toBeGreaterThan(0)
  })
})
