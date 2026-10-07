import type { AlertRule, Periodic } from '../alerts/types'
import { uid } from '../core/format'
import { defaultRider, type Rider } from '../strategy/rider'
import type { SensorKind } from '../sensors/ble'
import { defaultPlanCfg, type PlanCfg } from '../strategy/plan'
import { defaultBase, type BaseRules, type RoutePoint, type Section } from '../strategy/types'

import { LEGACY, WIDGETS, defOf, fitSize, type WidgetKind } from './catalog'

export { WIDGETS, type WidgetKind }
export interface WidgetItem {
  id: string; k: WidgetKind; x: number; y: number; w: number; h: number
  /** Réglages du widget (voir le catalogue) : plage du profil, moyenne de la vitesse, arrêts seulement… */
  o?: Record<string, string | number | boolean>
}

export const COLS = 6
export const ROWS = 3
/** Grille d'un écran : 6 × 3 en paysage, 3 × 6 en portrait. */
export interface Grid { cols: number; rows: number }
export const LANDSCAPE: Grid = { cols: COLS, rows: ROWS }
export const PORTRAIT: Grid = { cols: ROWS, rows: COLS }

type Tpl = [WidgetKind, number, number, number, number][]
export const TEMPLATES = {
  course: { n: 'Course', items: [['effort', 0, 0, 2, 2], ['target', 2, 0, 2, 1], ['next', 4, 0, 2, 1], ['profile', 2, 1, 4, 1], ['hr', 0, 2, 1, 1], ['fuel', 1, 2, 1, 1], ['gap', 2, 2, 2, 1], ['arrival', 4, 2, 2, 1]] },
  entrainement: { n: 'Entraînement', items: [['effort', 0, 0, 2, 2], ['zone', 2, 0, 2, 1], ['intarget', 4, 0, 2, 1], ['zones', 2, 1, 2, 2], ['hr', 4, 1, 1, 1], ['cad', 5, 1, 1, 1], ['punch', 0, 2, 2, 1], ['lap', 4, 2, 2, 1]] },
  libre: { n: 'Sortie libre', items: [['effort', 0, 0, 2, 2], ['hr', 2, 0, 1, 1], ['cad', 3, 0, 1, 1], ['speed', 4, 0, 2, 1], ['zone', 2, 1, 2, 1], ['intarget', 4, 1, 2, 1], ['dist', 0, 2, 2, 1], ['time', 2, 2, 2, 1], ['clock', 4, 2, 2, 1]] },
} satisfies Record<string, { n: string; items: Tpl }>
export const mkLayout = (k: keyof typeof TEMPLATES): WidgetItem[] =>
  (TEMPLATES[k].items as Tpl).map(([kind, x, y, w, h]) => ({ id: uid(), k: kind, x, y, w, h }))

/**
 * Remet les widgets d'un écran enregistré dans la forme actuelle : anciens identifiants remplacés,
 * widgets inconnus retirés, tailles ramenées à une taille autorisée (jamais agrandies : pas de chevauchement).
 */
export function normalizeItems(items: WidgetItem[]): WidgetItem[] {
  const out: WidgetItem[] = []
  for (const it of items) {
    const leg = LEGACY[it.k as string], k = ((it.k as string) === 'power' ? 'effort' : leg ? leg.k : it.k) as WidgetKind
    if (!defOf(k)) continue
    const s = fitSize(k, it.w, it.h)
    if (!s) continue
    out.push({ ...it, k, w: s[0], h: s[1], ...(leg?.o || it.o ? { o: { ...leg?.o, ...it.o } } : {}) })
  }
  return out
}

/** Un écran de course : une disposition nommée de widgets. */
export interface ScreenDef {
  id: string; name: string
  /** Disposition paysage (6 × 3). */
  items: WidgetItem[]
  /** Disposition portrait (3 × 6), générée depuis le paysage tant qu'elle n'a pas été modifiée. */
  portrait?: WidgetItem[]
}

export type RideTheme = 'auto' | 'day' | 'night'

