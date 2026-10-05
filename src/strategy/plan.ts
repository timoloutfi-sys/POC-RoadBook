import type { Periodic } from '../alerts/types'
import { clamp, hhmm, hrs, nf0, nf1, uid } from '../core/format'
import { simulateRide } from '../physics/kinematics'
import { CRR, airDensity, altitudePowerFactor, speedFor, type Body } from '../physics/physics'
import { cornerCaps, headwind } from '../route/geometry'
import { STEP, findClimbs, smoothGrades, type Route } from '../route/route'
import { X_MAX, X_MIN, optimalPacing, smooth } from './pacing'
import { ROAD_FACTOR, climbMargin, durability, effortCap, estimateStops, ifForDuration, waterPerHour } from './realism'
import { sunTimes } from './sun'
import type { BaseRules, RoutePoint, Section } from './types'
import { POWER_ZONES, powerZoneOf, type Unit } from './zones'

export type PlanMode = 'tranquille' | 'entrainement' | 'course' | 'manuel'
/** Zones sur lesquelles on place des blocs : Z3 (2), Z4 (3), Z5 (4). */
export type BlockZone = 2 | 3 | 4
export const BLOCK_ZONES: BlockZone[] = [2, 3, 4]

export interface PlanCfg {
  mode: PlanMode
  /** Course : temps de roulage visé en heures, sinon l'outil propose une intensité tenable. */
  targetHours: number | null
  /** Course : intensité visée (% de FTP, en puissance normalisée) ; null = tenable pour la durée. */
  intensity: number | null
  /** Manuel : cibles en % de FTP sur le plat, en montée et en descente. */
  manual: BaseRules
  /** Cibles imposées par le coureur (km à km) : l'algorithme les garde et adapte le reste. */
  imposed: Section[]
  /** Minutes demandées par zone ; absent = valeur par défaut du mode. */
  minutes: Partial<Record<BlockZone, number>>
  /** Départ, au format datetime-local. */
  start: string
  /** Arrêts au total en minutes ; null = automatique. */
  stops: number | null
  water: number
  /** g/h ; null = automatique. */
  carbs: number | null
  /** Vent annoncé (km/h, à 10 m) et direction d'où il vient (degrés, 0 = nord). */
  windKmh?: number
  windFrom?: number
  /** Température (°C) : densité de l'air et besoin en eau. */
  tempC?: number
}

