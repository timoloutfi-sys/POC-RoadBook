import { describe, expect, it } from 'vitest'
import { buildRoute } from '../route/route'
import { matchRoute } from './match'

// Aller-retour : 5 km vers le nord puis retour sur une route parallèle à 1 km à l'est.
const pts = [
  ...Array.from({ length: 101 }, (_, i) => ({ lat: 48 + (i * 50) / 111320, lon: 2, ele: 0 })),
  ...Array.from({ length: 101 }, (_, i) => ({ lat: 48 + ((100 - i) * 50) / 111320, lon: 2.0136, ele: 0 })),
]
const r = buildRoute('t', pts)

describe('recalage GPS', () => {
  it('projette en mètres sur le tracé', () => {
    const m = matchRoute(r, 48 + 1003 / 111320, 2.0001, 750)
    expect(m.offRoute).toBe(false)
    expect(Math.abs(m.pos - (1003 * 111195) / 111320)).toBeLessThan(0.5)
  })
  it('recherche globale au-delà de 150 m (retour sur l’autre branche)', () => {
    const m = matchRoute(r, 48 + 1000 / 111320, 2.0136, 1000)
    expect(m.offRoute).toBe(false)
    expect(m.pos).toBeGreaterThan(8000)
  })
  it('hors parcours : garde la dernière position', () => {
    const m = matchRoute(r, 48.02, 2.007, 1500)
    expect(m.offRoute).toBe(true)
    expect(m.pos).toBe(1500)
  })
})
