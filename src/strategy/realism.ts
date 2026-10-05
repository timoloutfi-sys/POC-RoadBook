/**
 * Repères physiologiques et pratiques pour des estimations réalistes.
 */

/**
 * Intensité tenable (puissance normalisée / FTP) selon la durée d'effort, pour un amateur entraîné :
 * 1 h ≈ 97 %, 2 h ≈ 89 %, 4 h ≈ 80 %, 8 h ≈ 72 %, 12 h ≈ 67 %, 24 h ≈ 59 %.
 * Cohérent avec les intensités observées en cyclosportive (0,75–0,85 sur 4–5 h), en Ironman
 * (0,68–0,78 sur 5–6 h) et en ultra (0,55–0,65 sur 24 h).
 */
export const ifForDuration = (h: number) => Math.min(0.97, Math.max(0.5, 0.97 - 0.12 * Math.log(Math.max(h, 1))))

/**
 * Puissance tenable (fraction de FTP) sur un effort de t secondes, modèle puissance critique :
 * P = CP + W'/t, avec CP ≈ FTP et W' ≈ 18 kJ (réserve anaérobie d'un amateur).
 * 3 min ≈ 1,25 × FTP, 10 min ≈ 1,12, 30 min ≈ 1,04.
 */
export function effortCap(t: number, ftp: number, wPrime = 18000) {
  return 1 + wPrime / Math.max(60, t) / ftp
}

/**
 * Marge au-dessus de l'intensité moyenne autorisée dans les montées, pour ne pas entamer la suite :
 * +30 points sur 2 h, +25 sur 4–8 h, +20 sur 8–16 h, +15 au-delà.
 */
export const climbMargin = (h: number) => (h < 3 ? 0.3 : h < 8 ? 0.25 : h < 16 ? 0.2 : 0.15)

/**
 * Baisse de capacité avec la fatigue (durabilité) : rien les 6 premières heures,
 * puis −0,5 % par heure, plafonnée à −12 %.
 */
export const durability = (hoursElapsed: number) => Math.max(0.88, 1 - 0.005 * Math.max(0, hoursElapsed - 6))

/**
 * Arrêts estimés (minutes) pour un temps de roulage donné : ravitaillements, pauses, nuit.
 * Jusqu'à 3 h aucun ; 3–8 h ≈ 4 min/h ; 8–16 h ≈ 6 min/h ; au-delà ≈ 12 min/h (ravitos, sommeil, pannes), + 45 min de repos par nuit.
 */
export function estimateStops(movingH: number, nights = 0) {
  const rate = movingH <= 3 ? 0 : movingH <= 8 ? 4 : movingH <= 16 ? 6 : 12
  return Math.round(movingH * rate + (movingH > 16 ? 45 * nights : 0))
}

/** Ralentissements de route ouverte (carrefours, villages, relances) : +2 % sur le temps de roulage. */
export const ROAD_FACTOR = 1.02

/** Besoin en eau (L/h) selon la température : 0,5 L/h à 15 °C, +0,05 par degré, entre 0,4 et 1,2. */
export const waterPerHour = (tempC: number) => Math.max(0.4, Math.min(1.2, 0.5 + 0.05 * (tempC - 15)))

/** Énergie : 1 kJ mécanique ≈ 1 kcal dépensée (rendement musculaire ≈ 24 %). */
export const kcalFromKj = (kj: number) => kj
