import { describe, expect, it } from 'vitest'
import { analyze } from './analysis'
import type { Ride, RideChunk } from './types'

const N = 7200
const col = <A extends Float32Array | Float64Array | Uint8Array>(C: new (n: number) => A, f: (i: number) => number) => { const a = new C(N); for (let i = 0; i < N; i++) a[i] = f(i); return a }
const chunk: RideChunk = {
  rideId: 'r', seq: 0, t: col(Float64Array, i => 1e12 + i * 1000), km: col(Float32Array, i => (i * 30) / 3600), speed: col(Float32Array, () => 8.3),
  power: col(Float32Array, () => 200), hr: col(Float32Array, i => 130 + (i / N) * 20), cad: col(Float32Array, () => 80), ele: col(Float32Array, () => 100),
  moving: col(Uint8Array, i => (i >= 3000 && i < 3600 ? 0 : 1)), tgt: col(Uint8Array, () => 1),
}
const ride = (over: Partial<Ride> = {}): Ride => ({
  id: 'r', name: 'x', kind: 'roadbook', start: 1e12, end: 1e12 + N * 1000, summary: null, events: [],
  riderSnapshot: { ftp: 250, mass: 80, cda: 0.3, lthr: 165, unit: 'power' },
  planSnapshot: { sections: [], points: [{ id: 'p', type: 'ravito', km: 25, text: 'Ravito', avant: 1 }], base: { plat: [65, 72], montee: [75, 90], descente: [0, 60], gUp: 3.5, gDown: -3 }, plan: null, etas: [{ km: 0, t: 0 }, { km: 60, t: 7000 }] },
  ...over,
})

describe('analyse d’une sortie', () => {
  it('compare l’heure prévue et réelle au point, et relève l’arrêt fait', () => {
    const a = analyze(ride({ events: [{ t: 1e12 + 3000e3, km: 25, type: 'stop' }, { t: 1e12 + 3600e3, km: 25, type: 'resume' }] }), [chunk], null)
    const r = a.rows[0]
    expect(r.label).toBe('Ravito')
    expect(r.actual).toBeCloseTo(3000, -1)
    expect(r.planned).toBeCloseTo((25 / 60) * 7000, 0)
    expect(r.stopS).toBe(600)
  })
  it('range le temps par zone de puissance (200 W / 250 W = 80 % → Z3), arrêts exclus', () => {
    const a = analyze(ride(), [chunk], null)
    expect(a.zones.real[2]).toBe(N - 600)
    expect(a.zones.plan).toBeNull()
  })
  it('mesure la dérive cardiaque et la cadence', () => {
    const a = analyze(ride(), [chunk], null)
    expect(a.drift).toBeGreaterThan(5); expect(a.drift).toBeLessThan(20)
    expect(a.cad).toBe(80)
  })
  it('en cardio, range par zone de FC', () => {
    const a = analyze(ride({ riderSnapshot: { ftp: 250, mass: 80, cda: 0.3, lthr: 165, unit: 'hr' } }), [chunk], null)
    expect(a.zones.real.length).toBe(5)
    expect(a.zones.real.reduce((x, y) => x + y, 0)).toBe(N - 600)
  })
  it('donne une courbe sur la distance, sans cible quand le parcours manque', () => {
    const a = analyze(ride(), [chunk], null)
    expect(a.series.length).toBeGreaterThan(100)
    expect(a.series[10].value).toBe(200); expect(a.series[10].lo).toBeNull()
  })
})
