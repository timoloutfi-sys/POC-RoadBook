import { describe, expect, it } from 'vitest'
import { buildRoute, demoPoints, STEP } from '../route/route'
import { plannedStops } from './sync'
import { timeline } from './timeline'

const route = buildRoute('t', demoPoints())
const n = Math.round(route.total / STEP) + 1
// 30 km/h constant
const cumT = Float64Array.from({ length: n }, (_, i) => (i * STEP) / (30 / 3.6))
const start = new Date('2027-04-10T08:00:00')
const pt = (id: string, km: number, stop?: number) => ({ id, type: 'ravito' as const, km, text: id, avant: 1, stop })

describe('liste chronologique', () => {
  it('ordonne départ, points, repères, arrivée, avec des heures croissantes', () => {
    const rows = timeline({
      route, res: { cumT, H: cumT[n - 1] / 3600, stops: 0 }, start,
      points: [pt('b', 60), pt('a', 20)],
      marks: [{ id: 'm', kind: 'zone', name: 'Vent', a: 40, b: 50, min: 0, max: 0, mark: true, msg: '', avant: 1 }],
    })
    expect(rows.map(r => r.id)).toEqual(['start', 'a', 'm', 'b', 'end'])
    expect(rows[1].at!.getTime() - start.getTime()).toBeCloseTo((20 / 30) * 3600e3, -3)
    expect(rows.every((r, i) => i === 0 || r.at! >= rows[i - 1].at!)).toBe(true)
  })
  it('un arrêt prévu décale les heures suivantes, pas la sienne', () => {
    const base = { route, res: { cumT, H: cumT[n - 1] / 3600, stops: 0 }, start, marks: [] }
    const a = timeline({ ...base, points: [pt('a', 20), pt('b', 60)] })
    const b = timeline({ ...base, points: [pt('a', 20, 15), pt('b', 60)] })
    expect(b[1].at).toEqual(a[1].at)
    expect(b[2].at!.getTime() - a[2].at!.getTime()).toBe(15 * 60e3)
    expect(b[3].at!.getTime() - a[3].at!.getTime()).toBe(15 * 60e3)
    expect(b[2].gapS).toBeCloseTo(a[2].gapS!, 0) // temps de route inchangé
  })
  it('sans arrêt prévu, répartit l’estimation générique', () => {
    const H = cumT[n - 1] / 3600
    const rows = timeline({ route, res: { cumT, H, stops: 60 }, start, points: [], marks: [] })
    expect(rows[1].at!.getTime() - start.getTime()).toBeCloseTo((H + 1) * 3600e3, -3)
  })
  it('somme les arrêts prévus, hors points générés', () => {
    expect(plannedStops([{ stop: 10 }, { stop: 5 }, { stop: 99, gen: true }, {}])).toBe(15)
  })
})
