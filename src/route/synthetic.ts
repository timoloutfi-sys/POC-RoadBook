import { clamp } from '../core/format'
import { buildRoute, type RawPoint, type Route } from './route'

export type Terrain = 'plat' | 'vallonne' | 'montagne'

/** Forme du relief (sans unité) selon le terrain : x en km depuis le départ. */
function shape(terrain: Terrain, km: number): (x: number) => number {
  const TAU = 2 * Math.PI
  if (terrain === 'plat') return x => Math.sin((TAU * x) / 9) + 0.6 * Math.sin((TAU * x) / 3.1 + 1)
  if (terrain === 'vallonne') return x => Math.sin((TAU * x) / 7) + 0.6 * Math.sin((TAU * x) / 2.6 + 2)
  // Montagne : quelques cols de 8 à 15 km de montée, répartis sur la distance, sur un fond de petites bosses.
  const cols = clamp(Math.round(km / 90), 3, 6), gap = km / cols, width = Math.min(26, gap * 0.9)
  return x => {
    let h = 0.12 * Math.sin((TAU * x) / 3.3)
    for (let c = 0; c < cols; c++) {
      const u = (x - (c * gap + (gap - width) / 2)) / width
      if (u > 0 && u < 1) h += 3 * Math.sin(Math.PI * Math.pow(u, 0.7)) ** 1.4
    }
    return h
  }
}

/**
 * Parcours fictif pour estimer une course dont on n'a pas encore le GPX : une ligne droite
 * de la bonne longueur, dont le relief suit le terrain choisi et totalise le dénivelé saisi.
 * Il sert aux calculs seulement.
 */
export function syntheticRoute(name: string, est: { km: number; dplus: number; terrain: Terrain }): Route {
  const km = Math.max(5, est.km), f = shape(est.terrain, km), STEP_KM = 0.25
  const make = (amp: number) => {
    const pts: RawPoint[] = []
    for (let x = 0; x <= km + 1e-9; x += STEP_KM) pts.push({ lat: 49 + x / 111.19, lon: 2.47, ele: 120 + amp * f(x) })
    return pts
  }
  const unit = buildRoute(name, make(1)).dplus
  const amp = unit > 0 ? Math.max(0, est.dplus) / unit : 0
  const route = buildRoute(name, make(amp))
  route.synthetic = true
  return route
}
