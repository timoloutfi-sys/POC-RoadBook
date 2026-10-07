/**
 * Couleurs d'état des widgets, en un seul endroit pour rester cohérent :
 * vert = bien, ambre = à surveiller, rouge = mauvais, bleu = sous la cible (effort seulement).
 * Une grandeur neutre (cadence, distance, pente…) n'a pas de couleur d'état.
 */
export type State = 'ok' | 'warn' | 'hi' | 'lo'

/** Réserve (Punch, endurance) en % : plus c'est haut, mieux c'est. */
export const reserveState = (pct: number): State => (pct >= 70 ? 'ok' : pct >= 40 ? 'warn' : 'hi')
export const reserveWord = (pct: number) => (pct >= 70 ? 'Bonne' : pct >= 40 ? 'Moyenne' : 'Faible')

/** Écart au plan en minutes (positif = en retard) : l'avance est une bonne nouvelle, le retard grandit en ambre puis rouge. */
export const gapState = (min: number): State => (min <= 1 ? 'ok' : min <= 5 ? 'warn' : 'hi')
export const gapWord = (min: number) => (Math.abs(min) < 2 ? 'Dans les temps' : min > 0 ? 'En retard' : 'En avance')

/** Dérive cardiaque en % : sous 3 faible, 3 à 5 moyenne, au-delà de 5 élevée. */
export const driftState = (pct: number): State => (pct >= 5 ? 'hi' : pct >= 3 ? 'warn' : 'ok')
export const driftWord = (pct: number) => (pct >= 5 ? 'Élevée' : pct >= 3 ? 'Moyenne' : 'Faible')

/** Écart de glucides en g (mangés − brûlés) : on tolère 30 g de retard, au-delà de 60 g c'est un vrai déficit. */
export const carbGapState = (g: number): State => (g >= -30 ? 'ok' : g >= -60 ? 'warn' : 'hi')

/** Part du temps passée dans la cible, en %. */
export const inTargetState = (pct: number): State => (pct >= 60 ? 'ok' : pct >= 35 ? 'warn' : 'hi')
