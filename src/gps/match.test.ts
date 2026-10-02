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
  it('trouve l’index local', () => {
    const m = matchRoute(r, 48 + 1000 / 111320, 2.0001, 15)
    expect(m.off).toBe(false)
    expect(m.idx).toBe(20)
  })
  it('recherche globale au-delà de 150 m (retour sur l’autre branche)', () => {
    const m = matchRoute(r, 48 + 1000 / 111320, 2.0136, 20)
    expect(m.off).toBe(false)
    expect(m.idx).toBeGreaterThan(150)
  })
  it('hors parcours : garde le dernier index', () => {
    const m = matchRoute(r, 48.02, 2.007, 30)
    expect(m.off).toBe(true)
    expect(m.idx).toBe(30)
  })
})
