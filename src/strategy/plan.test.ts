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
  it('des blocs ajoutés ne font pas exploser la fatigue', () => {
    const q = run({ mode: 'course', minutes: { 3: 30 } })
    expect(q.IF).toBeLessThan(p.IF * 1.04)
    expect(q.zt[3]).toBeGreaterThan(p.zt[3])
  })
})

describe('plan : nuit et nutrition', () => {
  it('programme la nuit sur un long parcours', () => {
    const p = run({ mode: 'course', start: '2026-06-20T17:00' })
    expect(p.points.some(x => /éclairage/i.test(x.text))).toBe(true)
    expect(p.sections.some(s => s.name.startsWith('Nuit'))).toBe(true)
  })
})
