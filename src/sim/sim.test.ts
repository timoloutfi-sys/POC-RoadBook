import { describe, expect, it } from 'vitest'
import { buildRoute, demoPoints } from '../route/route'
import { targetAt } from '../strategy/target'
import { defaultBase } from '../strategy/types'
import { newSim, simStep, type SimParams } from './sim'

describe('coureur virtuel', () => {
  it('parcourt la boucle démo à une vitesse plausible', () => {
    const route = buildRoute('Démo', demoPoints())
    let seed = 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const P: SimParams = {
      route, body: { mass: 82, cda: 0.3 }, ftp: 240, lthr: 170, behavior: 0.3, rand,
      targetAt: (d, h) => targetAt(route, [], defaultBase(), 240, 170, d, h),
      ctx: { alerts: [], points: [], sections: [], periodic: [], maxPerHour: 10, source: 'power', now: 0 },
    }
    const sim = newSim()
    while (!sim.done && sim.t < 10 * 3600) simStep(sim, P)
    expect(sim.done).toBe(true)
    const kmh = route.total / sim.t * 3.6
    expect(kmh).toBeGreaterThan(24)
    expect(kmh).toBeLessThan(36)
    expect(sim.hr).toBeGreaterThan(120)
    expect(sim.hr).toBeLessThan(175)
  })
})
