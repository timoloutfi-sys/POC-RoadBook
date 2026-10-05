import { HR_ZONES, POWER_ZONES } from '../strategy/zones'

/**
 * Calculs de réserves et de suivi, tous incrémentaux et à mémoire bornée (1 appel par seconde de roulage) :
 * pas de tableau qui grandit, faisables en virgule fixe sur le boîtier.
 */

/** Réglages du coureur utiles aux calculs. */
export interface MetricCfg {
  ftp: number
  lthr: number | null
  /** Masse (kg). */
  mass: number
  /** Réserve anaérobie W′ (J) ; CP = FTP. */
  wprime: number
}
export const defaultMetricCfg = (ftp: number, lthr: number | null, mass: number): MetricCfg => ({ ftp, lthr, mass, wprime: 18000 })

export interface LapStats { dur: number; dist: number; p: number | null; hr: number | null; cad: number | null; v: number }
interface LapAcc { dur: number; dist: number; pS: number; pN: number; hrS: number; hrN: number; cadS: number; cadN: number }
const newLap = (): LapAcc => ({ dur: 0, dist: 0, pS: 0, pN: 0, hrS: 0, hrN: 0, cadS: 0, cadN: 0 })

/** Taille du tampon de dérive : 120 groupes de 5 s = 10 min. */
const DRIFT_BINS = 120

export interface Metrics {
  /** Réserve anaérobie restante (J). */
  wbal: number
  /** Secondes par zone : Z1 à Z4, puis Z5 et au-dessus (en cardio : Z1 à Z5). */
  zones: number[]
  zoneNow: number
  /** Temps de roulage (s) à l'entrée dans la zone en cours. */
  zoneSince: number
  /** Secondes sous, dans et au-dessus de la cible. */
  under: number
  inT: number
  over: number
  /** Charge d'effort cumulée : Σ IF² · heures (sert à l'endurance). */
  workload: number
  /** Glucides brûlés estimés (g) et mangés (g). */
  carbBurned: number
  carbEaten: number
  /** Dérive : moyenne FC/puissance par groupes de 5 s (tampon circulaire), référence des minutes 10 à 30. */
  ring: Float32Array
  ringN: number
  ringI: number
  refSum: number
  refN: number
  binP: number; binHr: number; binN: number
  lap: LapAcc
  lastLap: LapStats | null
  laps: number
}

export const newMetrics = (cfg: MetricCfg): Metrics => ({
  wbal: cfg.wprime, zones: [0, 0, 0, 0, 0], zoneNow: -1, zoneSince: 0, under: 0, inT: 0, over: 0, workload: 0, carbBurned: 0, carbEaten: 0,
  ring: new Float32Array(DRIFT_BINS), ringN: 0, ringI: 0, refSum: 0, refN: 0, binP: 0, binHr: 0, binN: 0, lap: newLap(), lastLap: null, laps: 0,
})

export interface MetricIn {
  power: number | null
  hr: number | null
  cad: number | null
  /** m/s */
  speed: number
  /** Temps de roulage (s), après cette seconde. */
  t: number
  /** Bornes de la cible dans l'unité de la mesure qui la pilote, ou null. */
  band: { min: number; max: number } | null
  /** Valeur mesurée pour comparer à la cible. */
  val: number | null
  source: 'power' | 'hr'
}

/** Fraction de glucides dans l'énergie selon l'intensité (fraction de FTP), interpolée. */
const CARB_X = [0, 0.4, 0.6, 0.85, 1, 1.3], CARB_Y = [0.25, 0.25, 0.4, 0.65, 0.85, 1]
export function carbShare(ifr: number) {
  for (let i = 1; i < CARB_X.length; i++) if (ifr <= CARB_X[i]) return CARB_Y[i - 1] + ((ifr - CARB_X[i - 1]) / (CARB_X[i] - CARB_X[i - 1])) * (CARB_Y[i] - CARB_Y[i - 1])
  return 1
}
/** Intensité approchée (fraction de FTP) depuis la FC, sans capteur de puissance. */
export const ifFromHr = (hr: number, lthr: number) => Math.max(0, 1.4 * (hr / lthr) - 0.4)

/** Une seconde de roulage. */
export function stepMetrics(m: Metrics, c: MetricCfg, x: MetricIn) {
  const ifr = x.power != null ? x.power / c.ftp : x.hr != null && c.lthr ? ifFromHr(x.hr, c.lthr) : null

  // Punch : W′bal de Skiba, forme différentielle. Dépense au-dessus de CP, recharge exponentielle en dessous.
  if (x.power != null) {
    const cp = c.ftp
    if (x.power > cp) m.wbal = Math.max(0, m.wbal - (x.power - cp))
    else { const tau = 546 * Math.exp(-0.01 * (cp - x.power)) + 316; m.wbal = c.wprime - (c.wprime - m.wbal) * Math.exp(-1 / tau) }
  }

  // Zone en cours et temps par zone.
  let z = -1
  if (x.source === 'power' && x.power != null) { z = ifr! >= 1.05 ? 4 : POWER_ZONES.findIndex(q => ifr! < q.hi) }
  else if (x.hr != null && c.lthr) { const r = x.hr / c.lthr; z = HR_ZONES.findIndex(q => r < q.hi); if (z < 0) z = 4 }
  if (z >= 0) { m.zones[z]++; if (z !== m.zoneNow) { m.zoneNow = z; m.zoneSince = x.t } }

  // Dans la cible.
  if (x.band && x.val != null) { if (x.val < x.band.min) m.under++; else if (x.val > x.band.max) m.over++; else m.inT++ }

  // Charge d'effort (endurance) et glucides brûlés : énergie mécanique / rendement 24 %, part de glucides, 4,18 kJ/kcal, 4 kcal/g.
  if (ifr != null) {
    m.workload += (ifr * ifr) / 3600
    const kj = (ifr * c.ftp) / 1000
    m.carbBurned += (kj / 0.24) * carbShare(ifr) / 4.18 / 4
  }

  // Dérive : rapport FC / puissance par groupes de 5 s, en effort stable seulement.
  if (x.power != null && x.hr != null) { m.binP += x.power; m.binHr += x.hr; m.binN++ }
  if (x.t % 5 === 0) {
    if (m.binN >= 4) {
      const p = m.binP / m.binN, h = m.binHr / m.binN
      if (p >= 0.5 * c.ftp && h > 0) {
        const r = h / p
        m.ring[m.ringI] = r; m.ringI = (m.ringI + 1) % DRIFT_BINS; m.ringN = Math.min(DRIFT_BINS, m.ringN + 1)
        if (x.t >= 600 && x.t < 1800) { m.refSum += r; m.refN++ }
      }
    }
    m.binP = 0; m.binHr = 0; m.binN = 0
  }

  // Tour.
  const l = m.lap
  l.dur++; l.dist += x.speed
  if (x.power != null) { l.pS += x.power; l.pN++ }
  if (x.hr != null) { l.hrS += x.hr; l.hrN++ }
  if (x.cad != null) { l.cadS += x.cad; l.cadN++ }
}

