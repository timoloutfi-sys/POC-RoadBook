import type { Route } from '../route/route'

/** Au-delà de cette distance (m) au tracé, on est hors parcours. */
export const OFF_ROUTE_M = 150

/**
 * Recale une position sur le parcours : recherche locale autour du dernier index,
 * puis globale si on est à plus de 150 m (demi-tour, raccourci, reprise).
 */
export function matchRoute(r: Route, lat: number, lon: number, lastIdx: number): { idx: number; dist: number; off: boolean } {
  const cl = Math.cos((lat * Math.PI) / 180)
  const near = (i0: number, i1: number): [number, number] => {
    let best = 0, bd = Infinity
    for (let i = Math.max(0, i0); i <= Math.min(r.n - 1, i1); i++) {
      const dx = (r.lon[i] - lon) * cl, dy = r.lat[i] - lat, d = dx * dx + dy * dy
      if (d < bd) { bd = d; best = i }
    }
    return [best, Math.sqrt(bd) * 111320]
  }
  let [i, dm] = near(lastIdx - 20, lastIdx + 400)
  if (dm > OFF_ROUTE_M) {
    const [j, dj] = near(0, r.n - 1)
    if (dj < dm) { i = j; dm = dj }
  }
  const off = dm > OFF_ROUTE_M
  return { idx: off ? lastIdx : i, dist: dm, off }
}
