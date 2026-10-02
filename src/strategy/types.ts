export type PointType = 'eau' | 'ravito' | 'danger' | 'note'
export type Prio = 'critique' | 'action' | 'info'

export interface RoutePoint {
  id: string
  type: PointType
  km: number
  text: string
  /** Annonce, en km avant le point. */
  avant: number
  /** Généré par le plan (remplacé à chaque nouveau plan). */
  gen?: boolean
}

export interface Section {
  id: string
  kind: 'zone' | 'montee'
  name: string
  a: number
  b: number
  /** Cible en % de FTP. */
  min: number
  max: number
  msg: string
  avant: number
  /** Montée détectée automatiquement. */
  auto?: boolean
  gen?: boolean
}

/** Cibles de base en % FTP selon la pente, hors sections. */
export interface BaseRules {
  plat: [number, number]
  montee: [number, number]
  descente: [number, number]
  /** Pente (%) à partir de laquelle on est en montée. */
  gUp: number
  /** Pente (%) en dessous de laquelle on est en descente. */
  gDown: number
}

export const POINT_TYPES: Record<PointType, { i: string; n: string; prio: Prio }> = {
  eau: { i: '💧', n: "Point d'eau", prio: 'action' },
  ravito: { i: '🥪', n: 'Ravito / commerce', prio: 'action' },
  danger: { i: '⚠️', n: 'Danger', prio: 'critique' },
  note: { i: '📝', n: 'Note', prio: 'info' },
}

export const defaultBase = (): BaseRules => ({ plat: [65, 72], montee: [75, 90], descente: [0, 60], gUp: 3.5, gDown: -3 })
