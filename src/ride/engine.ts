import { avg10 } from '../sim/sim'
import { evalRun, smoothSev, type EvalContext, type RunState } from '../alerts/engine'
import { targetAt, type EffortSource, type Target } from '../strategy/target'
import type { Prio } from '../strategy/types'
import type { RideBundle } from './bundle'
import { Position } from './position'

/**
 * Moteur de sortie : pur, sans DOM ni store. Il ne lit que le paquet et les mesures ; appelé chaque seconde.
 * Mémoire bornée (tampon de 10 mesures, 120 points de FC) : seul l'enregistrement grandit, ailleurs.
 */
export interface EngineState {
  run: RunState
  pos: Position
  /** Dernières puissances (10 s). */
  pBuf: number[]
  /** Distance parcourue en roulant (m). */
  movD: number
  /** Travail cumulé (kJ), et vrai s'il y a eu un capteur de puissance. */
  kj: number
  kjSeen: boolean
  /** FC toutes les 5 s en mouvement (10 min). */
  hrHist: number[]
}

export interface Measures {
  power: number | null
  hr: number | null
  cad: number | null
  /** Vitesse en m/s. */
  speed: number
  /** Dernier recalage du GPS sur le tracé (m), à fournir une seule fois ; null sinon. */
  fix: number | null
  source: EffortSource
}

export interface TickOut {
  moving: boolean
  /** 0 : pas de cible, 1 : dans la cible, 2 : en dehors. */
  tgt: 0 | 1 | 2
  /** Puissance moyenne sur 10 s, ou null sans capteur. */
  power: number | null
  target: Target | null
  signals: Prio[]
}

export function newEngine(run: RunState, d = 0, total?: number): EngineState {
  const pos = new Position(total); pos.reset(d, total); run.d = d
  return { run, pos, pBuf: [], movD: d, kj: 0, kjSeen: false, hrHist: [] }
}

/** Une seconde de sortie : position, tampons, cible, alertes. `now` en ms (durée des bandeaux). */
export function tick(s: EngineState, b: RideBundle, m: Measures, now: number): TickOut {
  const st = s.run
  if (m.fix != null) s.pos.fix(m.fix)
  if (b.route) st.d = s.pos.step(1, m.speed)
  if (m.power != null) { s.pBuf.push(m.power); if (s.pBuf.length > 10) s.pBuf.shift() } else s.pBuf = []
  const power = s.pBuf.length ? avg10(s.pBuf, 0) : null
  if (m.speed <= 0.8) { smoothSev(st, {}); return { moving: false, tgt: 0, power, target: null, signals: [] } }

  st.t++; s.movD += m.speed
  if (m.power != null) { s.kj += m.power / 1000; s.kjSeen = true }
  if (st.t % 5 === 0 && m.hr != null) { s.hrHist.push(m.hr); if (s.hrHist.length > 120) s.hrHist.shift() }
  const ctx: EvalContext = { alerts: b.alerts, points: b.points, sections: b.sections, periodic: b.periodic, maxPerHour: b.maxPerHour, source: m.source, now }
  const target = targetAt(b.route, b.sections, b.base, b.ftp, b.lthr, st.d, st.t / 3600)
  const p10 = s.pBuf.length ? avg10(s.pBuf, NaN) || null : null
  const val = m.source === 'power' ? p10 : m.hr, band = m.source === 'power' ? target.power : target.hr
  let tgt: 0 | 1 | 2 = 0
  if (val != null && band && st.t - st.targetSince >= (m.source === 'hr' ? 120 : 0)) tgt = val > band.max || val < band.min ? 2 : 1
  const signals = evalRun(st, ctx, target, { power: p10, hr: m.hr, cad: (m.cad ?? 0) > 0 ? m.cad : null, speed: m.speed * 3.6 })
  return { moving: true, tgt, power, target, signals }
}
