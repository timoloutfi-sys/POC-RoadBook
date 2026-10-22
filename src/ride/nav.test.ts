import { describe, expect, it } from 'vitest'
import { buildRoute } from '../route/route'
import { findTurns } from '../route/turns'
import { navCues, navView, newNavCues } from './nav'

// Tracé en L : 1 km vers l'est, puis 1 km vers le nord (virage à gauche à 1000 m).
const m = 1 / 111320, lat0 = 48.85, cl = Math.cos((lat0 * Math.PI) / 180)
const L = [...Array.from({ length: 101 }, (_, i) => ({ lat: lat0, lon: 2.3 + (i * 10 * m) / cl, ele: 50 })),
  ...Array.from({ length: 100 }, (_, i) => ({ lat: lat0 + (i + 1) * 10 * m, lon: 2.3 + (1000 * m) / cl, ele: 50 }))]
const r = buildRoute('L', L), turns = findTurns(r.track)

describe('navigation pendant la sortie', () => {
  it('vue : prochain virage à gauche et sa distance ; cap vers l’est', () => {
    const v = navView(r, 600)
    expect(v.turn?.side).toBe('gauche')
    expect(Math.abs((v.inM ?? 0) - 400)).toBeLessThan(30)
    expect(Math.abs(v.heading - 90)).toBeLessThan(3)
    expect(v.off).toBeNull()
  })
  it('vue hors parcours : écart et tracé à gauche en roulant vers l’est', () => {
    const v = navView(r, 500, { lat: lat0 - 200 * m, lon: 2.3 + (500 * m) / cl, heading: 90, off: true })
    expect(v.turn).toBeNull()
    expect(Math.abs((v.off?.m ?? 0) - 200)).toBeLessThan(5)
    expect(v.off?.side).toBe('à gauche')
  })
  it('annonces : une fois à 150 m, une fois au virage, rien sur la ligne droite', () => {
    const s = newNavCues(), all: string[] = []
    for (let d = 0; d < 1500; d += 8) all.push(...navCues(s, turns, d, 8, 3, 150).map(c => `${c}@${d}`))
    expect(all).toHaveLength(2)
    expect(all[0]).toMatch(/^approche@(8[5-9]\d)$/)
    expect(all[1]).toMatch(/^virage@9\d\d$/)
  })
  it('hors parcours après 5 s au-delà de 40 m, retour quand on rejoint ; pas d’annonce à l’arrêt', () => {
    const s = newNavCues()
    const seq = [50, 50, 50, 50, 50, 50, 50, 30, 10].flatMap(o => navCues(s, turns, 200, 6, o, 150))
    expect(seq).toEqual(['hors', 'retour'])
    expect(navCues(newNavCues(), turns, 900, 0.5, 2, 150)).toEqual([])
  })
})
