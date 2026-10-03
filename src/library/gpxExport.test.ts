// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { rideToGpx } from './gpxExport'
import { parseGPX } from '../route/gpx'
import type { Ride, RideChunk } from './types'

const N = 20
const f = <A extends Float32Array | Float64Array | Uint8Array>(C: new (n: number) => A, g: (i: number) => number) => { const a = new C(N); for (let i = 0; i < N; i++) a[i] = g(i); return a }
const chunk = (withGps: boolean): RideChunk => ({
  rideId: 'r', seq: 0, t: f(Float64Array, i => Date.UTC(2027, 3, 10, 6, 0, i)), km: f(Float32Array, i => i / 100), speed: f(Float32Array, () => 8),
  power: f(Float32Array, i => (i === 3 ? NaN : 200)), hr: f(Float32Array, () => 140), cad: f(Float32Array, () => 85), ele: f(Float32Array, () => 100),
  lat: f(Float64Array, i => (withGps ? 49.19 + i * 1e-4 : NaN)), lon: f(Float64Array, () => 2.47), moving: f(Uint8Array, () => 1), tgt: f(Uint8Array, () => 1),
})
const ride = { id: 'r', name: 'Sortie <test> & co', kind: 'libre', start: Date.UTC(2027, 3, 10, 6), end: null, summary: null, events: [], riderSnapshot: { ftp: 240, mass: 80, cda: 0.3, lthr: null, unit: 'power' } } as Ride

describe('export GPX', () => {
  it('écrit les positions, l’heure et les capteurs, et se relit', () => {
    const g = rideToGpx(ride, [chunk(true)])!
    expect(g).toContain('<power>200</power>')
    expect(g).toContain('<gpxtpx:hr>140</gpxtpx:hr>')
    expect(g).toContain('Sortie &lt;test&gt; &amp; co')
    expect((g.match(/<trkpt/g) ?? []).length).toBe(N)
    expect(parseGPX(g).pts.length).toBe(N)
  })
  it('refuse une sortie sans aucune position', () => {
    expect(rideToGpx(ride, [chunk(false)])).toBeNull()
  })
})
