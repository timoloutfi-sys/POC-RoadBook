import { describe, expect, it } from 'vitest'
import { cornerCaps } from './geometry'
import { buildProfile, dplusOf, eleAtDist, gradeAtDist, SEG_MAX } from './profile'
import { buildRoute, demoPoints, type RawPoint } from './route'
import { trackAt } from './track'

const K = 111320

/** Route d'essai : plat, montée à 6 % puis à 10 %, plat, descente, et une épingle de 10 m de rayon. */
function fixture(): RawPoint[] {
  const pts: RawPoint[] = []
  let x = 0, y = 0, ele = 100
  const go = (len: number, grade: number, hdg = 0) => {
    for (let s = 5; s <= len; s += 5) {
      x += 5 * Math.sin(hdg); y += 5 * Math.cos(hdg); ele += 5 * grade / 100
      pts.push({ lat: 48 + y / K, lon: 2 + x / (K * Math.cos((48 * Math.PI) / 180)), ele })
    }
  }
  pts.push({ lat: 48, lon: 2, ele })
  go(2000, 0.2); go(3000, 6); go(1500, 10); go(2000, 0); go(2500, -5)
  // épingle : demi-cercle de 10 m de rayon, par pas de 1 m
  const r = 10, cx = x + r, cy = y
  for (let a = Math.PI; a >= 0; a -= 0.1) {
    const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a)
    pts.push({ lat: 48 + py / K, lon: 2 + px / (K * Math.cos((48 * Math.PI) / 180)), ele })
  }
  x = cx + r; y = cy
  go(1000, 0, Math.PI)
  return pts
}

describe('profil à pas variable', () => {
  const r = buildRoute('t', fixture()), p = r.profile

  it('beaucoup moins de tronçons qu’un pas de 5 m, bornes respectées', () => {
    expect(p.n).toBeLessThan(r.track.total / 5 / 5)
    for (let j = 0; j < p.n; j++) {
      const len = p.d[j + 1] - p.d[j]
      expect(len).toBeLessThanOrEqual(SEG_MAX + 1)
      if (j < p.n - 1) expect(len).toBeGreaterThanOrEqual(9)
    }
  })

  it('altitude à 0,5 m près de la référence au pas de 5 m', () => {
    let worst = 0
    for (let d = 0; d <= p.total; d += 5) worst = Math.max(worst, Math.abs(eleAtDist(p, d) - trackAt(r.track, d).ele))
    expect(worst).toBeLessThanOrEqual(0.6)
  })

  it('D+ à 1 % de la référence', () => {
    const ref: number[] = []
    for (let d = 0; d <= p.total; d += 5) ref.push(trackAt(r.track, d).ele)
    const a = dplusOf(ref), b = dplusOf(p.ele)
    expect(Math.abs(b - a) / a).toBeLessThan(0.01)
  })

  it('pente d’un kilomètre de montée à 0,3 point près', () => {
    expect(Math.abs(gradeAtDist(p, 3500) - 6)).toBeLessThan(0.3)
    expect(Math.abs(gradeAtDist(p, 6200) - 10)).toBeLessThan(0.4)
  })

  it('coupures imposées', () => {
    const q = buildProfile(r.track, [1234, 4321])
    expect(Array.from(q.d).some(d => Math.abs(d - 1235) < 3)).toBe(true)
    expect(Array.from(q.d).some(d => Math.abs(d - 4320) < 3)).toBe(true)
  })

  it('épingle de 10 m de rayon : 22 km/h au plus', () => {
    const caps = cornerCaps(r)
    expect(Math.min(...caps) * 3.6).toBeLessThanOrEqual(22)
    // et rien de limitant sur la route droite
    expect(caps[10]).toBeGreaterThan(40 / 3.6)
  })

  it('parcours de démo : D+ cohérent avec la référence', () => {
    const d = buildRoute('d', demoPoints())
    expect(d.dplus).toBeGreaterThan(300)
    expect(d.profile.n).toBeGreaterThan(10)
  })
})
