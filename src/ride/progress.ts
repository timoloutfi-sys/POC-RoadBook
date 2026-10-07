import { plannedAt } from '../library/summary'
import type { PlanResult } from '../strategy/plan'
import type { TimelineRow } from '../strategy/timeline'

/** Où en est la sortie par rapport au plan : prochain arrêt, écart de temps, effort cumulé. */
export interface PlanProgress {
  nextStop: { name: string; kmAway: number; at: Date | null; stopMin: number } | null
  /** Secondes de retard sur le plan au km actuel (négatif = en avance). */
  gapS: number | null
  /** Travail réalisé et prévu au km actuel, en kJ ; null sans capteur de puissance. */
  kj: number | null
  kjPlan: number | null
  /** Heure de départ réelle (ms) et durée prévue jusqu'à l'arrivée (s) : « prévu » = départ réel + durée prévue. */
  startedAt: number | null
  plannedEndS: number | null
}

const cache = new WeakMap<PlanResult, Float64Array>()

/** Travail cumulé prévu (kJ) à chaque échantillon du plan. */
export function plannedKj(res: Pick<PlanResult, 'ratio' | 'cumT'>, ftp: number): Float64Array {
  const hit = cache.get(res as PlanResult)
  if (hit) return hit
  const n = res.cumT.length, out = new Float64Array(n)
  for (let i = 1; i < n; i++) out[i] = out[i - 1] + (res.ratio[i] * ftp * (res.cumT[i] - res.cumT[i - 1])) / 1000
  cache.set(res as PlanResult, out)
  return out
}

export const plannedKjAt = (res: Pick<PlanResult, 'ratio' | 'cumT'>, ftp: number, km: number) =>
  plannedKj(res, ftp)[Math.min(res.cumT.length - 1, Math.max(0, Math.round((km * 1000) / 50)))]

/** Prochain point d'eau, ravito ou arrêt prévu devant. */
export function nextStopOf(rows: TimelineRow[], km: number): PlanProgress['nextStop'] {
  const r = rows.find(x => x.kind === 'point' && x.km > km + 0.05 && (x.stop > 0 || x.icon === 'eau' || x.icon === 'ravito'))
  return r ? { name: r.label || (r.icon === 'eau' ? "Point d'eau" : 'Ravito'), kmAway: r.km - km, at: r.at, stopMin: r.stop } : null
}

/** Décale une heure du plan (calculée pour le départ prévu) sur le départ réel de la sortie. */
export const rebase = (at: Date | null, plannedStart: Date, realStartMs: number | null) =>
  at && realStartMs != null ? new Date(at.valueOf() + (realStartMs - plannedStart.valueOf())) : at

export const gapOf = (etas: { km: number; t: number }[], km: number, elapsedS: number) => {
  const p = plannedAt(etas, km)
  return p == null ? null : elapsedS - p
}
