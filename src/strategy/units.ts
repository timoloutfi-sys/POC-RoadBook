import { hrRatioForPowerRatio, powerRatioForHrRatio, type Unit } from './zones'

export type { Unit }
export const unitLabel = (u: Unit) => (u === 'power' ? 'W' : 'bpm')

/** % de FTP → valeur dans l'unité de pilotage. Null en cardio tant que la FC seuil est inconnue. */
export function pctToValue(pct: number, unit: Unit, ftp: number, lthr: number | null): number | null {
  if (unit === 'power') return Math.round((pct * ftp) / 100)
  return lthr ? Math.round(hrRatioForPowerRatio(pct / 100) * lthr) : null
}

/** Valeur dans l'unité de pilotage → % de FTP (une décimale). Null si la conversion est impossible. */
export function valueToPct(v: number, unit: Unit, ftp: number, lthr: number | null): number | null {
  const pct = unit === 'power' ? (ftp > 0 ? (v / ftp) * 100 : null) : lthr ? powerRatioForHrRatio(v / lthr) * 100 : null
  return pct == null ? null : Math.round(pct * 10) / 10
}
