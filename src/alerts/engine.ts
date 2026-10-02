import { clamp, nf1 } from '../core/format'
import { sectionAt, type EffortSource, type Target } from '../strategy/target'
import { POINT_TYPES, type Prio, type RoutePoint, type Section } from '../strategy/types'
import type { AlertRule, Periodic } from './types'

export type SevMetric = 'power' | 'hr' | 'cad' | 'speed'
export interface Sev { k: number; dir: 'hi' | 'lo'; crit: boolean }

export interface LogEntry { km: number; t: number; prio: Prio; msg: string }
export interface Banner { prio: Prio; msg: string; until: number }

export interface RunState {
  /** Temps de roulage en s (ne compte que quand on avance). */
  t: number
  /** Distance sur le parcours, m. */
  d: number
  cnt: Record<string, number>
  held: Record<string, number>
  last: Record<string, number>
  hour: number[]
  log: LogEntry[]
  firedP: Set<string>
  firedZ: Set<string>
  zoneId: string | null
  banner: Banner | null
  emitted: number
  filtered: number
  perLast: Record<string, number>
  lastPerId: string | null
  /** Sévérité lissée par mesure : colore les bords et le widget. */
  sev: Partial<Record<SevMetric, Sev>>
  /** Début de la cible en cours (s), pour laisser la FC se stabiliser. */
  targetKey: string
  targetSince: number
}

export const newRun = (): RunState => ({
  t: 0, d: 0, cnt: {}, held: {}, last: {}, hour: [], log: [], firedP: new Set(), firedZ: new Set(),
  zoneId: null, banner: null, emitted: 0, filtered: 0, perLast: {}, lastPerId: null, sev: {},
  targetKey: '', targetSince: 0,
})

export interface EvalContext {
  alerts: AlertRule[]
  points: RoutePoint[]
  sections: Section[]
  periodic: Periodic[]
  maxPerHour: number
  /** Mesure qui pilote la cible. */
  source: EffortSource
  /** Horloge pour la durée des bandeaux (ms). */
  now: number
}

export interface Values { power: number | null; hr: number | null; cad: number | null; speed: number | null }

/** Le cœur met 1 à 3 min à se stabiliser : délais spécifiques au pilotage cardio. */
export const HR_MIN_DUR = 60
export const HR_GRACE = 120

/** Écart relatif qui donne la sévérité maximale. */
const SEV_SCALE: Record<SevMetric, number> = { power: 0.25, hr: 0.06, cad: 0.15, speed: 0.2 }

const unitOf = (s: EffortSource) => (s === 'power' ? 'W' : 'bpm')
const effortBand = (tg: Target, s: EffortSource) => (s === 'power' ? tg.power : tg.hr)

export function fmtMsg(s: string, min: number, max: number, v: number) {
  return s.replace(/\{min\}/g, String(min)).replace(/\{max\}/g, String(max)).replace(/\{val\}/g, String(Math.round(v)))
}

/** Ajoute un message au journal. Les alertes de seuil sont plafonnées par heure, pas les critiques. */
export function emit(st: RunState, ctx: Pick<EvalContext, 'maxPerHour' | 'now'>, prio: Prio, msg: string, capped = false, quiet = false): boolean {
  st.hour = st.hour.filter(x => st.t - x < 3600)
  if (capped && prio !== 'critique') {
    if (st.hour.length >= ctx.maxPerHour) { st.filtered++; return false }
    st.hour.push(st.t)
  }
  st.emitted++
  st.log.unshift({ km: st.d / 1000, t: st.t, prio, msg })
  if (st.log.length > 300) st.log.pop()
  if (!quiet) st.banner = { prio, msg, until: ctx.now + (prio === 'critique' ? 4000 : 2800) }
  return true
}

/** Lissage : la couleur monte vite vers l'écart réel, redescend en fondu. */
export function smoothSev(st: RunState, raw: Partial<Record<SevMetric, Sev>>) {
  for (const m of ['power', 'hr', 'cad', 'speed'] as SevMetric[]) {
    const t = raw[m], c = st.sev[m]
    if (t) {
      if (c && c.dir === t.dir) { c.k += (t.k - c.k) * 0.25; c.crit = t.crit }
      else st.sev[m] = { k: t.k * 0.4, dir: t.dir, crit: t.crit }
    } else if (c) {
      c.k *= 0.7
      c.crit = false
      if (c.k < 0.06) delete st.sev[m]
    }
  }
}

/**
 * Évalue une seconde de roulage. Retourne les priorités des messages émis
 * (pour vibrer ou biper), dans l'ordre.
 */
