import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultAlerts } from '../storage/defaults'
import { defaultConfig } from '../storage/defaults'
import { buildRoute, demoPoints } from '../route/route'
import { Db } from './db'
import { Library } from './library'
import { duplicateRoadBook, effectiveAlerts, newRoadBook, resetOverride, setOverride } from './roadbooks'
import { roadBookFromConfig } from './migrate'
import type { Ride, RideChunk } from './types'

const route = buildRoute('Boucle test', demoPoints().slice(0, 600))
const ride = (id: string, roadbookId: string | undefined, start: number): Ride => ({
  id, name: id, kind: roadbookId ? 'roadbook' : 'libre', start, end: null, roadbookId,
  riderSnapshot: { ftp: 240, mass: 82, cda: 0.32, lthr: null, unit: 'power' }, summary: null, events: [],
})
const chunk = (rideId: string, seq: number): RideChunk => ({
  rideId, seq, t0: seq * 30, km: new Float32Array([seq]), speed: new Float32Array([30]), power: new Float32Array([200]),
  hr: new Float32Array([140]), cad: new Float32Array([85]), ele: new Float32Array([50]), moving: new Uint8Array([1]),
})

describe('bibliothèque', () => {
  let lib: Library
  beforeEach(async () => { lib = new Library(await Db.open('t' + Math.random())) })

  it('enregistre, relit et liste un road book avec son tracé', async () => {
    const rb = newRoadBook('RAP')
    await lib.saveRoadBook(rb, route, 21.5)
    const [m] = await lib.list()
    expect(m.name).toBe('RAP')
    expect(m.km).toBeCloseTo(route.total / 1000, 3)
    expect(m.estH).toBe(21.5)
    expect((await lib.getRoute(rb.id))!.total).toBeCloseTo(route.total, 0)
    expect((await lib.getRoadBook(rb.id))!.name).toBe('RAP')
  })

  it('garde le tracé et la durée estimée quand on ne réécrit que les annotations', async () => {
    const rb = newRoadBook('A')
    await lib.saveRoadBook(rb, route, 10)
    await lib.saveRoadBook({ ...rb, name: 'B' })
    const [m] = await lib.list()
    expect(m.name).toBe('B')
    expect(m.estH).toBe(10)
    expect(m.km).toBeGreaterThan(0)
  })

  it('duplique en copie indépendante', async () => {
    const rb = newRoadBook('RAP'); rb.base.plat = [60, 70]
    const d = duplicateRoadBook(rb)
    d.base.plat[0] = 1
    expect(d.id).not.toBe(rb.id)
    expect(d.name).toBe('RAP (copie)')
    expect(rb.base.plat[0]).toBe(60)
  })

  it('supprime un road book mais garde ses sorties', async () => {
    const rb = newRoadBook('A')
    await lib.saveRoadBook(rb, route)
    await lib.saveRide(ride('r1', rb.id, 1))
    await lib.removeRoadBook(rb.id)
    expect(await lib.list()).toEqual([])
    expect(await lib.getRoute(rb.id)).toBeNull()
    expect((await lib.listRides()).length).toBe(1)
  })

  it('liste les sorties, les plus récentes d’abord, filtrées par road book', async () => {
    await lib.saveRide(ride('a', 'x', 1)); await lib.saveRide(ride('b', 'x', 3)); await lib.saveRide(ride('c', undefined, 2))
    expect((await lib.listRides()).map(r => r.id)).toEqual(['b', 'c', 'a'])
    expect((await lib.listRides('x')).map(r => r.id)).toEqual(['b', 'a'])
  })

  it('enregistre une sortie par morceaux, dans l’ordre, et les supprime avec elle', async () => {
    await lib.saveRide(ride('r', undefined, 1))
    for (const s of [2, 0, 11, 1]) await lib.appendChunk(chunk('r', s))
    await lib.appendChunk(chunk('autre', 0))
    expect((await lib.chunks('r')).map(c => c.seq)).toEqual([0, 1, 2, 11])
    expect((await lib.chunks('r'))[0].power[0]).toBe(200)
    await lib.removeRide('r')
    expect(await lib.getRide('r')).toBeUndefined()
    expect(await lib.chunks('r')).toEqual([])
    expect((await lib.chunks('autre')).length).toBe(1)
  })
})

describe('écarts aux défauts', () => {
  const defs = defaultAlerts()
  it('suit le défaut tant qu’on ne touche à rien, puis applique l’écart', () => {
    let o = newRoadBook('x').overrides
    expect(effectiveAlerts(defs, o)).toEqual(defs)
    o = setOverride(o, 'alerts', defs[0], { dur: 60 })
    expect(effectiveAlerts(defs, o)[0].dur).toBe(60)
    expect(effectiveAlerts(defs, o)[1]).toEqual(defs[1])
  })
  it('un écart qui redevient le défaut disparaît ; rétablir efface', () => {
    let o = setOverride(newRoadBook('x').overrides, 'alerts', defs[0], { dur: 60 })
    o = setOverride(o, 'alerts', defs[0], { dur: defs[0].dur })
    expect(o.alerts).toEqual({})
    o = setOverride(o, 'alerts', defs[0], { on: false })
    expect(resetOverride(o, 'alerts', defs[0].id).alerts).toEqual({})
  })
  it('un changement du défaut global se répercute, sauf sur la valeur modifiée', () => {
    const o = setOverride(newRoadBook('x').overrides, 'alerts', defs[0], { dur: 60 })
    const nd = defs.map(d => ({ ...d, cool: 9, dur: 99 }))
    const e = effectiveAlerts(nd, o)
    expect(e[0].dur).toBe(60); expect(e[0].cool).toBe(9); expect(e[1].dur).toBe(99)
  })
})

describe('migration', () => {
  it('ne crée rien si l’appli est vide', () => {
    expect(roadBookFromConfig(defaultConfig(), null)).toBeNull()
  })
  it('reprend le tracé, les points et le plan dans un premier road book', () => {
    const cfg = { ...defaultConfig(), points: [{ id: 'p', type: 'eau', km: 5, text: 'x', avant: 1 }] } as ReturnType<typeof defaultConfig>
    const m = roadBookFromConfig(cfg, route)!
    expect(m.rb.name).toBe('Boucle test')
    expect(m.rb.points).toBe(cfg.points)
    expect(m.route).toBe(route)
    expect(roadBookFromConfig(cfg, null)!.rb.name).toBe('Mon road book')
  })
})
