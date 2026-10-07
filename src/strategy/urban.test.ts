import { describe, expect, it } from 'vitest'
import { buildRoute, demoPoints } from '../route/route'
import { computePlan, defaultPlanCfg } from './plan'

const route = buildRoute('Démo', demoPoints())
const seg = (a: number, b: number, kmh?: number) => ({ id: 's', kind: 'zone' as const, name: '', a, b, min: 55, max: 75, msg: '', avant: 1, locked: true, urbanKmh: kmh })
const run = (imposed: ReturnType<typeof seg>[] = []) =>
  computePlan({ route, body: { mass: 82, cda: 0.32, crr: 0.005 }, ftp: 240, unit: 'power', cfg: { ...defaultPlanCfg(), start: '2026-06-20T08:00', imposed } })

describe('traversées de ville', () => {
  it('imposent une vitesse moyenne maximale sur leurs km et rallongent le plan', () => {
    const free = run([seg(0, 15)]), city = run([seg(0, 15, 15)])
    expect(city.H).toBeGreaterThan(free.H + 0.1)
    // 15 km à 15 km/h = 1 h au moins, plus le reste du parcours
    expect(city.H * 3600).toBeGreaterThan(3600 + (route.total / 1000 - 15) / 40 * 3600 * 0.5)
  })
  it('un parcours sans ville n’est pas modifié', () => {
    expect(run([seg(0, 15)]).H).toBe(run([seg(0, 15, undefined)]).H)
  })
})
