import { describe, expect, it } from 'vitest'
import { buildTrack } from './track'
import { findTurns, nextTurns, offRoute, sideOf } from './turns'

// Tracé en L : 1 km vers l'est, puis 1 km vers le nord (virage à gauche de 90°).
const m = 1 / 111320, lat0 = 48.85, cl = Math.cos((lat0 * Math.PI) / 180)
const L = [...Array.from({ length: 101 }, (_, i) => ({ lat: lat0, lon: 2.3 + (i * 10 * m) / cl, ele: 50 })),
  ...Array.from({ length: 100 }, (_, i) => ({ lat: lat0 + (i + 1) * 10 * m, lon: 2.3 + (1000 * m) / cl, ele: 50 }))]
const t = buildTrack(L)

describe('navigation sur le tracé', () => {
  it('trouve le virage à gauche au bout du premier kilomètre, et rien sur les lignes droites', () => {
    const turns = findTurns(t)
    expect(turns).toHaveLength(1)
    expect(turns[0].side).toBe('gauche'); expect(turns[0].kind).toBe('normal')
    expect(Math.abs(turns[0].d - 1000)).toBeLessThan(30)
    expect(nextTurns(turns, 400)[0]?.d).toBe(turns[0].d)
    expect(nextTurns(turns, 1200)[0]).toBeNull()
  })
  it('secteurs : devant, à droite, derrière à gauche…', () => {
    expect(sideOf(0)).toBe('devant'); expect(sideOf(90)).toBe('à droite'); expect(sideOf(135)).toBe('derrière à droite')
    expect(sideOf(180)).toBe('derrière'); expect(sideOf(225)).toBe('derrière à gauche'); expect(sideOf(350)).toBe('devant')
  })
  it('hors parcours : 200 m au sud du premier tronçon en roulant vers l’est, le tracé est à gauche', () => {
    const o = offRoute(t, lat0 - 200 * m, 2.3 + (500 * m) / cl, 90)
    expect(Math.abs(o.off - 200)).toBeLessThan(5)
    expect(o.side).toBe('à gauche')
    expect(offRoute(t, lat0 - 200 * m, 2.3 + (500 * m) / cl, 270).side).toBe('à droite')
  })
})
