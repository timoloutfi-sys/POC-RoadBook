import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { getLibrary, startLibrary } from '../library/session'
import { recorder, type Sample } from './recorder'

const sample = (i: number, over: Partial<Sample> = {}): Sample => ({
  t: 1_700_000_000_000 + i * 1000, km: (i * 25) / 3600, speed: 6.9, power: 200, hr: 140, cad: 85, ele: 100, moving: true, tgt: 1, ...over,
})

describe('enregistrement d’une sortie', () => {
  beforeAll(async () => { await startLibrary() })

  it('écrit par morceaux de 30 s, résume, puis enregistre', async () => {
    await recorder.begin()
    const id = recorder.ride!.id
    expect(recorder.ride!.kind).toBe('libre') // pas de road book chargé
    for (let i = 0; i < 100; i++) recorder.sample(sample(i))
    await recorder.flush()
    const lib = getLibrary()!
    expect((await lib.chunks(id)).length).toBe(4) // 3 × 30 s + le reste
    const p = await recorder.preview(0)
    expect(p!.summary.moving).toBe(100)
    expect(p!.summary.avgP).toBe(200)
    expect((await lib.getRide(id))!.end).toBeNull() // l’aperçu ne ferme rien
    const done = await recorder.finish('Ma sortie', 0)
    expect(done!.name).toBe('Ma sortie')
    expect((await lib.getRide(id))!.summary!.km).toBeGreaterThan(0.6)
    expect(recorder.active).toBe(false)
  })

  it('note les arrêts et les reprises', async () => {
    await recorder.begin()
    for (let i = 0; i < 10; i++) recorder.sample(sample(i))
    for (let i = 10; i < 40; i++) recorder.sample(sample(i, { moving: false, speed: 0 }))
    for (let i = 40; i < 50; i++) recorder.sample(sample(i))
    expect(recorder.ride!.events.map(e => e.type)).toEqual(['stop', 'resume'])
    await recorder.discard()
  })

  it('reprend une sortie restée ouverte là où elle en était', async () => {
    const lib = getLibrary()!
    await recorder.begin()
    const id = recorder.ride!.id
    for (let i = 0; i < 60; i++) recorder.sample(sample(i))
    await recorder.flush()
    recorder.ride = null // Chrome est tué : plus rien en mémoire, seule la base reste
    const at = await recorder.resume((await lib.getRide(id))!)
    expect(at!.moving).toBe(60)
    expect(at!.km).toBeCloseTo(sample(59).km, 3)
    for (let i = 60; i < 70; i++) recorder.sample(sample(i))
    const done = await recorder.finish(undefined, 0)
    expect(done!.summary!.moving).toBe(70)
    expect((await lib.chunks(id)).map(c => c.seq)).toEqual([0, 1, 2])
  })
})
