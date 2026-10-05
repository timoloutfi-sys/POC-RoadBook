import { describe, expect, it } from 'vitest'
import { newRun } from '../alerts/engine'
import { buildRoute, demoPoints } from '../route/route'
import { useStore } from '../storage/store'
import { bundleOf, deserializeBundle, serializeBundle } from './bundle'
import { newEngine, tick } from './engine'
import { rideState } from './scope'

const setup = () => {
  const route = buildRoute('t', demoPoints().slice(0, 600))
  useStore.setState({ route, libre: false })
  return bundleOf(rideState())
}

/** Rejoue 10 minutes : 8 m/s, 200 W puis 330 W. Mêmes entrées, mêmes sorties. */
const replay = () => {
  const b = setup(), e = newEngine(newRun(), 0, b.route!.total), out: string[] = []
  for (let t = 0; t < 600; t++) {
    const o = tick(e, b, { power: t < 300 ? 200 : 330, hr: 140, cad: 85, speed: 8, fix: null, source: 'power' }, t * 1000)
    out.push(`${Math.round(e.run.d)}|${o.tgt}|${o.signals.join(',')}`)
  }
  return { out, e }
}

describe('moteur de sortie', () => {
  it('est déterministe et ne dépend que du paquet et des mesures', () => {
    const a = replay(), b = replay()
    expect(a.out).toEqual(b.out)
    expect(Math.round(a.e.run.d)).toBe(4800)
    expect(a.e.run.t).toBe(600)
  })
  it('ne compte pas le temps à l’arrêt et n’avance pas', () => {
    const b = setup(), e = newEngine(newRun(), 0, b.route!.total)
    for (let t = 0; t < 30; t++) tick(e, b, { power: 0, hr: 90, cad: 0, speed: 0, fix: null, source: 'power' }, t * 1000)
    expect(e.run.t).toBe(0); expect(e.run.d).toBe(0)
  })
  it('recale la distance sur un fix du GPS', () => {
    const b = setup(), e = newEngine(newRun(), 0, b.route!.total)
    tick(e, b, { power: 150, hr: 120, cad: 80, speed: 8, fix: 2000, source: 'power' }, 0)
    expect(e.run.d).toBe(2008)
  })
  it('alimente les calculs de réserves à chaque seconde', () => {
    const { e } = replay()
    expect(e.m.zones.reduce((a, b) => a + b, 0)).toBe(600)
    expect(e.m.carbBurned).toBeGreaterThan(20); expect(e.m.wbal).toBeLessThanOrEqual(e.cfg.wprime)
  })
  it('garde des tampons bornés', () => {
    const { e } = replay()
    expect(e.pBuf.length).toBeLessThanOrEqual(10); expect(e.hrHist.length).toBeLessThanOrEqual(120)
  })
})

describe('paquet de sortie', () => {
  it('se sérialise et se relit à l’identique pour le moteur', () => {
    const b = setup(), c = deserializeBundle(serializeBundle(b))
    expect(c.v).toBe(b.v); expect(c.route!.total).toBeCloseTo(b.route!.total, 0)
    expect(c.sections.length).toBe(b.sections.length)
    const e1 = newEngine(newRun(), 0, b.route!.total), e2 = newEngine(newRun(), 0, c.route!.total)
    const m = { power: 210, hr: 140, cad: 85, speed: 8, fix: null, source: 'power' as const }
    for (let t = 0; t < 120; t++) { tick(e1, b, m, t * 1000); tick(e2, c, m, t * 1000) }
    expect(e2.run.d).toBeCloseTo(e1.run.d, 3)
    expect(e2.run.emitted).toBe(e1.run.emitted)
  })
  it('refuse une autre version', () => {
    expect(() => deserializeBundle('{"v":99}')).toThrow()
  })
})
