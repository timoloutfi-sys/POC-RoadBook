// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseGPX } from './gpx'
import { buildRoute, demoPoints, deserializeRoute, findClimbs, sectionStats, serializeRoute, STEP } from './route'

const line = (n: number, ele: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => ({ lat: 48 + (i * 50) / 111320, lon: 2, ele: ele(i) }))

describe('lecture GPX', () => {
  const gpx = (pts: string) => `<?xml version="1.0"?><gpx><trk><name>Ma boucle</name><trkseg>${pts}</trkseg></trk></gpx>`
  it('lit les trkpt, le nom et l’altitude', () => {
    const g = parseGPX(gpx('<trkpt lat="48.0" lon="2.0"><ele>100</ele></trkpt><trkpt lat="48.01" lon="2.0"><ele>110</ele></trkpt>'))
    expect(g.name).toBe('Ma boucle')
    expect(g.pts).toHaveLength(2)
    expect(g.pts[1]).toEqual({ lat: 48.01, lon: 2, ele: 110 })
    expect(g.noEle).toBe(false)
  })
  it('se rabat sur les rtept', () => {
    const g = parseGPX('<gpx><rte><rtept lat="1" lon="1"/><rtept lat="1.01" lon="1"/></rte></gpx>')
    expect(g.pts).toHaveLength(2)
    expect(g.noEle).toBe(true)
    expect(g.name).toBe('Parcours importé')
  })
  it('refuse un fichier illisible ou vide', () => {
    expect(() => parseGPX('pas du xml <')).toThrow(/GPX lisible/)
    expect(() => parseGPX('<gpx></gpx>')).toThrow(/Aucun tracé/)
  })
})

describe('construction du parcours', () => {
  it('rééchantillonne tous les 50 m', () => {
    const r = buildRoute('t', line(41, () => 100))
    expect(Math.abs(r.total - 2000)).toBeLessThanOrEqual(STEP)
    expect(r.n).toBe(Math.floor(r.total / STEP) + 1)
    expect(r.dplus).toBeCloseTo(0)
  })
  it('calcule pente et D+', () => {
    const r = buildRoute('t', line(41, i => 100 + i * 2.5)) // 5 %
    expect(r.grade[20]).toBeCloseTo(5, 0)
    expect(r.dplus).toBeGreaterThan(80)
  })
  it('refuse un tracé trop court', () => {
    expect(() => buildRoute('t', line(2, () => 0))).toThrow(/trop court/)
  })
  it('détecte une montée de 2 km à 5 % et ignore le plat', () => {
    const r = buildRoute('t', line(121, i => (i < 40 ? 100 : i < 80 ? 100 + (i - 40) * 2.5 : 200)))
    const c = findClimbs(r)
    expect(c).toHaveLength(1)
    expect(c[0].avg).toBeGreaterThan(4)
    expect(c[0].len).toBeGreaterThan(1500)
  })
  it('statistiques d’une section : longueur, D+, pente moyenne et max', () => {
    const r = buildRoute('t', line(121, i => (i < 40 ? 100 : i < 80 ? 100 + (i - 40) * 2.5 : 200)))
    const st = sectionStats(r, 2, 4)
    expect(st.len).toBeCloseTo(2, 1)
    expect(st.dplus).toBeGreaterThan(90)
    expect(st.avg).toBeGreaterThan(4)
    expect(st.avg).toBeLessThan(5.5)
    expect(st.max).toBeGreaterThanOrEqual(st.avg)
    expect(sectionStats(r, 4.5, 5.5).avg).toBeCloseTo(0, 0)
  })
  it('sérialise et relit à l’identique', () => {
    const r = buildRoute('Démo', demoPoints())
    const r2 = deserializeRoute(serializeRoute(r))
    expect(r2.n).toBe(r.n)
    expect(r2.dplus).toBeCloseTo(r.dplus, -1)
  })
  it('la boucle démo a 4 montées', () => {
    expect(findClimbs(buildRoute('Démo', demoPoints())).length).toBeGreaterThanOrEqual(3)
  })
})
