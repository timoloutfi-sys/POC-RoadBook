import { describe, expect, it } from 'vitest'
import { carbShare, defaultMetricCfg, driftPct, endurancePct, inTargetPct, lapNow, newLapOf, newMetrics, phoneMinutesLeft, punchPct, stepMetrics, type MetricIn } from './metrics'

const cfg = defaultMetricCfg(250, 170, 75)
const run = (m = newMetrics(cfg), n: number, f: (t: number) => Partial<MetricIn>, t0 = 0) => {
  for (let i = 1; i <= n; i++) stepMetrics(m, cfg, { power: 200, hr: 140, cad: 85, speed: 8, t: t0 + i, band: null, val: null, source: 'power', ...f(t0 + i) })
  return m
}

describe('Punch (W′bal)', () => {
  it('se vide au-dessus de CP : 30 s à CP + 300 W dépensent 9 kJ sur 18', () => {
    const m = run(undefined, 30, () => ({ power: 550 }))
    expect(punchPct(m, cfg)).toBe(50)
  })
  it('se recharge en dessous de CP, lentement', () => {
    const m = run(undefined, 30, () => ({ power: 550 }))
    run(m, 120, () => ({ power: 100 }), 30)
    expect(punchPct(m, cfg)).toBeGreaterThan(50); expect(punchPct(m, cfg)).toBeLessThan(100)
  })
  it('ne passe jamais sous 0', () => {
    const m = run(undefined, 300, () => ({ power: 700 }))
    expect(m.wbal).toBe(0)
  })
})

describe('zones et cible', () => {
  it('compte le temps par zone et la zone en cours', () => {
    const m = run(undefined, 60, t => ({ power: t <= 30 ? 100 : 230 }))
    expect(m.zones[0]).toBe(30); expect(m.zones[3]).toBe(30) // 100 W = 40 % → Z1 ; 230 W = 92 % → Z4
    expect(m.zoneNow).toBe(3); expect(m.zoneSince).toBe(31)
  })
  it('Z5 et au-dessus regroupées', () => {
    const m = run(undefined, 10, () => ({ power: 400 }))
    expect(m.zones[4]).toBe(10)
  })
  it('compte sous, dans et au-dessus de la cible', () => {
    const m = run(undefined, 40, t => ({ val: t <= 10 ? 150 : t <= 30 ? 200 : 260, band: { min: 180, max: 220 } }))
    expect([m.under, m.inT, m.over]).toEqual([10, 20, 10])
    expect(inTargetPct(m)).toBe(50)
  })
  it('en cardio, zones depuis la FC seuil', () => {
    const m = run(undefined, 10, () => ({ power: null, hr: 150, source: 'hr' })) // 150/170 = 0,88 → Z3
    expect(m.zones[2]).toBe(10)
  })
})

describe('endurance et glucides', () => {
  it('l’endurance baisse avec le travail', () => {
    const a = run(undefined, 3600, () => ({ power: 150 })), b = run(undefined, 3600, () => ({ power: 250 }))
    expect(endurancePct(a)).toBeGreaterThan(endurancePct(b)); expect(endurancePct(b)).toBeLessThan(97)
    expect(endurancePct(newMetrics(cfg))).toBe(100)
  })
  it('part de glucides croissante avec l’intensité', () => {
    expect(carbShare(0.6)).toBeCloseTo(0.4); expect(carbShare(0.85)).toBeCloseTo(0.65); expect(carbShare(1.5)).toBe(1)
  })
  it('1 h à 200 W (IF 0,8) brûle environ 90 à 125 g de glucides', () => {
    const m = run(undefined, 3600, () => ({ power: 200 }))
    expect(m.carbBurned).toBeGreaterThan(90); expect(m.carbBurned).toBeLessThan(125)
  })
  it('sans capteur de puissance : estimé depuis la FC', () => {
    const m = run(undefined, 3600, () => ({ power: null, hr: 150, source: 'hr' }))
    expect(m.carbBurned).toBeGreaterThan(40)
  })
})

describe('dérive cardiaque', () => {
  it('null sans assez de mesure', () => { expect(driftPct(run(undefined, 900, () => ({})))).toBeNull() })
  it('0 % à FC constante, positive quand la FC monte à puissance égale', () => {
    const flat = run(undefined, 3000, () => ({ hr: 140 }))
    expect(driftPct(flat)).toBeCloseTo(0, 0)
    const up = run(undefined, 3600, t => ({ hr: 140 + (t > 1800 ? 7 : 0) }))
    expect(driftPct(up)!).toBeGreaterThan(4); expect(driftPct(up)!).toBeLessThan(6)
  })
  it('ignore l’effort très faible', () => {
    const m = run(undefined, 3000, () => ({ power: 60 }))
    expect(driftPct(m)).toBeNull()
  })
})

describe('tour et téléphone', () => {
  it('moyennes du tour puis remise à zéro', () => {
    const m = run(undefined, 100, () => ({}))
    expect(Math.round(lapNow(m).p!)).toBe(200)
    const l = newLapOf(m)
    expect(l.dur).toBe(100); expect(l.v).toBeCloseTo(28.8); expect(m.lap.dur).toBe(0); expect(m.laps).toBe(1)
  })
  it('autonomie : pente sur 30 min après 15 min', () => {
    const s: [number, number][] = Array.from({ length: 21 }, (_, i) => [i * 60, 0.9 - i * 0.005])
    expect(phoneMinutesLeft(s.slice(0, 10), false)).toBeNull()
    expect(phoneMinutesLeft(s, false)).toBe(Math.round(0.8 / (0.005 / 60) / 60))
    expect(phoneMinutesLeft(s, true)).toBeNull()
  })
})
