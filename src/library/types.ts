import type { AlertRule, Periodic } from '../alerts/types'
import type { PlanCfg } from '../strategy/plan'
import type { BaseRules, RoutePoint, Section } from '../strategy/types'
import type { Rider } from '../strategy/rider'

/** Écarts d'un road book aux alertes et rappels par défaut (id du défaut → champs modifiés). */
/** Parcours sans GPX : distance, dénivelé et terrain saisis. */
export interface Estimate { km: number; dplus: number; terrain: 'plat' | 'vallonne' | 'montagne' }

export interface Overrides {
  alerts: Record<string, Partial<AlertRule>>
  periodic: Record<string, Partial<Periodic>>
  /** Alertes et rappels propres à ce road book (en plus des défauts). */
  extraAlerts?: AlertRule[]
  extraPeriodic?: Periodic[]
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
  /** Sortie ou course ; absent = sortie. */
  kind?: 'sortie' | 'course'
  /** Date et heure de départ prévues (heure locale, « 2027-04-10T06:00 »). */
  when?: string
  /** Course sans GPX : estimation à partir de ces valeurs, ignorée dès qu'un tracé existe. */
  est?: Estimate
  /** Notes libres (ravitos annoncés, règlement, matériel). */
  notes?: string
}

/** Ce que la liste affiche, sans charger le tracé. */
export interface RoadBookMeta {
  id: string; name: string; km: number; dplus: number; estH: number | null; updated: number
  /** Profil d'altitude réduit (0 à 100) pour la miniature de la carte. */
  prof: number[]
  when?: string
  kind?: 'sortie' | 'course'
  /** Un tracé existe (faux pour une course en attente de son GPX). */
  hasRoute?: boolean
  /** Nombre d'arrêts prévus aux points. */
  stops?: number
  /** Aperçu du travail fait : points posés, cibles (zones) et repères en fractions du parcours, plan choisi. */
  work?: { points: number[]; bands: { a: number; b: number; z: number }[]; planned: boolean }
}

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
  planSnapshot?: { sections: Section[]; points: RoutePoint[]; base: BaseRules; plan: PlanCfg | null; /** Temps prévu (s depuis le départ, arrêts compris) à chaque ligne du road book. */
    etas: { km: number; t: number }[] }
  riderSnapshot: Pick<Rider, 'ftp' | 'mass' | 'cda' | 'lthr'> & { unit: 'power' | 'hr' }
  summary: RideSummary | null
  events: RideEvent[]
}

/** Un morceau de mesures à 1 Hz (tableaux de même longueur, NaN = absent). */
export interface RideChunk {
  rideId: string
  seq: number
  /** Heure de chaque mesure, ms depuis 1970. */
  t: Float64Array
  km: Float32Array
  speed: Float32Array
  power: Float32Array
  hr: Float32Array
  cad: Float32Array
  ele: Float32Array
  /** Position GPS (degrés) ; NaN sans signal. Absent sur les sorties enregistrées avant l'export. */
  lat?: Float64Array
  lon?: Float64Array
  moving: Uint8Array
  /** Effort dans la cible : 0 sans cible, 1 dedans, 2 dehors. */
  tgt: Uint8Array
}
