import { gradeAt, type Route } from '../route/route'
import { hrDrift, hrRatioForPowerRatio, powerZoneOf } from './zones'
import type { BaseRules, Section } from './types'

export type EffortSource = 'power' | 'hr'

export interface Band { min: number; max: number }

export interface Target {
  /** Cible en watts. */
  power: Band
  /** Cible cardio en bpm, null si la FC seuil est inconnue. */
  hr: Band | null
  /** Zone de puissance (0 = Z1) au milieu de la cible. */
  zone: number
  label: string
  kind: 'zone' | 'montee' | 'plat' | 'descente'
  section: Section | null
}

/** Section qui fixe la cible au km donné : une cible imposée l'emporte, les repères sans cible sont ignorés. */
export const sectionAt = (sections: Section[], km: number) => {
  let z: Section | null = null
  for (const s of sections) {
    if (s.mark || km < s.a || km > s.b) continue
    if (!z || s.locked || !z.locked) z = s
  }
  return z
}

/** Bande cardio pour une bande en % FTP, élargie par la dérive au fil des heures. */
export function hrBand(minPct: number, maxPct: number, lthr: number, hours = 0): Band {
  const lo = Math.round(hrRatioForPowerRatio(minPct / 100) * lthr)
  const hi = Math.round(hrRatioForPowerRatio(maxPct / 100) * lthr)
  // Une bande cardio trop étroite n'est pas pilotable : 6 bpm minimum.
  const mid = (lo + hi) / 2, half = Math.max(3, (hi - lo) / 2)
  return { min: Math.round(mid - half), max: Math.round(mid + half + hrDrift(hours)) }
}

/** Cible au point d (m) : une section l'emporte sur les règles de base. */
export function targetAt(
  route: Route | null, sections: Section[], base: BaseRules,
  ftp: number, lthr: number | null, d: number, hours = 0,
): Target {
  const km = d / 1000
  const s = sectionAt(sections, km)
  let min: number, max: number, label: string, kind: Target['kind']
  if (s) { min = s.min; max = s.max; label = s.name; kind = s.kind }
  else {
    const g = route ? gradeAt(route, d) : 0
    kind = g >= base.gUp ? 'montee' : g <= base.gDown ? 'descente' : 'plat'
    ;[min, max] = base[kind]
    label = { plat: 'Plat', montee: 'Montée', descente: 'Descente' }[kind]
  }
  return {
    power: { min: Math.round((min * ftp) / 100), max: Math.round((max * ftp) / 100) },
    hr: lthr ? hrBand(min, max, lthr, hours) : null,
    zone: powerZoneOf((min + max) / 200),
    label, kind, section: s,
  }
}
