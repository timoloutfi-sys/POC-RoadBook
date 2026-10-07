import { nextReminder, type Banner, type RunState } from '../alerts/engine'
import type { Periodic } from '../alerts/types'
import type { PlanProgress } from './progress'
import { clamp } from '../core/format'
import type { Route } from '../route/route'
import { effectiveFtp, effectiveLthr, type Rider } from '../strategy/rider'
import { targetAt, type Band, type EffortSource, type Target } from '../strategy/target'
import type { BaseRules, PointType, RoutePoint, Section } from '../strategy/types'
import { hrZoneOfPowerZone, powerZoneOf } from '../strategy/zones'
import { gradeAtDist } from '../route/profile'
import { findClimbs } from '../route/route'
import { sunTimes } from '../strategy/sun'
import type { MetricsView } from './metrics'

export interface Upcoming { kind: PointType | 'montee' | 'zone'; name: string; km: number }

/** Tout ce dont les widgets ont besoin, quelle que soit l'origine (capteurs, simulation, aperçu). */
export interface WidgetData {
  source: EffortSource
  effort: number | null
  band: Band | null
  tg: Target
  /** Zone de la section suivante, en numéro de zone de la source (0 = Z1). */
  after: { zone: number; name: string } | null
  /** Secondes restantes dans la section en cours. */
  leftS: number | null
  hr: number | null
  cad: number | null
  speed: number
  km: number
  total: number
  t: number
  vAvg: number
  next: Upcoming[]
  fuel: { s: number; msg: string } | null
  hrHist: number[]
  sev: RunState['sev']
  banner: Banner | null
  now: Date
  arrival: Date | null
  /** FC seuil inconnue : impossible de donner une cible cardio. */
  noLthr: boolean
  /** Avancement par rapport au plan ; null en sortie libre. */
  plan: PlanProgress | null
  /** Puissance (moy. 10 s), indépendante de la source qui pilote la cible. */
  power: number | null
  /** Masse du coureur (kg), pour les W/kg. */
  mass: number
  /** Réserves, zones, dérive, glucides, tour ; null sans moteur (aperçu sans données). */
  m: MetricsView | null
  /** Pente sous les roues (%), null sans parcours. */
  slope: number | null
  climb: ClimbView | null
  sun: { kind: 'set' | 'rise'; at: Date } | null
}

/** Montée en cours (state « in ») ou prochaine dans les 5 km (« next »). */
export interface ClimbView { state: 'in' | 'next'; lenM: number; avg: number; gainM: number; doneM: number; toGoKm: number; steps: { lenM: number; grade: number }[] }

const climbCache = new WeakMap<Route, ReturnType<typeof findClimbs>>()
export function climbView(route: Route, km: number): ClimbView | null {
  let cl = climbCache.get(route)
  if (!cl) { cl = findClimbs(route); climbCache.set(route, cl) }
  const d = km * 1000
  const c = cl.find(x => x.b * 1000 >= d && (x.a * 1000 <= d || x.a * 1000 - d < 5000))
  if (!c) return null
  const a = c.a * 1000, b = c.b * 1000, p = route.profile, steps: ClimbView['steps'] = []
  for (let x = a; x < b; ) {
    const g = Math.round(gradeAtDist(p, x + 1)), y = Math.min(b, x + 100)
    const last = steps[steps.length - 1]
    if (last && last.grade === g) last.lenM += y - x; else steps.push({ lenM: y - x, grade: g })
    x = y
  }
  const inside = a <= d
  return { state: inside ? 'in' : 'next', lenM: b - a, avg: c.avg, gainM: c.gain, doneM: inside ? d - a : 0, toGoKm: inside ? (b - d) / 1000 : (a - d) / 1000, steps }
}

/** Prochain repère solaire : coucher si le soleil est encore haut, lever sinon. */
export function sunView(route: Route, km: number, now: Date): WidgetData['sun'] {
  const i = Math.min(route.n - 1, Math.max(0, Math.round((km * 1000) / 50)))
  const lat = route.lat[i], lon = route.lon[i]
  const t = sunTimes(now, lat, lon)
  if (t.set && now < t.set && (!t.rise || now >= t.rise)) return { kind: 'set', at: t.set }
  if (t.rise && now < t.rise) return { kind: 'rise', at: t.rise }
  const n = sunTimes(new Date(now.valueOf() + 86400e3), lat, lon)
  return n.rise ? { kind: 'rise', at: n.rise } : null
}

export function upcoming(points: RoutePoint[], sections: Section[], km: number, n: number): Upcoming[] {
  const L: Upcoming[] = []
  for (const p of points) if (p.km > km) L.push({ kind: p.type, name: p.text, km: p.km })
  for (const z of sections) if (z.a > km) L.push({ kind: z.kind === 'montee' ? 'montee' : 'zone', name: z.name, km: z.a })
  return L.sort((a, b) => a.km - b.km).slice(0, n)
}

