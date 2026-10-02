export interface ZoneDef { n: string; l: string; lo: number; hi: number; c: string }

/** 7 zones de puissance (Coggan), en fraction de FTP. */
export const POWER_ZONES: ZoneDef[] = [
  { n: 'Z1', l: 'Récupération', lo: 0, hi: 0.55, c: '#9AA5B1' },
  { n: 'Z2', l: 'Endurance', lo: 0.55, hi: 0.75, c: '#3B82F6' },
  { n: 'Z3', l: 'Tempo', lo: 0.75, hi: 0.9, c: '#22A55B' },
  { n: 'Z4', l: 'Seuil', lo: 0.9, hi: 1.05, c: '#E0B000' },
  { n: 'Z5', l: 'VO2max', lo: 1.05, hi: 1.2, c: '#F97316' },
  { n: 'Z6', l: 'Anaérobie', lo: 1.2, hi: 1.5, c: '#E11D48' },
  { n: 'Z7', l: 'Neuromusculaire', lo: 1.5, hi: 9, c: '#7C3AED' },
]

/** 5 zones cardio (Coggan), en fraction de la FC au seuil. */
export const HR_ZONES: ZoneDef[] = [
  { n: 'Z1', l: 'Récupération', lo: 0, hi: 0.68, c: '#9AA5B1' },
  { n: 'Z2', l: 'Endurance', lo: 0.68, hi: 0.83, c: '#3B82F6' },
  { n: 'Z3', l: 'Tempo', lo: 0.83, hi: 0.94, c: '#22A55B' },
  { n: 'Z4', l: 'Seuil', lo: 0.94, hi: 1.05, c: '#E0B000' },
  { n: 'Z5', l: 'VO2max', lo: 1.05, hi: 1.15, c: '#F97316' },
]

export const powerZoneOf = (ratio: number) => {
  for (let k = 0; k < 6; k++) if (ratio < POWER_ZONES[k].hi) return k
  return 6
}
/** Zone cardio équivalente à une zone de puissance (Z5 et plus → Z5). */
export const hrZoneOfPowerZone = (z: number) => Math.min(z, 4)

// Correspondance par morceaux entre fraction de FTP et fraction de FC seuil,
// alignée sur les bornes des zones (Z1/Z2 0,55↔0,68, Z2/Z3 0,75↔0,83…).
const PW = [0, 0.55, 0.75, 0.9, 1.05, 1.2, 1.5]
const HR = [0.5, 0.68, 0.83, 0.94, 1.05, 1.1, 1.15]

/** Fraction de FC seuil attendue en régime stable pour une fraction de FTP. */
export function hrRatioForPowerRatio(p: number) {
  if (p <= PW[0]) return HR[0]
  for (let i = 1; i < PW.length; i++) {
    if (p <= PW[i]) {
      const f = (p - PW[i - 1]) / (PW[i] - PW[i - 1])
      return HR[i - 1] + f * (HR[i] - HR[i - 1])
    }
  }
  return HR[HR.length - 1]
}

/**
 * Dérive cardiaque : à effort égal la FC monte au fil des heures.
 * On élargit la borne haute de 3 bpm par heure, plafonné à 10 bpm.
 */
export const hrDrift = (hours: number) => Math.min(10, Math.max(0, hours) * 3)

/** Fraction de FTP attendue en régime stable pour une fraction de FC seuil (inverse de `hrRatioForPowerRatio`). */
export function powerRatioForHrRatio(h: number) {
  if (h <= HR[0]) return PW[0]
  for (let i = 1; i < HR.length; i++) {
    if (h <= HR[i]) {
      const f = (h - HR[i - 1]) / (HR[i] - HR[i - 1])
      return PW[i - 1] + f * (PW[i] - PW[i - 1])
    }
  }
  return PW[PW.length - 1]
}

export type Unit = 'power' | 'hr'

/** Bande d'une zone en % de FTP, quelle que soit l'unité dans laquelle on pilote (bornes extrêmes recadrées). */
export function zoneBandPct(zone: number, unit: Unit): [number, number] {
  if (unit === 'power') {
    const z = POWER_ZONES[zone]
    return [Math.max(40, Math.round(z.lo * 100)), Math.min(180, Math.round(z.hi * 100))]
  }
  const z = HR_ZONES[zone]
  const lo = z.lo === 0 ? 45 : Math.round(powerRatioForHrRatio(z.lo) * 100)
  const hi = Math.min(zone === 4 ? 120 : 999, Math.round(powerRatioForHrRatio(z.hi) * 100))
  return [lo, hi]
}
