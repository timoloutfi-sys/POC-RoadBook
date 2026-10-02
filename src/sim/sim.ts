import { clamp } from '../core/format'
import { evalRun, newRun, type EvalContext, type RunState } from '../alerts/engine'
import { speedFor, type Body } from '../physics/physics'
import { gradeAt, type Route } from '../route/route'
import type { Target } from '../strategy/target'

/** Coureur virtuel qui suit (plus ou moins) la cible le long du parcours. */
export interface SimState extends RunState {
  v: number
  p: number
  hr: number
  cad: number
  buf: number[]
  surge: number
  outT: number
  done: boolean
  hrHist: number[]
}

export const newSim = (): SimState => ({ ...newRun(), v: 7, p: 150, hr: 105, cad: 88, buf: [], surge: 0, outT: 0, done: false, hrHist: [] })

export interface SimParams {
  route: Route
  body: Body
  ftp: number
  lthr: number
  /** 0 = discipliné, 1 = part trop fort et relance partout. */
  behavior: number
  targetAt: (d: number, hours: number) => Target
  ctx: EvalContext
  rand?: () => number
}

export const avg10 = (buf: number[], fallback: number) => (buf.length ? buf.reduce((a, c) => a + c, 0) / buf.length : fallback)

/** Avance d'une seconde de roulage. */
export function simStep(sim: SimState, P: SimParams) {
  const rnd = P.rand ?? Math.random
  if (sim.done) return []
  if (sim.d >= P.route.total) { sim.done = true; return [] }
  const tg = P.targetAt(sim.d, sim.t / 3600), b = P.behavior, g = gradeAt(P.route, sim.d) / 100
  let intent = ((tg.power.min + tg.power.max) / 2) * (0.97 + 0.12 * b)
  if (tg.kind === 'montee') intent *= 1 + 0.12 * b
  if (sim.surge > 0) { sim.surge--; intent *= 1.2 + 0.25 * b }
  else if (rnd() < 0.0015 + 0.006 * b) sim.surge = 15 + Math.floor(rnd() * 45)
  intent *= 1 - 0.02 * (sim.t / 3600) * (1 - b * 0.5)
  const noise = (rnd() - 0.5) * 0.14 * intent
  sim.p = Math.max(0, sim.p + (intent + noise - sim.p) * 0.3)
  const vt = speedFor(P.body, sim.p, g)
  sim.v += (vt - sim.v) * 0.08
  sim.d += sim.v
  sim.t++
  // FC : suit la puissance avec retard, plus une dérive lente.
  const hrT = P.lthr * (0.54 + (sim.p / P.ftp) * 0.48) + Math.min(9, (sim.t / 3600) * 1.6)
  sim.hr += (hrT - sim.hr) * 0.03
  sim.cad = clamp(89 - Math.max(0, g * 100) * (1.6 + 2.2 * b) + (rnd() - 0.5) * 4, 50, 110)
  sim.buf.push(sim.p)
  if (sim.buf.length > 10) sim.buf.shift()
  const p10 = avg10(sim.buf, sim.p)
  if (sim.t % 5 === 0) { sim.hrHist.push(sim.hr); if (sim.hrHist.length > 120) sim.hrHist.shift() }
  const eff = P.ctx.source === 'power' ? p10 : sim.hr, band = P.ctx.source === 'power' ? tg.power : tg.hr
  if (band && (eff > band.max || eff < band.min)) sim.outT++
  return evalRun(sim, P.ctx, tg, { power: p10, hr: sim.hr, cad: sim.cad, speed: sim.v * 3.6 })
}
