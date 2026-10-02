import { sunTimes } from '../strategy/sun'

const MIN = 60000
/** Durée du fondu avant le coucher et avant le lever, en minutes. */
export const FADE_MIN = 15

/**
 * Degré de nuit entre 0 (jour) et 1 (nuit). Fondu de 15 min avant le coucher
 * (jour → nuit) et avant le lever (nuit → jour). Jour permanent aux latitudes polaires.
 */
export function nightAmount(now: Date, lat: number, lon: number): number {
  const events: { t: number; type: 'rise' | 'set' }[] = []
  for (const off of [-1, 0, 1]) {
    const d = new Date(now.valueOf() + off * 864e5)
    const { rise, set } = sunTimes(d, lat, lon)
    if (!rise || !set) return 0
    events.push({ t: rise.valueOf(), type: 'rise' }, { t: set.valueOf(), type: 'set' })
  }
  events.sort((a, b) => a.t - b.t)
  const t = now.valueOf()
  const next = events.find(e => e.t > t)
  const last = [...events].reverse().find(e => e.t <= t)
  if (!last || !next) return 0
  const toNext = (next.t - t) / MIN
  if (next.type === 'set' && toNext < FADE_MIN) return 1 - toNext / FADE_MIN
  if (next.type === 'rise' && toNext < FADE_MIN) return toNext / FADE_MIN
  return last.type === 'set' ? 1 : 0
}
