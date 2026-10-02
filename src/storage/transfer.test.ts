import { describe, expect, it } from 'vitest'
import { buildRoute, demoPoints } from '../route/route'
import { defaultConfig } from './defaults'
import { exportPlan, importPlan } from './transfer'

describe('export et import du plan', () => {
  it('aller-retour', () => {
    const cfg = { ...defaultConfig(), maxPerHour: 7 }
    const route = buildRoute('Démo', demoPoints())
    const back = importPlan(exportPlan(cfg, route))
    expect(back.cfg.maxPerHour).toBe(7)
    expect(back.route?.n).toBe(route.n)
  })
  it('lit l’ancien format du prototype HTML', () => {
    const old = { cfg: { ftp: 260, mass: 75, cda: 0.28, global: { gUp: 4 }, zones: [{ id: 'z', name: 'Bloc' }], points: [] }, route: null }
    const { cfg, route } = importPlan(JSON.stringify(old))
    expect(cfg.rider.ftp).toBe(260)
    expect(cfg.base.gUp).toBe(4)
    expect(cfg.base.plat).toEqual([65, 72])
    expect(cfg.sections).toHaveLength(1)
    expect(route).toBeNull()
  })
  it('refuse un texte qui n’est pas un plan', () => {
    expect(() => importPlan('{"a":1}')).toThrow(/illisible/)
  })
})
