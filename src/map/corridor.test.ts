import { describe, expect, it } from 'vitest'
import { buildRoute, demoPoints } from '../route/route'
import { corridorTiles, tileX, tileY } from './corridor'

describe('couloir de carte autour du parcours', () => {
  it('numéros de tuiles : Paris au zoom 14', () => {
    expect(tileX(2.3522, 14)).toBe(8299); expect(tileY(48.8566, 14)).toBe(5636)
  })
  it('boucle démo : départ et arrivée couverts au zoom 14, quelques centaines de tuiles en tout', () => {
    const r = buildRoute('démo', demoPoints()), t = r.track
    const keys = corridorTiles(t)
    const z14 = keys.filter(k => k.startsWith('14/'))
    expect(keys).toContain(`14/${tileX(t.lon[0], 14)}/${tileY(t.lat[0], 14)}`)
    expect(keys).toContain(`14/${tileX(t.lon[t.n - 1], 14)}/${tileY(t.lat[t.n - 1], 14)}`)
    expect(z14.length).toBeGreaterThan(100); expect(keys.length).toBeLessThan(1500)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('style de carte épuré', () => {
  it('garde routes et noms de rues, retire commerces, bâtiments et relief ; tout passe par rbk://', async () => {
    const { calmStyle } = await import('./offline')
    const s = calmStyle({
      sources: { ne2_shaded: { type: 'raster' }, openmaptiles: { type: 'vector', url: 'https://x' } }, glyphs: 'https://g', sprite: 'https://s',
      layers: [{ id: 'ne2', type: 'raster', source: 'ne2_shaded' }, { id: 'road_minor', type: 'line', source: 'openmaptiles' }, { id: 'highway-name-minor', type: 'symbol', source: 'openmaptiles' },
        { id: 'poi_r1', type: 'symbol', source: 'openmaptiles' }, { id: 'building', type: 'fill', source: 'openmaptiles' }, { id: 'road_shield_us', type: 'symbol', source: 'openmaptiles' }],
    })
    expect(s.layers.map(l => l.id)).toEqual(['road_minor', 'highway-name-minor'])
    expect(Object.keys(s.sources)).toEqual(['openmaptiles'])
    expect(JSON.stringify(s.sources)).toContain('rbk://t/{z}/{x}/{y}')
    expect(s.glyphs).toMatch(/^rbk:/); expect(s.sprite).toMatch(/^rbk:/)
  })
})
