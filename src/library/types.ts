import type { AlertRule, Periodic } from '../alerts/types'
import type { PlanCfg } from '../strategy/plan'
import type { BaseRules, RoutePoint, Section } from '../strategy/types'
import type { Rider } from '../strategy/rider'

/** Écarts d'un road book aux alertes et rappels par défaut (id du défaut → champs modifiés). */
export interface Overrides {
  alerts: Record<string, Partial<AlertRule>>
  periodic: Record<string, Partial<Periodic>>
}

/** Un parcours préparé : annotations, cibles et réglages. Le tracé est stocké à part. */
export interface RoadBook {
  id: string
  name: string
  created: number
  updated: number
  sections: Section[]
  points: RoutePoint[]
  base: BaseRules
  plan: PlanCfg | null
  /** Écran de départ ; absent = écran actif par défaut. */
  startScreen?: string
  overrides: Overrides
}

/** Ce que la liste affiche, sans charger le tracé. */
export interface RoadBookMeta { id: string; name: string; km: number; dplus: number; estH: number | null; updated: number }

export type RideKind = 'roadbook' | 'libre' | 'simu'

export interface RideEvent { t: number; km: number; type: 'stop' | 'resume' | 'point' | 'reminder' | 'alert'; ref?: string; ok?: boolean }

export interface RideSummary {
  km: number; moving: number; total: number; dplus: number
  np: number | null; avgP: number | null; avgHr: number | null; kcal: number | null
  inTarget: number | null; deltaArrival: number | null; remindersDone: number; remindersTotal: number
}

export interface Ride {
  id: string
  name: string
  kind: RideKind
  start: number
  end: number | null
  roadbookId?: string
  roadbookName?: string
  /** Copie figée du plan au départ, pour comparer même si le road book change ensuite. */
  planSnapshot?: { sections: Section[]; points: RoutePoint[]; plan: PlanCfg | null; etas: { id: string; t: number }[] }
  riderSnapshot: Pick<Rider, 'ftp' | 'mass' | 'cda' | 'lthr'> & { unit: 'power' | 'hr' }
  summary: RideSummary | null
  events: RideEvent[]
}

/** Un morceau de mesures à 1 Hz (tableaux de même longueur, NaN = absent). */
export interface RideChunk {
  rideId: string
  seq: number
  t0: number
  km: Float32Array
  speed: Float32Array
  power: Float32Array
  hr: Float32Array
  cad: Float32Array
  ele: Float32Array
  moving: Uint8Array
}
