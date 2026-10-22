import type { Route } from '../route/route'
import { trackAt } from '../route/track'
import { bearing, findTurns, nextTurns, offRoute, type Side, type Turn } from '../route/turns'

/**
 * Navigation pendant la sortie, sans carte ni recalcul : prochain virage, hors parcours, annonces.
 * Calculs purs et bornés, refaisables tels quels sur le boîtier.
 */

/** Écart au tracé au-delà duquel on est hors parcours (m), pendant 5 s ; retour sous 60 % de l'écart. */
export const NAV_OFF_M = 40
const OFF_HOLD_S = 5

export type NavCueMode = 'both' | 'vibe' | 'beep' | 'off'
/** Annonce des virages : comment, et à quelle distance avant le virage (m). */
export interface NavCueCfg { mode: NavCueMode; at: number }
export const defaultNavCue = (): NavCueCfg => ({ mode: 'both', at: 150 })

const cache = new WeakMap<Route, Turn[]>()
/** Virages du parcours, lus une fois sur le tracé fin. */
export function turnsOf(r: Route): Turn[] {
  let t = cache.get(r)
  if (!t) { t = findTurns(r.track); cache.set(r, t) }
  return t
}

export interface NavView {
  /** Prochain virage et sa distance (m), puis celui d'après et l'écart entre les deux. */
  turn: Turn | null
  inM: number | null
  then: Turn | null
  thenM: number | null
  /** Hors parcours : écart (m), direction du tracé par rapport à ta marche, point du tracé le plus proche. */
  off: { m: number; rel: number; side: Side; lat: number; lon: number } | null
  /** Position et cap (degrés) pour la carte. */
  lat: number
  lon: number
  heading: number
  /** Distance faite sur le parcours (m), et restante jusqu'à l'arrivée. */
  d: number
  left: number
  /** Aperçu (éditeur, vignettes) : pas de vraie carte. */
  preview?: boolean
}

/** Position GPS ; `off` vient du moteur (hors parcours confirmé après 5 s), pas d'un seul point. */
export interface NavGps { lat: number; lon: number; heading: number | null; off: boolean }

/** Cap du tracé à la distance d (m), lissé sur 30 m. */
export function trackHeading(r: Route, d: number) {
  const a = trackAt(r.track, Math.max(0, d - 10)), b = trackAt(r.track, Math.min(r.track.total, d + 20))
  return bearing(a.lat, a.lon, b.lat, b.lon)
}

export function navView(r: Route, d: number, gps?: NavGps | null): NavView {
  const turns = turnsOf(r), [t1, t2] = nextTurns(turns, d)
  if (gps?.off) {
    const o = offRoute(r.track, gps.lat, gps.lon, gps.heading, d), q = trackAt(r.track, o.dist)
    return { turn: null, inM: null, then: null, thenM: null, off: { m: o.off, rel: o.rel, side: o.side, lat: q.lat, lon: q.lon }, lat: gps.lat, lon: gps.lon, heading: gps.heading ?? trackHeading(r, d), d, left: r.track.total - d }
  }
  // Sur le parcours, la position est celle recalée sur le tracé : le chevron reste sur la ligne.
  const here = trackAt(r.track, d)
  return {
    turn: t1, inM: t1 ? Math.max(0, t1.d - d) : null, then: t2, thenM: t1 && t2 ? t2.d - t1.d : null, off: null,
    lat: here.lat, lon: here.lon, heading: trackHeading(r, d), d, left: r.track.total - d,
  }
}

export type NavCue = 'approche' | 'virage' | 'hors' | 'retour'
export interface NavCueState { approach: number; now: number; off: boolean; offFor: number }
export const newNavCues = (): NavCueState => ({ approach: -1, now: -1, off: false, offFor: 0 })

/**
 * Une seconde d'annonces : « approche » à `at` m du virage, « virage » juste avant (2 s ou 20 m),
 * « hors » après 5 s à plus de 40 m du tracé, « retour » quand on le rejoint.
 */
export function navCues(s: NavCueState, turns: Turn[], d: number, speed: number, offM: number | null, at: number): NavCue[] {
  const out: NavCue[] = []
  if (offM != null && offM > NAV_OFF_M) {
    s.offFor++
    if (!s.off && s.offFor >= OFF_HOLD_S) { s.off = true; out.push('hors') }
    return out
  }
  s.offFor = 0
  if (s.off) {
    if (offM != null && offM > NAV_OFF_M * 0.6) return out
    s.off = false; out.push('retour')
  }
  if (speed < 1.5) return out
  const [t] = nextTurns(turns, d)
  if (!t) return out
  const left = t.d - d
  if (left <= Math.max(20, speed * 2)) {
    if (s.now !== t.d) { s.now = t.d; s.approach = t.d; out.push('virage') }
  } else if (left <= at && s.approach !== t.d) { s.approach = t.d; out.push('approche') }
  return out
}
