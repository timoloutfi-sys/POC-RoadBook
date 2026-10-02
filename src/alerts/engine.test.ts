import { describe, expect, it } from 'vitest'
import type { Target } from '../strategy/target'
import type { RoutePoint, Section } from '../strategy/types'
import { ackReminder, evalRun, HR_GRACE, newRun, nextReminder, type EvalContext, type Values } from './engine'
import type { AlertRule, Periodic } from './types'

const tg = (over: Partial<Target> = {}): Target => ({
  power: { min: 150, max: 170 }, hr: { min: 135, max: 145 }, zone: 1, label: 'Plat', kind: 'plat', section: null, ...over,
})
const tooHard: AlertRule = { id: 'a1', on: true, name: 'Trop fort', metric: 'effort', op: '>', ref: 'max', val: 0, dur: 30, cool: 3, prio: 'action', msg: 'Trop fort : reviens sous {max}' }
const ctx = (over: Partial<EvalContext> = {}): EvalContext => ({
  alerts: [tooHard], points: [], sections: [], periodic: [], maxPerHour: 10, source: 'power', now: 0, ...over,
})
const vals = (v: Partial<Values>): Values => ({ power: null, hr: null, cad: null, speed: 30, ...v })
const ride = (st: ReturnType<typeof newRun>, c: EvalContext, v: Values, secs: number, t = tg()) => {
  const out = []
  for (let i = 0; i < secs; i++) { st.t++; out.push(...evalRun(st, c, t, v)) }
  return out
}

describe('alertes de seuil', () => {
  it('se déclenche après la durée, pas avant, sans bandeau', () => {
    const st = newRun()
    expect(ride(st, ctx(), vals({ power: 200 }), 29)).toEqual([])
    expect(ride(st, ctx(), vals({ power: 200 }), 1)).toEqual(['action'])
    expect(st.log[0].msg).toBe('Trop fort : reviens sous 170')
    expect(st.banner).toBeNull()
  })
  it('colore le widget (sévérité) dès 5 s, puis s’efface en fondu', () => {
    const st = newRun()
    ride(st, ctx(), vals({ power: 200 }), 10)
    expect(st.sev.power?.dir).toBe('hi')
    const k = st.sev.power!.k
    ride(st, ctx(), vals({ power: 160 }), 1)
    expect(st.sev.power!.k).toBeLessThan(k)
    ride(st, ctx(), vals({ power: 160 }), 20)
    expect(st.sev.power).toBeUndefined()
  })
  it('respecte le délai de répétition', () => {
    const st = newRun()
    expect(ride(st, ctx(), vals({ power: 200 }), 179)).toHaveLength(1)
    expect(ride(st, ctx(), vals({ power: 200 }), 30)).toHaveLength(0)
    expect(ride(st, ctx(), vals({ power: 200 }), 1)).toHaveLength(1)
  })
  it('plafond horaire : les alertes de seuil en trop sont filtrées', () => {
    const st = newRun()
    const c = ctx({ maxPerHour: 2, alerts: [{ ...tooHard, cool: 0, dur: 1 }] })
    ride(st, c, vals({ power: 200 }), 10)
    expect(st.emitted).toBe(2)
    expect(st.filtered).toBeGreaterThan(0)
  })
  it('sans capteur de puissance, l’effort est piloté par la FC avec un délai de stabilisation', () => {
    const st = newRun()
    const c = ctx({ source: 'hr' })
    expect(ride(st, c, vals({ hr: 160 }), HR_GRACE)).toEqual([])
    // Après la période de grâce, il faut au moins 60 s au-dessus.
    expect(ride(st, c, vals({ hr: 160 }), 59)).toEqual([])
    expect(ride(st, c, vals({ hr: 160 }), 1)).toEqual(['action'])
    expect(st.log[0].msg).toBe('Trop fort : reviens sous 145')
  })
})

describe('annonces du parcours', () => {
  const pt: RoutePoint = { id: 'p', type: 'eau', km: 10, text: 'Fontaine', avant: 2 }
  const sec: Section = { id: 's', kind: 'montee', name: 'Montée 1', a: 12, b: 14, min: 80, max: 90, msg: 'Mange', avant: 1 }
  it('annonce un point une seule fois, avec bandeau', () => {
    const st = newRun()
    st.d = 8500
    expect(ride(st, ctx({ alerts: [], points: [pt] }), vals({}), 3)).toEqual(['action'])
    expect(st.log[0].msg).toBe('💧 Fontaine dans 1,5 km')
    expect(st.banner?.msg).toBe('💧 Fontaine dans 1,5 km')
  })
  it('annonce une section avant son début, puis sa cible à l’entrée', () => {
    const st = newRun()
    const c = ctx({ alerts: [], sections: [sec] })
    st.d = 11500
    ride(st, c, vals({}), 1)
    expect(st.log[0].msg).toBe('Montée 1 dans 0,5 km. Mange')
    st.d = 12500
    ride(st, c, vals({}), 1, tg({ power: { min: 200, max: 225 } }))
    expect(st.log[0].msg).toBe('Montée 1 : cible 200–225 W')
  })
})

describe('rappels', () => {
  const per: Periodic = { id: 'r', on: true, every: 20, msg: 'Mange', prio: 'action' }
  it('passe toutes les 20 min de roulage', () => {
    const st = newRun()
    expect(ride(st, ctx({ alerts: [], periodic: [per] }), vals({}), 1200)).toEqual(['action'])
    expect(nextReminder(st, [per])?.s).toBe(1200)
  })
  it('« Fait » relance le minuteur', () => {
    const st = newRun()
    st.t = 600
    expect(nextReminder(st, [per])?.s).toBe(600)
    ackReminder(st, [per], 0)
    expect(nextReminder(st, [per])?.s).toBe(1200)
  })
})
