import type { AlertRule, Periodic } from '../alerts/types'
import { uid } from '../core/format'
import type { Route } from '../route/route'
import { defaultBase } from '../strategy/types'
import type { Overrides, RoadBook, RoadBookMeta } from './types'

type OKind = 'alerts' | 'periodic'
export const emptyOverrides = (): Overrides => ({ alerts: {}, periodic: {} })

export function newRoadBook(name: string, now = Date.now()): RoadBook {
  return { id: uid(), name, created: now, updated: now, sections: [], points: [], base: defaultBase(), plan: null, overrides: emptyOverrides(), kind: 'sortie' }
}

/** Copie indépendante (nouvel id), pour une variante. */
export function duplicateRoadBook(rb: RoadBook, now = Date.now()): RoadBook {
  const c = structuredClone(rb)
  return { ...c, id: uid(), name: `${rb.name} (copie)`, created: now, updated: now }
}

export function metaOf(rb: RoadBook, route: Route | null, estH: number | null = null): RoadBookMeta {
  const real = route && !route.synthetic ? route : null
  return {
    id: rb.id, name: rb.name, km: real ? real.total / 1000 : rb.est?.km ?? 0, dplus: real ? Math.round(real.dplus) : rb.est?.dplus ?? 0,
    estH, updated: rb.updated, prof: profile(real), when: rb.when, kind: rb.kind ?? 'sortie', hasRoute: !!real, stops: rb.points.filter(p => !p.gen && (p.stop ?? 0) > 0).length,
  }
}

/** Valeur effective : le défaut global, avec les écarts de ce road book par-dessus. */
const merge = <T extends { id: string }>(defaults: T[], o: Record<string, Partial<T>>): T[] =>
  defaults.map(d => (o[d.id] ? { ...d, ...o[d.id], id: d.id } : d))
export const effectiveAlerts = (defaults: AlertRule[], o: Overrides) => [...merge(defaults, o.alerts), ...(o.extraAlerts ?? [])]
export const effectivePeriodic = (defaults: Periodic[], o: Overrides) => [...merge(defaults, o.periodic), ...(o.extraPeriodic ?? [])]

export const isOverridden = (o: Overrides, kind: OKind, id: string) => id in o[kind]

/** Enregistre un écart ; si la valeur redevient celle du défaut, l'écart disparaît. */
export function setOverride<K extends OKind>(
  o: Overrides, kind: K, base: { id: string }, patch: Record<string, unknown>,
): Overrides {
  const cur = { ...(o[kind][base.id] as object | undefined), ...patch } as Record<string, unknown>
  const diff = Object.fromEntries(Object.entries(cur).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((base as Record<string, unknown>)[k])))
  const next = { ...o[kind] } as Record<string, unknown>
  if (Object.keys(diff).length) next[base.id] = diff
  else delete next[base.id]
  return { ...o, [kind]: next }
}

export function resetOverride(o: Overrides, kind: OKind, id: string): Overrides {
  const next = { ...o[kind] }
  delete next[id]
  return { ...o, [kind]: next }
}

/** 40 points d'altitude ramenés à 0–100, pour une miniature. */
function profile(route: Route | null, n = 40): number[] {
  if (!route || route.n < 2) return []
  const v = Array.from({ length: n }, (_, i) => route.ele[Math.round((i / (n - 1)) * (route.n - 1))])
  const lo = Math.min(...v), hi = Math.max(...v)
  return v.map(x => Math.round(((x - lo) / Math.max(hi - lo, 30)) * 100))
}
