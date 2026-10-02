import { describe, expect, it } from 'vitest'
import { buildRoute, demoPoints } from '../route/route'
import { ifForDuration } from './pacing'
import { computePlan, defaultPlanCfg, type PlanCfg } from './plan'

const route = buildRoute('Démo', demoPoints())
const body = { mass: 82, cda: 0.3 }
const run = (over: Partial<PlanCfg> = {}, unit: 'power' | 'hr' = 'power') =>
  computePlan({ route, body, ftp: 240, unit, cfg: { ...defaultPlanCfg(), start: '2026-06-20T08:00', ...over } })
const share = (zt: number[], z: number) => zt[z] / zt.reduce((a, b) => a + b, 0)

describe('plan : sortie tranquille', () => {
  const p = run({ mode: 'tranquille' })
  it('reste en endurance et donne une vitesse plausible', () => {
    expect(share(p.zt, 1)).toBeGreaterThan(0.7)
    expect(p.vavg).toBeGreaterThan(24)
    expect(p.vavg).toBeLessThan(36)
  })
  it('n’a aucun bloc réglable, mais des rappels et de l’eau', () => {
    expect(p.adjustable).toEqual([])
    expect(p.periodic.length).toBeGreaterThan(0)
    expect(p.points.some(x => x.type === 'eau')).toBe(true)
  })
})

describe('plan : entraînement', () => {
  it('place les minutes de seuil par défaut, surtout en montée', () => {
    const p = run({ mode: 'entrainement' })
    expect(p.defaults[3]).toBeGreaterThanOrEqual(10)
    expect(Math.abs(p.placed[3] - p.defaults[3])).toBeLessThanOrEqual(6)
    const blocks = p.sections.filter(s => s.name.startsWith('Seuil'))
    expect(blocks.length).toBeGreaterThan(0)
    expect(p.zt[3]).toBeGreaterThan(p.defaults[3] * 60 * 0.7)
  })
  it('plus de minutes en Z4 : plus rapide, plus de fatigue', () => {
    const a = run({ mode: 'entrainement', minutes: { 3: 10 } }), b = run({ mode: 'entrainement', minutes: { 3: 40 } })
    expect(b.zt[3]).toBeGreaterThan(a.zt[3])
    expect(b.H).toBeLessThan(a.H)
    expect(b.tss).toBeGreaterThan(a.tss * 0.99)
  })
  it('refuse plus que ce qui se tient et le dit', () => {
    const p = run({ mode: 'entrainement', minutes: { 4: 200 } })
    expect(p.warnings.some(w => /Z5/.test(w))).toBe(true)
    expect(p.placed[4]).toBeLessThanOrEqual(p.limits[4] + 2)
  })
  it('pas de Z5 proposée quand on pilote en cardio', () => {
    expect(run({ mode: 'entrainement' }, 'hr').adjustable).toEqual([2, 3])
    expect(run({ mode: 'entrainement' }, 'power').adjustable).toEqual([2, 3, 4])
  })
})

describe('plan : course', () => {
  const t0 = performance.now()
  const p = run({ mode: 'course' })
  const ms = performance.now() - t0
  it('tient une intensité adaptée à la durée', () => {
    expect(Math.abs(p.IF - ifForDuration(p.H))).toBeLessThan(0.05)
  })
  it('appuie dans les montées et lève le pied en descente', () => {
    const climb = p.sections.find(s => s.kind === 'montee')
    expect(climb).toBeDefined()
    expect(climb!.max).toBeGreaterThan(p.base.plat[1])
    expect(climb!.avant).toBe(1)
  })
  it('se calcule vite', () => expect(ms).toBeLessThan(3000))
  it('respecte un temps visé', () => {
    const q = run({ mode: 'course', targetHours: p.H * 1.15 })
    expect(Math.abs(q.H - p.H * 1.15) / (p.H * 1.15)).toBeLessThan(0.03)
    expect(q.IF).toBeLessThan(p.IF)
  })
  it('pas de blocs en course : le temps par zone est une conséquence', () => {
    expect(p.adjustable).toEqual([])
  })
  it('l’intensité demandée est respectée : plus haut, plus vite', () => {
    const lo = run({ mode: 'course', intensity: 70 }), hi = run({ mode: 'course', intensity: 85 })
    expect(Math.abs(lo.IF - 0.7)).toBeLessThan(0.02)
    expect(Math.abs(hi.IF - 0.85)).toBeLessThan(0.02)
    expect(hi.H).toBeLessThan(lo.H)
  })
  it('la répartition en zones varie progressivement avec l’intensité (pas de bascule brutale)', () => {
    const a = run({ mode: 'course', intensity: 76 }), b = run({ mode: 'course', intensity: 77 })
    for (let z = 0; z < 7; z++) expect(Math.abs(a.zt[z] - b.zt[z])).toBeLessThan(a.H * 3600 * 0.35)
  })
})

describe('plan : cibles imposées et manuel', () => {
  const imp = { id: 'i1', kind: 'zone' as const, name: 'Col au calme', a: 60, b: 80, min: 50, max: 58, msg: '', avant: 1 }
  it('une cible imposée est conservée telle quelle, en tout mode', () => {
    for (const mode of ['tranquille', 'entrainement', 'course', 'manuel'] as const) {
      const p = run({ mode, imposed: [imp] })
      const s = p.sections.find(x => x.locked)
      expect(s).toBeDefined()
      expect([s!.a, s!.b, s!.min, s!.max]).toEqual([60, 80, 50, 58])
      const i = Math.round(70000 / 50)
      expect(p.ratio[i]).toBeCloseTo(0.54, 2)
    }
  })
  it('en course, l’imposé est compensé : même fatigue, arrivée qui bouge', () => {
    const free = run({ mode: 'course' }), held = run({ mode: 'course', imposed: [imp] })
    expect(Math.abs(held.IF - free.IF)).toBeLessThan(0.03)
    expect(held.H).toBeGreaterThan(free.H)
  })
  it('le mode manuel suit les cibles données et rien d’autre', () => {
    const easy = run({ mode: 'manuel', manual: { plat: [60, 66], montee: [65, 72], descente: [0, 50], gUp: 3.5, gDown: -3 } })
    const hard = run({ mode: 'manuel', manual: { plat: [78, 84], montee: [85, 95], descente: [0, 50], gUp: 3.5, gDown: -3 } })
    expect(hard.H).toBeLessThan(easy.H)
    expect(easy.adjustable).toEqual([])
    expect(easy.sections.filter(s => !s.locked && s.kind !== 'montee')).toHaveLength(0)
    expect(easy.base.plat).toEqual([60, 66])
  })
})

describe('plan : nuit et nutrition', () => {
  it('programme la nuit sur un long parcours', () => {
    const p = run({ mode: 'course', start: '2026-06-20T17:00' })
    expect(p.points.some(x => /éclairage/i.test(x.text))).toBe(true)
    expect(p.sections.some(s => s.name.startsWith('Nuit'))).toBe(true)
  })
})