export interface Inputs {
  source: EffortSource
  route: Route | null
  sections: Section[]
  points: RoutePoint[]
  periodic: Periodic[]
  base: BaseRules
  rider: Rider
  run: RunState
  /** Moyenne 10 s en watts. */
  power: number | null
  hr: number | null
  cad: number | null
  /** km/h */
  speed: number
  vAvg: number
  hrHist: number[]
  now: Date
  banner: Banner | null
  plan?: PlanProgress | null
  m?: MetricsView | null
}

export function buildData(i: Inputs): WidgetData {
  const { run, route } = i
  const ftp = effectiveFtp(i.rider), lthr = effectiveLthr(i.rider)
  const km = run.d / 1000, total = route ? route.total / 1000 : 0
  const tg = targetAt(route, i.sections, i.base, ftp, lthr, run.d, run.t / 3600)
  const band = i.source === 'power' ? tg.power : tg.hr
  const zoneOf = (s: Section) => {
    const z = powerZoneOf((s.min + s.max) / 200)
    return i.source === 'power' ? z : hrZoneOfPowerZone(z)
  }
  const nextSec = [...i.sections].sort((a, b) => a.a - b.a).find(s => s.a > km && s !== tg.section)
  const v = Math.max(15, i.vAvg || 28)
  const leftS = tg.section ? Math.max(0, ((tg.section.b - km) / v) * 3600) : null
  const eta = route ? new Date(i.now.valueOf() + ((total - km) / v) * 3600e3) : null
  return {
    source: i.source,
    effort: i.source === 'power' ? i.power : i.hr,
    band, tg,
    after: nextSec ? { zone: zoneOf(nextSec), name: nextSec.name } : null,
    leftS,
    hr: i.hr, cad: i.cad, speed: i.speed, km, total, t: run.t, vAvg: i.vAvg,
    next: route ? upcoming(i.points, i.sections, km, 8) : [],
    fuel: nextReminder(run, i.periodic),
    hrHist: i.hrHist, sev: run.sev, banner: i.banner, now: i.now, arrival: eta,
    noLthr: i.source === 'hr' && !lthr,
    plan: i.plan ?? null,
    power: i.power, mass: i.rider.mass, m: i.m ?? null,
    slope: route ? +gradeAtDist(route.profile, run.d).toFixed(1) : null,
    climb: route ? climbView(route, km) : null,
    sun: route ? sunView(route, km, i.now) : null,
  }
}

/** Données d'aperçu pour l'éditeur d'écrans et les vignettes. */
export function previewData(source: EffortSource = 'power'): WidgetData {
  const tg: Target = { power: { min: 156, max: 173 }, hr: { min: 138, max: 148 }, zone: 1, label: 'Plat', kind: 'plat', section: null }
  const band = source === 'power' ? tg.power : tg.hr!
  return {
    source, effort: source === 'power' ? 168 : 143, band, tg,
    after: { zone: 3, name: 'Montée 1' }, leftS: 11 * 60, hr: 148, cad: 86, speed: 29.4, km: 26.2, total: 152.8, t: 5400, vAvg: 28.4,
    next: [{ kind: 'eau', name: 'Fontaine derrière l’église', km: 31.3 }, { kind: 'montee', name: 'Montée 1', km: 36.7 }, { kind: 'danger', name: 'Gravillons dans le virage à gauche', km: 41.2 }, { kind: 'note', name: 'Ravito de Nogent : ouvert 24 h/24, borne CB à gauche de la porte', km: 47.5 }],
    fuel: { s: 12 * 60, msg: 'Mange' }, hrHist: [140, 142, 141, 144, 146, 145, 147, 148, 147, 148], sev: {}, banner: null,
    now: new Date(2026, 5, 21, 14, 30), arrival: new Date(2026, 5, 21, 19, 5), noLthr: false,
    plan: { nextStop: { name: 'Station 24 h/24', kmAway: 12.4, at: new Date(2026, 5, 21, 15, 10), stopMin: 10 }, gapS: 180, kj: 820, kjPlan: 790 },
    power: 168, mass: 78, slope: 3.2, sun: { kind: 'set', at: new Date(2026, 5, 21, 21, 55) },
    climb: { state: 'in', lenM: 4200, avg: 6.1, gainM: 256, doneM: 1500, toGoKm: 2.7, steps: [{ lenM: 600, grade: 4 }, { lenM: 900, grade: 6 }, { lenM: 800, grade: 8 }, { lenM: 700, grade: 5 }, { lenM: 1200, grade: 7 }] },
    m: {
      punch: 82, endurance: 91, drift: 2.4, zones: [1200, 2900, 900, 300, 100], zoneNow: 1, zoneSince: 5100, inTarget: 68, under: 700, inT: 2900, over: 600,
      carbPerH: 78, carbBurned: 117, carbEaten: 90, carbGap: -27,
      lap: { dur: 840, dist: 6900, p: 171, hr: 147, cad: 86, v: 29.6 }, lastLap: { dur: 1200, dist: 9100, p: 165, hr: 144, cad: 85, v: 27.3 }, laps: 3,
    },
  }
}

export const clampKm = (km: number, total: number) => clamp(km, 0, total)
