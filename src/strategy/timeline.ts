import { nightAmount } from '../core/daynight'
import { STEP, type Route } from '../route/route'
import type { PlanResult } from './plan'
import type { PointType, RoutePoint, Section } from './types'

export interface TimelineRow {
  id: string
  kind: 'start' | 'end' | 'point' | 'mark'
  icon: PointType | 'route' | 'montee'
  km: number
  label: string
  /** Heure d'arrivée estimée. */
  at: Date | null
  /** Temps de route depuis le départ du point précédent, en s. */
  gapS: number | null
  /** Arrêt prévu, en minutes. */
  stop: number
  night: boolean
}

type Base = Omit<TimelineRow, 'at' | 'gapS' | 'night'>

/**
 * Le road book dans l'ordre du parcours, avec l'heure d'arrivée à chaque ligne.
 * Les arrêts prévus aux points décalent les heures suivantes ; sans aucun arrêt prévu,
 * l'estimation générique est répartie sur tout le parcours.
 */
export function timeline(i: {
  route: Route
  res: Pick<PlanResult, 'cumT' | 'H' | 'stops'>
  points: RoutePoint[]
  marks: Section[]
  start: Date | null
}): TimelineRow[] {
  const { route, res, start } = i
  const L = route.total / 1000
  const first: Base = { id: 'start', kind: 'start', icon: 'route', km: 0, label: 'Départ', stop: 0 }
  const items: Base[] = [
    first,
    ...i.points.filter(p => !p.gen).map((p): Base => ({ id: p.id, kind: 'point' as const, icon: p.type, km: p.km, label: p.text, stop: p.stop ?? 0 })),
    ...i.marks.map((m): Base => ({ id: m.id, kind: 'mark' as const, icon: m.kind === 'montee' ? ('montee' as const) : ('route' as const), km: m.a, label: m.name, stop: 0 })),
  ].sort((a, b) => a.km - b.km)
  const last: Base = { id: 'end', kind: 'end', icon: 'route', km: L, label: 'Arrivée', stop: 0 }
  items.push(last)
  // Garde l'arrivée en dernier même si un point la dépasse
  items.sort((a, b) => (a.id === 'end' ? 1 : b.id === 'end' ? -1 : 0))

  const planned = items.some(r => r.stop > 0)
  const f = planned ? 1 : 1 + (res.stops * 60) / (res.H * 3600)
  let run = 0, prevDepart: number | null = null
  return items.map(r => {
    const idx = Math.min(res.cumT.length - 1, Math.max(0, Math.round((r.km * 1000) / STEP)))
    const sec = res.cumT[idx] * f + run
    const at = start ? new Date(start.valueOf() + sec * 1000) : null
    const row: TimelineRow = {
      ...r, at, gapS: prevDepart == null ? null : sec - prevDepart,
      night: at ? nightAmount(at, route.lat[0], route.lon[0]) > 0.5 : false,
    }
    run += r.stop * 60
    prevDepart = sec + r.stop * 60
    return row
  })
}
