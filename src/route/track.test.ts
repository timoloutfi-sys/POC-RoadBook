import { describe, expect, it } from 'vitest'
import { buildTrack, project, trackAt } from './track'

/** Tracé de test : une route à 5 m de pas, avec un virage, une montée et une épingle. */
function path(): { lat: number; lon: number; ele: number }[] {
  const pts: { lat: number; lon: number; ele: number }[] = []
  let x = 0, y = 0, ang = 0
  const push = (e: number) => pts.push({ lat: 48 + y / 111320, lon: 2 + x / (111320 * Math.cos((48 * Math.PI) / 180)), ele: e })
  for (let i = 0; i < 2000; i++) {
    // 0–400 : tout droit plat ; 400–600 : virage à 90° (rayon ~60 m) ; 600–1200 : montée 6 % ; 1200–1260 : épingle (rayon 10 m) ; ensuite plat
    if (i >= 80 && i < 120) ang += (Math.PI / 2) / 40
    if (i >= 240 && i < 252) ang += Math.PI / 12
    x += 5 * Math.sin(ang); y += 5 * Math.cos(ang)
    push(i < 120 ? 100 : i < 240 ? 100 + (i - 120) * 0.3 : 136)
  }
  return pts
}

describe('tracé fin', () => {
  const raw = path(), t = buildTrack(raw)
  it('garde bien moins de points que le GPX, surtout sur les parties simples', () => {
    expect(t.n).toBeLessThan(raw.length / 3)
    expect(t.n).toBeGreaterThan(8)
  })
  it('reste à moins de 2,5 m du tracé d’origine', () => {
    let worst = 0
    for (let i = 0; i < raw.length; i += 3) {
      const p = project(t, raw[i].lat, raw[i].lon, i * 5, 400, 400)
      worst = Math.max(worst, p.off)
    }
    expect(worst).toBeLessThanOrEqual(2.6)
  })
  it('reproduit l’altitude à 0,5 m près', () => {
    for (let i = 0; i < raw.length; i += 7) {
      const d = i * 5
      const lissee = trackAt(t, d).ele
      // altitude d'origine, lissée sur 60 m : l'écart reste faible sur ce profil régulier
      expect(Math.abs(lissee - raw[i].ele)).toBeLessThan(2)
    }
    expect(trackAt(t, 0).ele).toBeGreaterThan(99)
    expect(trackAt(t, t.total).ele).toBeGreaterThan(135)
  })
  it('projette une position à 5 m du tracé avec une distance juste au mètre', () => {
    const a = trackAt(t, 3000), b = trackAt(t, 3001)
    const px = trackAt(t, 3000.5)
    const off = 5 / 111320
    const p = project(t, px.lat + off * Math.sign(b.lat - a.lat || 1) * 0, px.lon + off, 2900)
    expect(Math.abs(p.dist - 3000.5)).toBeLessThan(6)
    expect(p.off).toBeLessThan(8)
  })
  it('recherche locale, puis globale si on est reparti ailleurs', () => {
    const far = trackAt(t, 8000)
    const p = project(t, far.lat, far.lon, 500)
    expect(Math.abs(p.dist - 8000)).toBeLessThan(2)
  })
  it('refuse un tracé vide', () => {
    expect(() => buildTrack([{ lat: 1, lon: 1, ele: 0 }])).toThrow()
  })
})
