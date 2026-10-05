import type { Prio } from '../strategy/types'

/** « effort » = la mesure qui pilote la cible : puissance si capteur, sinon FC. */
export type Metric = 'effort' | 'power' | 'hr' | 'cad' | 'speed'

export interface AlertRule {
  id: string
  on: boolean
  name: string
  metric: Metric
  op: '>' | '<'
  /** Référence : bornes de la cible du moment, ou valeur fixe. */
  ref: 'max' | 'min' | 'val'
  val: number
  /** Durée continue avant déclenchement, en s. */
  dur: number
  /** Délai minimum entre deux déclenchements, en min. */
  cool: number
  prio: Prio
  msg: string
}

export interface Periodic { id: string; on: boolean; every: number; msg: string; prio: Prio; auto?: boolean
  /** Glucides (g) comptés quand on valide le rappel. */
  grams?: number }

export const METRICS: Record<Metric, { n: string; l: string; u: string }> = {
  effort: { n: "l'effort (puissance, ou FC sans capteur)", l: 'Effort', u: '' },
  power: { n: 'la puissance (moy. 10 s)', l: 'Puissance', u: 'W' },
  hr: { n: 'la FC', l: 'FC', u: 'bpm' },
  cad: { n: 'la cadence', l: 'Cadence', u: 'rpm' },
  speed: { n: 'la vitesse', l: 'Vitesse', u: 'km/h' },
}

export const PRIO_LABEL: Record<Prio, string> = { critique: 'Critique', action: 'Action', info: 'Info' }
