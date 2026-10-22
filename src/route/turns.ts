import { project, trackAt, type Track } from './track'

/**
 * Navigation sur le tracé, sans carte ni recalcul : virages lus sur la forme du tracé fin,
 * et, hors parcours, où se trouve le tracé par rapport à la direction du coureur.
 * Calculs purs, réutilisables tel quels sur le boîtier.
 */

export type TurnKind = 'leger' | 'normal' | 'serre' | 'demi'
export interface Turn { d: number; angle: number; side: 'gauche' | 'droite'; kind: TurnKind }

const R = Math.PI / 180
/** Cap (degrés, 0 = nord, sens horaire) de a vers b. */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const y = Math.sin((lon2 - lon1) * R) * Math.cos(lat2 * R)
  const x = Math.cos(lat1 * R) * Math.sin(lat2 * R) - Math.sin(lat1 * R) * Math.cos(lat2 * R) * Math.cos((lon2 - lon1) * R)
  return (Math.atan2(y, x) / R + 360) % 360
}
/** Écart d'angle signé dans [-180, 180] (positif = vers la droite). */
export const delta = (from: number, to: number) => ((to - from + 540) % 360) - 180

const kindOf = (a: number): TurnKind => (a >= 150 ? 'demi' : a >= 110 ? 'serre' : a >= 60 ? 'normal' : 'leger')

/**
 * Virages du tracé : changement de cap mesuré entre 25 m avant et 25 m après chaque point,
 * gardé s'il dépasse 35°, un seul virage par tranche de 40 m (le plus marqué).
 */
export function findTurns(t: Track, win = 25, min = 35, merge = 40): Turn[] {
  const raw: Turn[] = []
  for (let i = 1; i < t.n - 1; i++) {
    const d = t.d[i]
    if (d < win || d > t.total - win) continue
    const a = trackAt(t, d - win), m = trackAt(t, d), b = trackAt(t, d + win)
    const dd = delta(bearing(a.lat, a.lon, m.lat, m.lon), bearing(m.lat, m.lon, b.lat, b.lon))
    if (Math.abs(dd) >= min) raw.push({ d, angle: Math.round(Math.abs(dd)), side: dd > 0 ? 'droite' : 'gauche', kind: kindOf(Math.abs(dd)) })
  }
  const out: Turn[] = []
  for (const x of raw) {
    const last = out[out.length - 1]
    if (last && x.d - last.d < merge) { if (x.angle > last.angle) out[out.length - 1] = x }
    else out.push(x)
  }
  return out
}

/** Prochain virage devant la position `dist` (m), et celui d'après. */
export function nextTurns(turns: Turn[], dist: number): [Turn | null, Turn | null] {
  const i = turns.findIndex(x => x.d > dist + 5)
  return i < 0 ? [null, null] : [turns[i], turns[i + 1] ?? null]
}

export type Side = 'devant' | 'devant à droite' | 'à droite' | 'derrière à droite' | 'derrière' | 'derrière à gauche' | 'à gauche' | 'devant à gauche'
const SIDES: Side[] = ['devant', 'devant à droite', 'à droite', 'derrière à droite', 'derrière', 'derrière à gauche', 'à gauche', 'devant à gauche']
/** Secteur de 45° pour un angle relatif (0 = droit devant, sens horaire). */
export const sideOf = (rel: number): Side => SIDES[Math.round((((rel % 360) + 360) % 360) / 45) % 8]

export interface OffRoute { off: number; dist: number; rel: number; side: Side }
/**
 * Hors parcours : distance au point le plus proche du tracé, et où il se trouve par rapport
 * à la direction du coureur (`heading` en degrés ; null à l'arrêt → par rapport au nord).
 */
export function offRoute(t: Track, lat: number, lon: number, heading: number | null, hint = 0): OffRoute {
  const p = project(t, lat, lon, hint, 400, 2000)
  const q = trackAt(t, p.dist)
  const rel = ((bearing(lat, lon, q.lat, q.lon) - (heading ?? 0)) % 360 + 360) % 360
  return { off: Math.round(p.off), dist: p.dist, rel: Math.round(rel), side: sideOf(rel) }
}