export const defaultAlerts = (): AlertRule[] => [
  { id: uid(), on: true, name: 'Trop fort', metric: 'effort', op: '>', ref: 'max', val: 0, dur: 30, cool: 3, prio: 'action', msg: 'Trop fort : reviens sous {max}' },
  { id: uid(), on: true, name: 'Sous la cible', metric: 'effort', op: '<', ref: 'min', val: 0, dur: 90, cool: 5, prio: 'info', msg: 'Sous la cible : vise {min}–{max}' },
  { id: uid(), on: true, name: 'Cadence basse', metric: 'cad', op: '<', ref: 'val', val: 78, dur: 45, cool: 5, prio: 'info', msg: 'Cadence basse ({val} rpm) : mouline' },
]

export const defaultPeriodic = (): Periodic[] => [
  { id: uid(), on: true, every: 20, msg: 'Mange : 30 g de glucides', prio: 'action' },
  { id: uid(), on: true, every: 15, msg: 'Bois quelques gorgées', prio: 'info' },
]

export interface Config {
  rider: Rider
  /** Circonférence de roue, mm. */
  wheel: number
  base: BaseRules
  sections: Section[]
  points: RoutePoint[]
  alerts: AlertRule[]
  periodic: Periodic[]
  maxPerHour: number
  screens: ScreenDef[]
  activeScreen: string
  rideTheme: RideTheme
  /** Plan de course choisi dans l'onglet Plan ; null tant que rien n'est choisi. */
  plan: PlanCfg | null
  /** Capteurs déjà connectés une fois : on les retrouve sans refaire toute la recherche. */
  sensors: Partial<Record<SensorKind, { id: string; name: string }>>
  /** Le profil coureur a été rempli une première fois. */
  onboarded: boolean
  /** Road book choisi dans Rouler : son id, « libre » pour une sortie libre, null tant que rien n'est choisi. */
  activeRoadbook: string | null
  /** Sortie libre : ni parcours ni plan, seulement les alertes et rappels globaux. */
  libre: boolean
  /** Road book objectif (une course datée) ; null tant qu'il n'y en a pas. */
  goalId: string | null
  /** Le travail en cours a été repris dans la bibliothèque de road books. */
  libraryMigrated: boolean
}

export const defaultConfig = (): Config => {
  const main: ScreenDef = { id: uid(), name: 'Principal', items: mkLayout('course') }
  return {
    rider: defaultRider(), wheel: 2146, base: defaultBase(), sections: [], points: [],
    alerts: defaultAlerts(), periodic: defaultPeriodic(), maxPerHour: 10,
    screens: [main], activeScreen: main.id, rideTheme: 'auto', plan: null, sensors: {}, onboarded: false,
    activeRoadbook: null, libre: false, goalId: null, libraryMigrated: false,
  }
}

/**
 * Remet une configuration relue (ancien format compris) dans la forme actuelle :
 * l'ancienne `layout` devient l'écran « Principal », « power » devient « effort ».
 */
export function migrateConfig(c: Config & { layout?: WidgetItem[] }): Config {
  const base = defaultConfig()
  const out: Config = { ...base, ...c, rider: { ...base.rider, ...c.rider }, base: { ...base.base, ...c.base } }
  // Les cibles se règlent dans le Plan : l'ancienne section manuelle avec cible devient une cible imposée,
  // les montées détectées deviennent de simples repères.
  const old = out.sections.filter(s => !s.gen && !s.auto && !s.mark && !s.locked)
  if (old.length) {
    const cur = out.plan ?? defaultPlanCfg()
    out.plan = { ...cur, imposed: [...(cur.imposed ?? []), ...old.map(s => ({ ...s, locked: true, gen: false }))] }
    out.sections = out.sections.filter(s => !old.includes(s))
  }
  out.sections = out.sections.map(s => (s.auto ? { ...s, mark: true } : s))
  // Le plan est toujours « tes cibles » : les anciens modes automatiques n'existent plus.
  if (out.plan) out.plan = { ...defaultPlanCfg(), ...out.plan, mode: 'manuel', intensity: null, targetHours: null, minutes: {} }
  if (!out.screens?.length || c.screens === undefined) {
    const items = c.layout?.length ? c.layout : mkLayout('course')
    out.screens = [{ id: uid(), name: 'Principal', items }]
  }
  out.screens = out.screens.map(sc => ({
    ...sc,
    items: normalizeItems(sc.items),
  }))
  if (!out.screens.some(sc => sc.id === out.activeScreen)) out.activeScreen = out.screens[0].id
  delete (out as Config & { layout?: unknown }).layout
  return out
}