export const defaultPlanCfg = (): PlanCfg => {
  const d = new Date(); d.setHours(8, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return { mode: 'manuel', targetHours: null, intensity: null, manual: { plat: [65, 72], montee: [75, 90], descente: [0, 60], gUp: 3.5, gDown: -3 }, imposed: [], minutes: {}, start: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T08:00`, stops: null, water: 1.5, carbs: null, windKmh: 0, windFrom: 270, tempC: 15 }
}

/** Blocs d'effort : allure moyenne, bande, durée d'un bloc, récupération minimale (s), pas des boutons, plafonds. */
export const BLOCK: Record<BlockZone, { mid: number; band: [number, number]; len: number; rec: number; name: string; step: number; maxf: number; cap: number }> = {
  2: { mid: 0.84, band: [0.8, 0.88], len: 1200, rec: 300, name: 'Tempo', step: 5, maxf: 0.6, cap: 600 },
  3: { mid: 0.985, band: [0.95, 1.02], len: 720, rec: 360, name: 'Seuil', step: 5, maxf: 0.35, cap: 120 },
  4: { mid: 1.13, band: [1.08, 1.18], len: 240, rec: 240, name: 'VO2max', step: 2, maxf: 0.15, cap: 40 },
}

export interface PlanInput {
  route: Route
  body: Body
  ftp: number
  unit: Unit
  cfg: PlanCfg
}

export interface ProgramRow { id?: string; locked?: boolean; label: string; a: number; b: number; t: number; minPct: number; maxPct: number; zone: number; note: string }

export interface PlanResult {
  /** Roulage en heures, durée avec arrêts, arrivée, vitesse moyenne (km/h). */
  H: number
  /** Fourchette du temps de roulage (h) : conditions favorables / défavorables. */
  range: [number, number]
  arriveRange: [Date, Date] | null
  /** Puissance moyenne et normalisée (W), énergie (kcal), glucides (g), eau (L). */
  pavgW: number
  npW: number
  kcal: number
  carbsTotal: number
  carbsPerHour: number
  waterTotal: number
  total: number
  stops: number
  /** Nombre de nuits traversées. */
  nights: number
  arrive: Date | null
  vavg: number
  np: number
  IF: number
  tss: number
  kj: number
  /** Secondes par zone de puissance (Z1 à Z7). */
  zt: number[]
  ratio: Float32Array
  /** Secondes de roulage écoulées à chaque échantillon (un tous les STEP mètres), sans arrêts. */
  cumT: Float64Array
  /** Minutes effectivement placées et minutes proposées par défaut, par zone de bloc. */
  placed: Record<BlockZone, number>
  defaults: Record<BlockZone, number>
  limits: Record<BlockZone, number>
  adjustable: BlockZone[]
  /** Intensité obtenue (NP / FTP) et intensité tenable proposée pour cette durée. */
  intensity: number
  intensityAuto: number
  sections: Section[]
  points: RoutePoint[]
  periodic: Periodic[]
  base: BaseRules
  program: ProgramRow[]
  why: string[]
  warnings: string[]
}

const roundTo = (v: number, s: number) => Math.round(v / s) * s

/** Plafond de minutes pour une zone sur une durée de H heures. */
export const blockLimit = (z: BlockZone, H: number) => Math.max(BLOCK[z].step * 2, Math.min(BLOCK[z].cap, Math.floor((H * 60 * BLOCK[z].maxf) / BLOCK[z].step) * BLOCK[z].step))

/** Minutes proposées par défaut selon le mode. */
export function defaultMinutes(mode: PlanMode, H: number): Record<BlockZone, number> {
  if (mode !== 'entrainement' || H < 0.75) return { 2: 0, 3: 0, 4: 0 }
  return { 2: 0, 3: clamp(roundTo(H * 60 * 0.12, 5), 10, 40), 4: 0 }
}

export function computePlan(inp: PlanInput): PlanResult {
  const { route, body, ftp: F, unit, cfg } = inp
  const n = route.n, L = route.total / 1000, gs = smoothGrades(route), mode = cfg.mode
  const temp = cfg.tempC ?? 15
  const rho = new Float32Array(n), alt = new Float32Array(n)
  for (let i = 0; i < n; i++) { rho[i] = airDensity(route.ele[i], temp); alt[i] = altitudePowerFactor(route.ele[i]) }
  const wind = headwind(route, cfg.windKmh ?? 0, cfg.windFrom ?? 270)
  const vcap = cornerCaps(route)
  const sv = (x: number, g: number, i: number) => speedFor(body, x * F * alt[i], g / 100, { rho: rho[i], wind: wind[i] })
  const adjustable = BLOCK_ZONES.filter(z => mode === 'entrainement' && !(unit === 'hr' && z === 4))

  // Temps réel : simulation avec inertie, virages, freinage, roue libre, air et vent locaux,
  // puissance réduite en altitude, et ralentissements de route ouverte.
  const timing = (ratio: Float32Array, b: Body = body, k = 1) => {
    const power = new Float32Array(n)
    for (let i = 0; i < n; i++) power[i] = ratio[i] * F * alt[i] * k
    const sim = simulateRide(b, { ds: STEP, grade: gs, power, rho, wind, vcap })
    const dt = new Float32Array(n), cumT = new Float64Array(n)
    let t = 0, kj = 0, p4 = 0
    for (let i = 1; i < n; i++) { const d = sim.dt[i] * ROAD_FACTOR, w = sim.pw[i]; dt[i] = d; t += d; kj += (w * d) / 1000; p4 += (w / F) ** 4 * d; cumT[i] = t }
    return { dt, cumT, t, kj, np: (p4 / t) ** 0.25 }
  }
  const climbs = findClimbs(route)

  // Plafonds d'allure en course : intensité moyenne + marge, et dans chaque montée la puissance tenable sur sa durée.
  const capsFor = (np: number, H: number) => {
    const glob = Math.min(X_MAX, np + climbMargin(H)), caps = new Float32Array(n).fill(glob)
    for (const c of climbs) {
      const dur = c.len / speedFor(body, glob * F, c.avg / 100)
      const cap = Math.min(glob, effortCap(dur, F))
      for (let i = c.i0; i <= c.i1; i++) caps[i] = cap
    }
    return caps
  }
  const opt = (target: { np: number } | { time: number }, caps: Float32Array) =>
    smooth(optimalPacing(gs, body, F, target, { rho, wind, cap: caps }).ratio, 6).map((x, i) => Math.min(caps[i], x))
  /** Allure de course : optimale, puis baisse progressive de la capacité après 6 h (durabilité). */
  const courseRatio = (np: number | null, H: number) => {
    const caps = capsFor(np ?? ifForDuration(H), H)
    let ratio: Float32Array
    if (np != null) {
      // Le modèle vise une puissance normalisée sans roue libre : la simulation (descentes, virages) en donne moins.
      // On recale la cible jusqu'à ce que la puissance normalisée simulée atteigne celle demandée.
      let q = np
      ratio = opt({ np: q }, caps)
      for (let k = 0; k < 4; k++) {
        const got = timing(ratio).np
        if (Math.abs(got - np) / np < 0.005) break
        q *= np / got
        ratio = opt({ np: q }, caps)
      }
    }
    else {
      const goal = (cfg.targetHours ?? 4) * 3600
      let tt = goal / ROAD_FACTOR
      ratio = opt({ time: tt }, caps)
      for (let k = 0; k < 3; k++) { const t = timing(ratio).t; if (Math.abs(t - goal) / goal < 0.005) break; tt *= goal / t; ratio = opt({ time: tt }, caps) }
    }
    if (H > 6) {
      const r0 = timing(ratio)
      for (let i = 0; i < n; i++) ratio[i] *= durability(r0.cumT[i] / 3600)
      const k = r0.np / timing(ratio).np
      for (let i = 0; i < n; i++) ratio[i] = Math.min(caps[i], Math.max(X_MIN, ratio[i] * k))
    }
    return ratio
  }
  let Hguess = cfg.targetHours ?? 4

  // --- 1. Allure de base ---------------------------------------------------------------------
  const baseRatio = (npTarget: number | null): Float32Array => {
    if (mode === 'manuel') {
      const m = cfg.manual, mid = (b: [number, number]) => (b[0] + b[1]) / 200, r = new Float32Array(n)
      for (let i = 0; i < n; i++) r[i] = gs[i] <= m.gDown ? mid(m.descente) : gs[i] >= m.gUp ? mid(m.montee) : mid(m.plat)
      return r
    }
    if (mode !== 'course') {
      const r = new Float32Array(n)
      for (let i = 0; i < n; i++) r[i] = gs[i] <= -3 ? 0.45 : gs[i] >= 3.5 ? 0.72 : 0.685
      return r
    }
    return courseRatio(npTarget, Hguess)
  }

  // --- 2. Blocs d'effort -----------------------------------------------------------------------
  interface Blk { id: number; z: BlockZone; i0: number; i1: number; dur: number; t0: number; avg: number }
  const build = (npTarget: number | null, wanted: Record<BlockZone, number>) => {
    const ratio = baseRatio(npTarget), tag = new Int16Array(n).fill(-1)
    let res = timing(ratio)
    const T0 = res.t
    // Départ progressif et retour au calme (sauf course : la 1re heure est déjà plafonnée plus bas).
    if (T0 > 2400 && (mode === 'tranquille' || mode === 'entrainement')) {
      for (let i = 0; i < n; i++) { if (res.cumT[i] < 900) { ratio[i] = 0.6; tag[i] = -2 } else if (res.cumT[i] > T0 - 600) { ratio[i] = 0.55; tag[i] = -3 } }
      res = timing(ratio)
    }
    if (mode === 'course' && T0 > 2 * 3600 && npTarget != null) {
      const cap = Math.max(npTarget, 0.5)
      for (let i = 0; i < n; i++) if (res.cumT[i] < 3600) ratio[i] = Math.min(ratio[i], cap)
      res = timing(ratio)
    }
    // Cibles imposées : le coureur a le dernier mot, ces tronçons ne bougent plus.
    if (cfg.imposed.length) {
      for (const s of cfg.imposed) {
        const i0 = clamp(Math.round((s.a * 1000) / STEP), 0, n - 1), i1 = clamp(Math.round((s.b * 1000) / STEP), 0, n - 1), x = (s.min + s.max) / 200
        for (let i = i0; i <= i1; i++) { ratio[i] = x; tag[i] = -5 }
      }
      res = timing(ratio)
    }
    const T = res.t
    const gp = new Float64Array(n + 1)
    for (let i = 0; i < n; i++) gp[i + 1] = gp[i] + gs[i]
    const want = ([4, 3, 2] as BlockZone[]).filter(z => adjustable.includes(z) && (wanted[z] ?? 0) > 0)
    const nbOf = (z: BlockZone) => Math.max(1, Math.ceil(((wanted[z] ?? 0) * 60) / BLOCK[z].len))
    const totalB = want.reduce((a, z) => a + nbOf(z), 0)
    const blocks: Blk[] = [], warnings: string[] = [], placed: Record<BlockZone, number> = { 2: 0, 3: 0, 4: 0 }
    for (const z of want) {
      const B = BLOCK[z], nb = nbOf(z), bd = ((wanted[z] ?? 0) * 60) / nb
      const P = new Float64Array(n + 1)
      for (let i = 0; i < n; i++) P[i + 1] = P[i] + STEP / sv(B.mid, gs[i], i)
      let k = 0
      for (; k < nb; k++) {
        const bad = new Int32Array(n + 1)
        for (let i = 0; i < n; i++) bad[i + 1] = bad[i] + (tag[i] !== -1 || gs[i] <= -2.5 ? 1 : 0)
        let best: { i: number; j: number; score: number; tt: number; avg: number } | null = null
        for (let i = 0; i < n; i += 4) {
          if (tag[i] !== -1 || gs[i] <= -2 || res.cumT[i] < (T > 2400 ? 1200 : 300)) continue
          const target = P[i] + bd
          if (P[n] < target) break
          let lo = i + 1, hi = n
          while (lo < hi) { const m = (lo + hi) >> 1; if (P[m] >= target) hi = m; else lo = m + 1 }
          const j = lo
          if (bad[j] - bad[i] > 0) continue
          const avg = (gp[j] - gp[i]) / (j - i), tc = res.cumT[i]
          let gap = Infinity
          for (const b of blocks) gap = Math.min(gap, Math.abs(tc - b.t0))
          // Les efforts vont en montée régulière (chaque watt y rapporte le plus), répartis sur le parcours.
          const score = (z >= 3 ? Math.min(Math.max(avg, 0), 8) * 0.5 : -Math.abs(avg) * 0.3) + Math.min(gap / (T / (totalB + 1)), 1) * 2
          if (!best || score > best.score) best = { i, j, score, tt: P[j] - P[i], avg }
        }
        if (!best) break
        const id = blocks.length
        for (let q = best.i; q < best.j; q++) { ratio[q] = B.mid; tag[q] = id }
        let tr = 0, q = best.j
        while (q < n && tr < B.rec && tag[q] === -1) { tag[q] = -4; tr += res.dt[q]; q++ }
        tr = 0; q = best.i - 1
        while (q >= 0 && tr < 120 && tag[q] === -1) { tag[q] = -4; tr += res.dt[q]; q-- }
        blocks.push({ id, z, i0: best.i, i1: best.j, dur: best.tt, t0: res.cumT[best.i], avg: best.avg })
        placed[z] += best.tt
      }
      if (k < nb) warnings.push(`Pas assez de terrain pour ${wanted[z]} min en Z${z + 1} : ${Math.round(placed[z] / 60)} min placées.`)
    }
    res = timing(ratio)
    return { ratio, tag, blocks, placed, warnings, res }
  }

  // --- 3. Niveau d'effort du mode « course » : intensité tenable, ou temps visé --------------------
  const noWanted: Record<BlockZone, number> = { 2: 0, 3: 0, 4: 0 }
  let H0 = 0, npTarget: number | null = null
  if (mode === 'course') {
    if (cfg.intensity) {
      const np = cfg.intensity / 100
      for (let k = 0; k < 3; k++) { const h = timing(courseRatio(np, Hguess)).t / 3600; const done = Math.abs(h - Hguess) < 0.03; Hguess = h; if (done) break }
      npTarget = np
    } else if (!cfg.targetHours) {
      // Point fixe : l'intensité tenable dépend de la durée, qui dépend de l'intensité.
      for (let k = 0; k < 5; k++) {
        const h = timing(courseRatio(ifForDuration(Hguess), Hguess)).t / 3600
        const done = Math.abs(h - Hguess) < 0.03
        Hguess = h
        if (done) break
      }
      npTarget = ifForDuration(Hguess)
    }
    H0 = Hguess
  }
  const first = build(npTarget, noWanted)
  const H1 = first.res.t / 3600
  const defaults = defaultMinutes(mode, mode === 'course' ? H0 : H1)
  const limits = { 2: blockLimit(2, H1), 3: blockLimit(3, H1), 4: blockLimit(4, H1) } as Record<BlockZone, number>
  const wanted = { 2: cfg.minutes[2] ?? defaults[2], 3: cfg.minutes[3] ?? defaults[3], 4: cfg.minutes[4] ?? defaults[4] } as Record<BlockZone, number>
  const warnings: string[] = []
  if (mode === 'course' && !cfg.intensity && cfg.targetHours && Math.abs(H1 - cfg.targetHours) / cfg.targetHours > 0.03) warnings.push(`Temps visé non tenable : ${hrs(H1)} au ${H1 > cfg.targetHours ? 'mieux' : 'plus lent'}.`)
  for (const z of adjustable) if (wanted[z] > limits[z]) { warnings.push(`${wanted[z]} min en Z${z + 1} sur ${hrs(H1)}, c'est plus que ce qui se tient : ${limits[z]} min au plus.`); wanted[z] = limits[z] }

  // En course, les blocs ajoutés consomment le budget de fatigue : on ménage le reste pour garder la même intensité.
  let out = build(npTarget, wanted)
  if (mode === 'course' && npTarget != null && cfg.imposed.length) {
    let np = npTarget
    for (let k = 0; k < 4 && Math.abs(out.res.np - npTarget) > npTarget * 0.01; k++) { np = clamp(np * (npTarget / out.res.np), 0.45, 1.1); out = build(np, wanted) }
  }
  const { ratio, tag, blocks, placed, res } = out
  warnings.push(...out.warnings)

  // --- 4. Résultats -----------------------------------------------------------------------------
  const H = res.t / 3600, IF = res.np, tss = H * IF * IF * 100
  const zt = new Array(7).fill(0)
  for (let i = 1; i < n; i++) zt[powerZoneOf(ratio[i])] += res.dt[i]
  let stops = cfg.stops ?? estimateStops(H, 0)
  const carbs = cfg.carbs ?? (H < 1.25 ? 0 : mode === 'course' ? (H > 2.5 ? 90 : 70) : blocks.length ? 75 : 60)
  const start = new Date(cfg.start), okStart = !isNaN(start.valueOf())
  let stopsS = stops * 60
  const pc = (x: number) => Math.round(x * 100), W = (x: number) => Math.round(x * F)
  const eta = (i: number) => new Date(start.valueOf() + res.cumT[i] * (1 + stopsS / res.t) * 1000)
  const kmAtT = (tt: number) => { let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (res.cumT[m] < tt) lo = m + 1; else hi = m } return (lo * STEP) / 1000 }
  const kmAtDate = (dt: Date) => kmAtT((dt.valueOf() - start.valueOf()) / 1000 / (1 + stopsS / res.t))
  const Wdisp = (x: number) => `${W(x)} W`

  const avgRatio = (cond: (g: number) => boolean) => { let a = 0, c = 0; for (let i = 0; i < n; i++) if (cond(gs[i])) { a += ratio[i]; c++ } return c > 20 ? a / c : null }
  const sections: Section[] = [], program: ProgramRow[] = [], why: string[] = []
  const mk = (label: string, i0: number, i1: number, band: [number, number], note: string, over: Partial<Section> = {}) => {
    const a = (i0 * STEP) / 1000, b = (i1 * STEP) / 1000
    let t = 0
    for (let i = i0 + 1; i <= i1; i++) t += res.dt[i]
    sections.push({ id: uid(), gen: true, kind: 'zone', name: label, a: +a.toFixed(1), b: +b.toFixed(1), min: pc(band[0]), max: pc(band[1]), msg: '', avant: 0, ...over })
    program.push({ id: over.id, locked: over.locked, label, a, b, t, minPct: pc(band[0]), maxPct: pc(band[1]), zone: powerZoneOf((band[0] + band[1]) / 2), note })
  }
  // Départ progressif et retour au calme.
  const runs = (id: number) => { const r: [number, number][] = []; let s = -1; for (let i = 0; i < n; i++) { if (tag[i] === id && s < 0) s = i; if ((tag[i] !== id || i === n - 1) && s >= 0) { r.push([s, i]); s = -1 } } return r }
  for (const [i0, i1] of runs(-2)) mk('Échauffement', i0, i1, [0.5, 0.68], 'monte progressivement')
  const cnt: Record<number, number> = {}, tot: Record<number, number> = {}
  blocks.forEach(b => (tot[b.z] = (tot[b.z] ?? 0) + 1))
  for (const b of blocks) {
    cnt[b.z] = (cnt[b.z] ?? 0) + 1
    mk(`${BLOCK[b.z].name} ${cnt[b.z]}/${tot[b.z]}`, b.i0, b.i1, BLOCK[b.z].band, b.avg >= 2 ? `en montée, ${nf1(b.avg)} % de moyenne` : 'sur le plat', { msg: `${Math.round(b.dur / 60)} min`, avant: 0.5 })
  }
  for (const [i0, i1] of runs(-3)) mk('Retour au calme', i0, i1, [0.45, 0.62], '')

  let base: BaseRules = mode === 'manuel' ? cfg.manual : { plat: [65, 72], montee: [65, 75], descente: [0, 60], gUp: 3.5, gDown: -3 }
  if (mode === 'course') {
    // Montées : une section chacune, à l'allure moyenne optimisée ; ailleurs, on regroupe les échantillons
    // voisins de même effort, au moins 2 min chacun.
    const inClimb = new Uint8Array(n)
    let ups = 0
    for (const c of climbs) {
      if (cfg.imposed.some(x => x.a < c.b && x.b > c.a)) { for (let i = c.i0; i <= c.i1; i++) inClimb[i] = 1; continue }
      let sum = 0, cn = 0
      for (let i = c.i0; i <= c.i1; i++) { inClimb[i] = 1; if (tag[i] < 0) { sum += ratio[i]; cn++ } }
      const mean = cn ? sum / cn : ratio[c.i0]
      mk(`Montée ${++ups} (${nf1(c.len / 1000)} km à ${nf1(c.avg)} %)`, c.i0, c.i1, [mean - 0.04, mean + 0.03], `${nf1(c.avg)} % de moyenne`, { kind: 'montee', avant: 1, msg: carbs > 0 ? 'Mange maintenant, avant la montée' : '' })
    }
    // Hors montées et blocs : descentes d'un côté, « roulant » de l'autre.
    interface Run { i0: number; i1: number; sum: number; t: number; down: boolean }
    const rs: Run[] = []
    let cur: Run | null = null
    for (let i = 1; i < n; i++) {
      if (tag[i] >= 0 || tag[i] === -5 || inClimb[i]) { cur = null; continue }
      const down = gs[i] <= -3
      if (!cur || cur.down !== down) { cur = { i0: i - 1, i1: i, sum: ratio[i], t: res.dt[i], down }; rs.push(cur) }
      else { cur.i1 = i; cur.sum += ratio[i]; cur.t += res.dt[i] }
    }
    for (let pass = 0; pass < 2; pass++)
      for (let k = rs.length - 1; k >= 0; k--) {
        if (rs[k].t >= 120) continue
        const nb = k > 0 && rs[k - 1].i1 >= rs[k].i0 - 1 ? rs[k - 1] : k < rs.length - 1 && rs[k + 1].i0 <= rs[k].i1 + 1 ? rs[k + 1] : null
        if (!nb) continue
        nb.i0 = Math.min(nb.i0, rs[k].i0); nb.i1 = Math.max(nb.i1, rs[k].i1); nb.sum += rs[k].sum; nb.t += rs[k].t
        rs.splice(k, 1)
      }
    for (const r of rs) {
      const mean = r.sum / (r.i1 - r.i0 + 1)
      mk(r.down ? 'Descente' : 'Roulant', r.i0, r.i1, r.down ? [0, Math.min(0.62, mean + 0.05)] : [mean - 0.05, mean + 0.04], '')
    }
    const flat = avgRatio(g => Math.abs(g) < 1.5) ?? IF
    base = { plat: [pc(flat - 0.03), pc(flat + 0.03)], montee: [70, 90], descente: [0, 60], gUp: 3.5, gDown: -3 }
  } else if (climbs.length) {
    climbs.forEach((c, k) => { if (!sections.some(s => s.a < c.b && s.b > c.a)) sections.push({ id: uid(), gen: true, kind: 'montee', name: `Montée ${k + 1} (${nf1(c.len / 1000)} km à ${nf1(c.avg)} %)`, a: +c.a.toFixed(1), b: +c.b.toFixed(1), min: base.montee[0], max: base.montee[1], msg: carbs > 0 ? 'Mange maintenant, avant la montée' : '', avant: 1 }) })
  }
  // Cibles imposées : ajoutées telles quelles, prioritaires sur tout ce qui est généré.
  for (const imp of cfg.imposed) {
    const a = Math.round((imp.a * 1000) / STEP), b = Math.round((imp.b * 1000) / STEP)
    mk(imp.name || 'Cible imposée', a, b, [imp.min / 100, imp.max / 100], 'imposée', { id: imp.id, kind: imp.kind, msg: imp.msg, avant: imp.avant, locked: true })
    sections[sections.length - 1].a = imp.a; sections[sections.length - 1].b = imp.b
  }
  sections.sort((x, y) => x.a - y.a)
  program.sort((x, y) => x.a - y.a)

  // --- 5. Explications -----------------------------------------------------------------------------
  const dm = (route.dplus / L)
  why.push(`${nf1(L)} km, ${nf0(route.dplus)} m de D+ (${nf1(dm)} m/km) : ${dm < 6 ? 'roulant' : dm < 12 ? 'vallonné' : dm < 20 ? 'accidenté' : 'montagneux'}, ${climbs.length ? `${climbs.length} montée${climbs.length > 1 ? 's' : ''}` : 'sans vraie montée'}.`)
  if (mode === 'tranquille') why.push(`Endurance : ${Wdisp(0.65)}–${Wdisp(0.72)} sur le plat, jusqu'à ${Wdisp(0.75)} en montée, descentes en roue libre.`)
  if (mode === 'entrainement') why.push(`Base en endurance (${Wdisp(0.65)}–${Wdisp(0.72)}), efforts placés sur les montées régulières.`)
  if (mode === 'manuel') why.push('Tes cibles, sans calcul de stratégie : le temps et l\'arrivée sont estimés avec le modèle physique.')
  if (mode === 'course') {
    why.push(`Intensité tenable sur ${hrs(H)} : ${pc(IF)} % de ta FTP en puissance normalisée (${Wdisp(IF)}).`)
    const up = avgRatio(g => g > 4), down = avgRatio(g => g < -3)
    if (up != null) why.push(`Là où chaque watt fait gagner le plus de temps : ${Wdisp(up)} en montée${down != null ? `, ${Wdisp(down)} en descente rapide` : ''}.`)
    if (H0 > 2) why.push('Première heure plafonnée à ton intensité moyenne.')
  }
  for (const z of BLOCK_ZONES) {
    const bs = blocks.filter(b => b.z === z)
    if (bs.length) why.push(`${bs.length} bloc${bs.length > 1 ? 's' : ''} ${BLOCK[z].name} de ${Math.round(bs[0].dur / 60)} min à ${Wdisp(BLOCK[z].band[0])}–${Wdisp(BLOCK[z].band[1])}, ${Math.round(BLOCK[z].rec / 60)} min de récupération après chaque.`)
  }
  why.push(`Charge : ${Math.round(tss)} TSS, puissance normalisée ${W(IF)} W.`)

  // --- 6. Nuit, eau, nutrition ------------------------------------------------------------------------
  const points: RoutePoint[] = [], nights: { set: Date; rise: Date; ka: number; kb: number; startsDark: boolean; endsDark: boolean }[] = []
  if (okStart && H > 3) {
    const end = eta(n - 1), lat = route.lat[0], lon = route.lon[0]
    for (let d = new Date(start.valueOf() - 864e5); d <= end; d = new Date(d.valueOf() + 864e5)) {
      const d1 = new Date(d); d1.setHours(12, 0, 0, 0)
      const d2 = new Date(d1.valueOf() + 864e5), ns = sunTimes(d1, lat, lon).set, ne = sunTimes(d2, lat, lon).rise
      if (!ns || !ne) continue
      const a = Math.max(ns.valueOf(), start.valueOf()), b = Math.min(ne.valueOf(), end.valueOf())
      if (b - a < 20 * 60000) continue
      nights.push({ set: ns, rise: ne, ka: kmAtDate(new Date(a)), kb: kmAtDate(new Date(b)), startsDark: ns < start, endsDark: ne > end })
    }
    nights.forEach((nt, k) => {
      if (mode === 'course') sections.push({ id: uid(), gen: true, kind: 'zone', name: nights.length > 1 ? `Nuit ${k + 1}` : 'Nuit', a: +nt.ka.toFixed(1), b: +nt.kb.toFixed(1), min: pc(IF - 0.07), max: pc(IF - 0.01), msg: 'Baisse d\'un cran, reste lucide', avant: 0 })
      if (!nt.startsDark) {
        points.push({ id: uid(), gen: true, type: 'note', km: +kmAtDate(new Date(nt.set.valueOf() - 30 * 60000)).toFixed(1), text: `Tenue de nuit et éclairage (coucher vers ${hhmm(nt.set)})`, avant: 1 })
        if (H > 10) { const kc = kmAtDate(new Date(nt.set.valueOf() + 2 * 3600000)); if (kc < nt.kb) points.push({ id: uid(), gen: true, type: 'note', km: +kc.toFixed(1), text: 'Caféine prévue', avant: 0.5 }) }
      }
      if (!nt.endsDark) points.push({ id: uid(), gen: true, type: 'note', km: +nt.kb.toFixed(1), text: `Lever du soleil vers ${hhmm(nt.rise)}`, avant: 0.5 })
    })
    if (cfg.stops == null && nights.length) { stops = estimateStops(H, nights.length); stopsS = stops * 60 }
    if (nights.length) why.push(`${nights.length > 1 ? `${nights.length} nuits` : 'Une nuit'} : éclairage rappelé 30 min avant le coucher du soleil${mode === 'course' ? ', cible baissée d\'un cran' : ''}.`)
    sections.sort((x, y) => x.a - y.a)
  }
  const wph = waterPerHour(temp)
  if (cfg.water > 0 && H > 1) {
    const auto = cfg.water / wph, stepKm = auto * (L / H) * 0.85
    let c = 0
    if (stepKm > 5) for (let k = stepKm; k < L - 10; k += stepKm) { c++; points.push({ id: uid(), gen: true, type: 'eau', km: +k.toFixed(1), text: `Recharger l'eau avant ici (autonomie ≈ ${nf1(auto)} h) : repère un point`, avant: 2 }) }
    why.push(c ? `${c} recharge${c > 1 ? 's' : ''} d'eau à prévoir (${nf1(cfg.water)} L, autonomie ${nf1(auto)} h).` : `Pas de recharge d'eau nécessaire avec ${nf1(cfg.water)} L.`)
  }
  const periodic: Periodic[] = []
  if (carbs > 0) { periodic.push({ id: uid(), auto: true, on: true, every: 20, msg: `Mange ~${Math.round(carbs / 3)} g de glucides`, prio: 'action', grams: Math.round(carbs / 3) }); why.push(`${carbs} g de glucides par heure, soit ${nf0(carbs * H)} g au total.`) }
  if (H > 1) periodic.push({ id: uid(), auto: true, on: true, every: 15, msg: 'Bois ~150 ml', prio: 'info' })

  // Fourchette : position et route plus ou moins favorables, forme du jour ±.
  const bLo: Body = { ...body, cda: body.cda - 0.015, crr: (body.crr ?? CRR) - 0.0007 }, bHi: Body = { ...body, cda: body.cda + 0.02, crr: (body.crr ?? CRR) + 0.0012 }
  // L'incertitude grandit avec la durée : ±5 % jusqu'à 4 h, ±8 % à 12 h, ±10 % au-delà.
  const spread = H <= 4 ? 0.05 : H >= 24 ? 0.1 : H <= 12 ? 0.05 + ((H - 4) / 8) * 0.03 : 0.08 + ((H - 12) / 12) * 0.02
  const phys: [number, number] = [timing(ratio, bLo, 1.02).t / 3600, timing(ratio, bHi, 0.96).t / 3600]
  const range: [number, number] = [Math.min(phys[0], H * (1 - spread)), Math.max(phys[1], H * (1 + spread))]
  const arriveAt = (h: number) => new Date(start.valueOf() + (h * 3600 + stopsS) * 1000)
  const maxAlt = Math.max(...route.ele)
  if (maxAlt > 1000) why.push(`Au-dessus de 1000 m ta puissance baisse (−${Math.round((1 - altitudePowerFactor(maxAlt)) * 100)} % au point haut, ${nf0(maxAlt)} m) : cibles ajustées.`)
  if (cfg.windKmh) why.push(`Vent de ${cfg.windKmh} km/h pris en compte tronçon par tronçon, selon la direction de la route.`)
  if (stops) why.push(`Arrêts estimés : ${hrs(stops / 60)} (ravitaillements, pauses${nights.length && H > 16 ? ', repos de nuit' : ''}).`)

  return {
    H, total: H + stops / 60, stops, nights: nights.length, arrive: okStart ? eta(n - 1) : null, vavg: L / H, np: res.np, IF, tss, kj: res.kj, zt, ratio, cumT: res.cumT,
    range, arriveRange: okStart ? [arriveAt(range[0]), arriveAt(range[1])] : null,
    pavgW: (res.kj * 1000) / res.t, npW: res.np * F, kcal: res.kj, carbsTotal: Math.round(carbs * H), carbsPerHour: carbs, waterTotal: Math.round(wph * H * 10) / 10,
    placed: { 2: Math.round(placed[2] / 60), 3: Math.round(placed[3] / 60), 4: Math.round(placed[4] / 60) },
    defaults, limits, adjustable, intensity: IF, intensityAuto: ifForDuration(H), sections, points, periodic, base, program, why, warnings,
  }
}

export const zoneLabel = (z: number) => `Z${z + 1}`
export const zoneColor = (z: number) => POWER_ZONES[z].c
