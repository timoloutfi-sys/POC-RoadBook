import { powerFor } from '../physics/physics'

export interface Rider {
  /** Roule avec un capteur de puissance. Faux : les cibles s'affichent en bpm. Absent = vrai. */
  hasPower?: boolean
  /** FTP en W. Facultative : sans elle, on l'estime depuis la vitesse habituelle sur le plat. */
  ftp: number | null
  /** Masse totale coureur + vélo, kg. */
  mass: number
  cda: number
  /** Résistance au roulement (route et pneus). Absent = 0,005. */
  crr?: number
  /** FC au seuil (bpm). Facultative : estimée à 90 % de la FC max. */
  lthr: number | null
  hrMax: number | null
  /** Vitesse moyenne habituelle sur 2 h de plat, km/h. Sert à estimer la FTP. */
  flatSpeed: number | null
}

export const defaultRider = (): Rider => ({ hasPower: true, ftp: 240, mass: 82, cda: 0.32, crr: 0.005, lthr: null, hrMax: null, flatSpeed: null })

/** Part de la FTP tenue en moyenne sur une sortie de 2 h. */
const ENDURANCE_RATIO = 0.7

/** FTP utilisée par les calculs : saisie, sinon estimée depuis la vitesse sur le plat, sinon 2,8 W/kg. */
export function effectiveFtp(r: Rider): number {
  if (r.ftp && r.ftp > 0) return r.ftp
  if (r.flatSpeed && r.flatSpeed > 0) return Math.round(powerFor(r, r.flatSpeed / 3.6, 0) / ENDURANCE_RATIO)
  return Math.round(2.8 * (r.mass - 9))
}

export const ftpIsEstimated = (r: Rider) => !(r.ftp && r.ftp > 0)

/** FC au seuil : saisie, sinon 90 % de la FC max, sinon inconnue. */
export function effectiveLthr(r: Rider): number | null {
  if (r.lthr && r.lthr > 0) return r.lthr
  if (r.hrMax && r.hrMax > 0) return Math.round(r.hrMax * 0.9)
  return null
}

/** Unité dans laquelle le coureur règle et lit ses cibles. */
export const effortUnit = (r: Rider) => (r.hasPower === false ? 'hr' : 'power') as 'power' | 'hr'