export function evalRun(st: RunState, ctx: EvalContext, tg: Target, vals: Values): Prio[] {
  const signals: Prio[] = []
  const say = (prio: Prio, msg: string, capped = false, quiet = false) => {
    if (emit(st, ctx, prio, msg, capped, quiet)) signals.push(prio)
  }
  const band = effortBand(tg, ctx.source)
  const key = `${tg.label}|${band?.min}|${band?.max}`
  if (key !== st.targetKey) { st.targetKey = key; st.targetSince = st.t }

  const raw: Partial<Record<SevMetric, Sev>> = {}
  for (const a of ctx.alerts) {
    if (!a.on) continue
    const metric: SevMetric = a.metric === 'effort' ? ctx.source : a.metric
    const v = vals[metric]
    const isEffort = a.metric === 'effort' || (a.ref !== 'val' && (a.metric === 'power' || a.metric === 'hr'))
    const b = isEffort ? (metric === 'power' ? tg.power : tg.hr) : null
    const ref = a.ref === 'val' || !b ? a.val : a.ref === 'max' ? b.max : b.min
    const hrLag = metric === 'hr' && isEffort
    if (v == null || !isFinite(v) || (isEffort && !b) || (hrLag && st.t - st.targetSince < HR_GRACE)) {
      st.cnt[a.id] = 0; st.held[a.id] = 0
      continue
    }
    const dur = hrLag ? Math.max(a.dur, HR_MIN_DUR) : a.dur
    const ok = a.op === '>' ? v > ref : v < ref
    st.cnt[a.id] = ok ? (st.cnt[a.id] || 0) + 1 : 0
    st.held[a.id] = ok ? (st.held[a.id] || 0) + 1 : 0
    if (ok && st.held[a.id] >= Math.min(dur, 5)) {
      const ex = (a.op === '>' ? v - ref : ref - v) / Math.max(1, Math.abs(ref))
      const k = clamp(ex / SEV_SCALE[metric], 0.15, 1), cur = raw[metric], dir = a.op === '>' ? 'hi' : 'lo'
      raw[metric] = cur && cur.k >= k ? { ...cur, crit: cur.crit || a.prio === 'critique' } : { k, dir, crit: (cur?.crit ?? false) || a.prio === 'critique' }
    }
    if (st.cnt[a.id] >= dur && st.t - (st.last[a.id] ?? -1e9) >= a.cool * 60) {
      st.last[a.id] = st.t
      st.cnt[a.id] = 0
      const bb = b ?? { min: a.val, max: a.val }
      say(a.prio, fmtMsg(a.msg, bb.min, bb.max, v), true, true)
    }
  }
  smoothSev(st, raw)

  // Annonces du parcours : une seule fois chacune.
  const km = st.d / 1000
  for (const p of ctx.points) {
    if (st.firedP.has(p.id)) continue
    if (km >= p.km - p.avant && km <= p.km + 0.2) {
      st.firedP.add(p.id)
      const dd = p.km - km, pt = POINT_TYPES[p.type]
      say(pt.prio, `${pt.i} ${p.text || pt.n} ${dd > 0.15 ? 'dans ' + nf1(dd) + ' km' : 'ici'}`)
    } else if (km > p.km + 0.2) st.firedP.add(p.id)
  }
  for (const z of ctx.sections) {
    if (st.firedZ.has(z.id)) continue
    if (km >= z.a - (z.avant || 0) && km < z.a) {
      st.firedZ.add(z.id)
      say('action', `${z.name} dans ${nf1(z.a - km)} km${z.msg ? '. ' + z.msg : ''}`)
    } else if (km >= z.a) st.firedZ.add(z.id)
  }
  const zc = sectionAt(ctx.sections, km), zid = zc?.id ?? null
  if (zid !== st.zoneId) {
    st.zoneId = zid
    if (zc && band) say('info', `${zc.name} : cible ${band.min}–${band.max} ${unitOf(ctx.source)}`)
  }

  // Rappels périodiques, en temps de roulage.
  for (const p of ctx.periodic) {
    if (!p.on || !(p.every > 0)) continue
    const l = st.perLast[p.id] ?? 0
    if (st.t - l >= p.every * 60) { st.perLast[p.id] = st.t; st.lastPerId = p.id; say(p.prio, p.msg) }
  }
  return signals
}

/** Prochain rappel périodique : secondes restantes et message. */
export function nextReminder(st: RunState, periodic: Periodic[]) {
  let best: { s: number; msg: string } | null = null
  for (const p of periodic) {
    if (!p.on || !(p.every > 0)) continue
    const s = Math.max(0, p.every * 60 - (st.t - (st.perLast[p.id] ?? 0)))
    if (!best || s < best.s) best = { s, msg: p.msg }
  }
  return best
}

/** « Fait » : valide le dernier rappel et relance son minuteur. */
export function ackReminder(st: RunState, periodic: Periodic[], now: number) {
  const id = st.lastPerId ?? periodic.find(x => x.on)?.id
  if (!id) return false
  st.perLast[id] = st.t
  st.banner = { prio: 'info', msg: 'Noté, minuteur relancé', until: now + 1500 }
  return true
}
