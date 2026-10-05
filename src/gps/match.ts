import type { Route } from '../route/route'
import { OFF_ROUTE_M, project } from '../route/track'

export { OFF_ROUTE_M }

/**
 * Recale une position sur le parcours : projection sur les segments du tracé fin autour de la
 * dernière position (distance en mètres), puis recherche globale si on est à plus de 150 m
 * (demi-tour, raccourci, reprise). Hors parcours, la dernière position est gardée.
 */
export function matchRoute(r: Route, lat: number, lon: number, lastDist: number): { pos: number; off: number; offRoute: boolean } {
  const p = project(r.track, lat, lon, lastDist)
  const offRoute = p.off > OFF_ROUTE_M
  return { pos: offRoute ? lastDist : p.dist, off: p.off, offRoute }
}
