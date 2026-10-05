import type { AlertRule, Periodic } from '../alerts/types'
import { deserializeRoute, serializeRoute, type Route } from '../route/route'
import { effectiveFtp, effectiveLthr, type Rider } from '../strategy/rider'
import type { BaseRules, RoutePoint, Section } from '../strategy/types'
import type { rideState } from './scope'

export const BUNDLE_VERSION = 1

/**
 * Paquet de sortie : tout ce dont la sortie a besoin, et rien d'autre. Préparé sur le téléphone,
 * il pilote le moteur (`ride/engine.ts`) ; plus tard il sera envoyé au boîtier du vélo.
 */
export interface RideBundle {
  v: number
  /** Parcours (tracé fin et profil) ; null en sortie libre. */
  route: Route | null
  sections: Section[]
  points: RoutePoint[]
  base: BaseRules
  alerts: AlertRule[]
  periodic: Periodic[]
  maxPerHour: number
  ftp: number
  lthr: number | null
  /** Masse du coureur (kg). */
  mass: number
}

/** Paquet de la sortie à partir de l'état préparé (`rideState()` : road book courant, ou sortie libre). */
export function bundleOf(c: ReturnType<typeof rideState>): RideBundle {
  return {
    v: BUNDLE_VERSION, route: c.route, sections: c.sections, points: c.points, base: c.base,
    alerts: c.alerts, periodic: c.periodic, maxPerHour: c.maxPerHour, ftp: effectiveFtp(c.rider as Rider), lthr: effectiveLthr(c.rider as Rider), mass: c.rider.mass,
  }
}

/** Forme transmissible (JSON) : le parcours est réduit aux points du tracé fin. */
export const serializeBundle = (b: RideBundle) => JSON.stringify({ ...b, route: b.route ? serializeRoute(b.route) : null })

export function deserializeBundle(s: string): RideBundle {
  const d = JSON.parse(s)
  if (d.v !== BUNDLE_VERSION) throw new Error('Paquet de sortie d’une autre version.')
  return { ...d, route: d.route ? deserializeRoute(d.route) : null }
}