/** Punch en % (0 à 100). */
export const punchPct = (m: Metrics, c: MetricCfg) => Math.round((m.wbal / c.wprime) * 100)

/** Endurance en % : 100 − part de la capacité perdue par le travail accumulé (estimation à calibrer sur les sorties). */
export const endurancePct = (m: Metrics) => Math.round(100 - (100 * m.workload) / (m.workload + 20))

/** Dérive cardiaque en % (positive = le cœur travaille plus pour la même puissance), ou null si pas assez de mesure. */
export function driftPct(m: Metrics): number | null {
  if (m.refN < 200 || m.ringN < 60) return null
  let s = 0
  for (let i = 0; i < m.ringN; i++) s += m.ring[i]
  const ref = m.refSum / m.refN
  return +(((s / m.ringN) / ref - 1) * 100).toFixed(1)
}

/** Temps dans la cible en % du temps où une cible existait, ou null. */
export function inTargetPct(m: Metrics) {
  const n = m.under + m.inT + m.over
  return n ? Math.round((m.inT / n) * 100) : null
}

/** Écart glucides (g) : mangés − brûlés ; négatif = en retard. */
export const carbGap = (m: Metrics) => Math.round(m.carbEaten - m.carbBurned)

/** Nouveau tour : renvoie les moyennes du tour qui se termine. */
export function newLapOf(m: Metrics): LapStats {
  const l = m.lap
  const s: LapStats = { dur: l.dur, dist: l.dist, p: l.pN ? l.pS / l.pN : null, hr: l.hrN ? l.hrS / l.hrN : null, cad: l.cadN ? l.cadS / l.cadN : null, v: l.dur ? (l.dist / l.dur) * 3.6 : 0 }
  m.lastLap = s; m.laps++; m.lap = newLap()
  return s
}
/** Moyennes du tour en cours. */
export function lapNow(m: Metrics): LapStats {
  const l = m.lap
  return { dur: l.dur, dist: l.dist, p: l.pN ? l.pS / l.pN : null, hr: l.hrN ? l.hrS / l.hrN : null, cad: l.cadN ? l.cadS / l.cadN : null, v: l.dur ? (l.dist / l.dur) * 3.6 : 0 }
}

/**
 * Autonomie du téléphone : pente de la batterie (niveau 0 à 1) sur les 30 dernières minutes, après 15 min de mesure.
 * `samples` : [temps en s, niveau]. Renvoie des minutes, ou null (en charge, pas assez de mesure, batterie stable).
 */
export function phoneMinutesLeft(samples: [number, number][], charging: boolean): number | null {
  if (charging || samples.length < 2) return null
  const last = samples[samples.length - 1], first = samples.find(s => last[0] - s[0] <= 1800) ?? samples[0]
  const span = last[0] - first[0]
  if (span < 900) return null
  const slope = (first[1] - last[1]) / span
  return slope > 0 ? Math.round(last[1] / slope / 60) : null
}

/** Ce que les widgets lisent des calculs : tout est déjà arrondi et prêt à afficher. */
export interface MetricsView {
  /** null sans capteur de puissance. */
  punch: number | null
  endurance: number | null
  /** Dérive en %, null tant que la mesure manque. */
  drift: number | null
  zones: number[]
  zoneNow: number
  zoneSince: number
  /** Temps dans la cible en %, et secondes sous, dans et au-dessus. */
  inTarget: number | null
  under: number; inT: number; over: number
  /** Glucides brûlés par heure (g), moyenne depuis le départ ; null avant 5 min. */
  carbPerH: number | null
  carbBurned: number; carbEaten: number; carbGap: number
  lap: LapStats
  lastLap: LapStats | null
  laps: number
}

export function metricsView(m: Metrics, c: MetricCfg, hasPower: boolean, t: number): MetricsView {
  return {
    punch: hasPower ? punchPct(m, c) : null, endurance: hasPower || c.lthr ? endurancePct(m) : null, drift: driftPct(m),
    zones: [...m.zones], zoneNow: m.zoneNow, zoneSince: m.zoneSince,
    inTarget: inTargetPct(m), under: m.under, inT: m.inT, over: m.over,
    carbPerH: t >= 300 ? Math.round((m.carbBurned / t) * 3600) : null,
    carbBurned: Math.round(m.carbBurned), carbEaten: Math.round(m.carbEaten), carbGap: carbGap(m),
    lap: lapNow(m), lastLap: m.lastLap, laps: m.laps,
  }
}
