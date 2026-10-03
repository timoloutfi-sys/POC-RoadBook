import type { Route } from '../route/route'
import type { Config } from '../storage/defaults'
import { newRoadBook } from './roadbooks'
import type { RoadBook } from './types'

/**
 * Reprend le travail en cours (tracé, points, repères, plan) et en fait un premier road book.
 * Rien à migrer si l'appli est vide. Les alertes et rappels actuels restent les défauts globaux.
 */
export function roadBookFromConfig(cfg: Config, route: Route | null, now = Date.now()): { rb: RoadBook; route: Route | null } | null {
  if (!route && !cfg.sections.length && !cfg.points.length && !cfg.plan) return null
  const rb = newRoadBook(route?.name?.trim() || 'Mon road book', now)
  rb.sections = cfg.sections
  rb.points = cfg.points
  rb.base = cfg.base
  rb.plan = cfg.plan
  return { rb, route }
}
