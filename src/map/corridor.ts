import type { Track } from '../route/track'

/**
 * Couloir du parcours : les tuiles de carte autour du tracé, à chaque niveau de zoom.
 * Large au zoom bas (vue lointaine de la carte en perspective), serré au zoom 14 (détail des rues).
 * C'est ce qu'on enregistre pour rouler sans réseau ; le boîtier prendra le même couloir.
 */

/** Rayon gardé autour du tracé (m) par niveau de zoom ; au-delà de 14, la carte agrandit le niveau 14. */
export const CORRIDOR: Record<number, number> = { 8: 15000, 9: 15000, 10: 12000, 11: 8000, 12: 5000, 13: 2500, 14: 1000 }
export const MIN_Z = 8, MAX_Z = 14

export const tileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z)
export function tileY(lat: number, z: number) {
  const r = (Math.min(85, Math.max(-85, lat)) * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

/** Clés « z/x/y » des tuiles du couloir, du zoom bas au zoom haut. */
export function corridorTiles(t: Track, radius: Record<number, number> = CORRIDOR): string[] {
  const keys = new Set<string>()
  for (let z = MIN_Z; z <= MAX_Z; z++) {
    const r = radius[z], step = Math.min(r, 250)
    for (let d = 0, i = 0; d <= t.total; d += step) {
      while (i < t.n - 2 && t.d[i + 1] < d) i++
      const k = t.d[i + 1] > t.d[i] ? (d - t.d[i]) / (t.d[i + 1] - t.d[i]) : 0
      const lat = t.lat[i] + (t.lat[i + 1] - t.lat[i]) * k, lon = t.lon[i] + (t.lon[i + 1] - t.lon[i]) * k
      const dLat = r / 111320, dLon = r / (111320 * Math.cos((lat * Math.PI) / 180))
      const x0 = tileX(lon - dLon, z), x1 = tileX(lon + dLon, z), y0 = tileY(lat + dLat, z), y1 = tileY(lat - dLat, z)
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.add(`${z}/${x}/${y}`)
      if (d === t.total) break
      if (d + step > t.total) d = t.total - step
    }
  }
  return [...keys]
}
