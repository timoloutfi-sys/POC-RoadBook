import { describe, expect, it } from 'vitest'
import { plannedAt, summarize } from './summary'
import type { RideChunk } from './types'

/** Une sortie synthétique à 1 Hz : n secondes à 30 km/h, 200 W, 140 bpm. */
function chunk(seq: number, n: number, over: Partial<Record<keyof RideChunk, (i: number) => number>> = {}): RideChunk {
  const mk = <A extends Float32Array | Float64Array | Uint8Array>(Ctor: new (n: number) => A, k: keyof RideChunk, d: (i: number) => number): A => {
    const a = new Ctor(n)
    for (let i = 0; i < n; i++) a[i] = (over[k] ?? d)(seq * n + i)
    return a
  }
  return {
    rideId: 'r', seq,
    t: mk(Float64Array, 't', i => i * 1000), km: mk(Float32Array, 'km', i => (i * 30) / 3600),
    speed: mk(Float32Array, 'speed', () => 8.33), power: mk(Float32Array, 'power', () => 200), hr: mk(Float32Array, 'hr', () => 140),
    cad: mk(Float32Array, 'cad', () => 85), ele: mk(Float32Array, 'ele', () => 100),
    moving: mk(Uint8Array, 'moving', () => 1), tgt: mk(Uint8Array, 'tgt', () => 1),
  }
}

describe('résumé d’une sortie', () => {
  it('calcule distance, temps, puissance et FC sur plusieurs morceaux', () => {
    const s = summarize([chunk(0, 1800), chunk(1, 1800)])
    expect(s.km).toBeCloseTo(30, 0)
    expect(s.moving).toBe(3600)
    expect(s.total).toBeCloseTo(3600, 0)
    expect(s.avgP).toBe(200); expect(s.np).toBeCloseTo(200, 3); expect(s.avgHr).toBe(140)
    expect(s.kcal).toBe(720)
    expect(s.inTarget).toBe(100)
  })
  it('ne compte pas les arrêts dans le roulage mais dans le temps total', () => {
    const s = summarize([chunk(0, 1000, { moving: i => (i < 600 ? 1 : 0), power: i => (i < 600 ? 200 : NaN) })])
    expect(s.moving).toBe(600); expect(s.total).toBeCloseTo(1000, 0); expect(s.avgP).toBe(200)
  })
  it('mesure le temps dans la cible et ignore les secondes sans cible', () => {
    const s = summarize([chunk(0, 100, { tgt: i => (i < 20 ? 0 : i < 60 ? 1 : 2) })])
    expect(s.inTarget).toBeCloseTo(50, 5)
  })
  it('compte le dénivelé sur une altitude lissée, pas le bruit', () => {
    const noisy = summarize([chunk(0, 600, { ele: i => 100 + (i % 2 ? 1 : -1) })])
    expect(noisy.dplus).toBeLessThan(5)
    const climb = summarize([chunk(0, 600, { ele: i => 100 + i * 0.1 })])
    expect(climb.dplus).toBeGreaterThan(50); expect(climb.dplus).toBeLessThan(65)
  })
  it('donne l’écart au plan : positif = retard', () => {
    const etas = [{ km: 0, t: 0 }, { km: 30, t: 3000 }]
    expect(summarize([chunk(0, 3600)], { etas }).deltaArrival).toBeCloseTo(600, -1)
    expect(summarize([chunk(0, 3600)]).deltaArrival).toBeNull()
  })
  it('interpole le temps prévu', () => {
    const etas = [{ km: 0, t: 0 }, { km: 10, t: 1000 }, { km: 20, t: 3000 }]
    expect(plannedAt(etas, 5)).toBe(500); expect(plannedAt(etas, 15)).toBe(2000); expect(plannedAt(etas, 99)).toBe(3000)
  })
  it('sans capteur : puissance et FC absentes', () => {
    const s = summarize([chunk(0, 100, { power: () => NaN, hr: () => NaN })])
    expect(s.avgP).toBeNull(); expect(s.np).toBeNull(); expect(s.kcal).toBeNull(); expect(s.avgHr).toBeNull()
  })
})
