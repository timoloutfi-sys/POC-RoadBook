import type { RoadBookMeta } from './types'

const DAY = 86400e3
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Jours entre aujourd'hui et la date de départ (0 = aujourd'hui, 1 = demain). */
export function daysUntil(when: string, now: Date): number {
  return Math.round((startOfDay(new Date(when)).valueOf() - startOfDay(now).valueOf()) / DAY)
}

/** « J-189 », « Demain », « Aujourd'hui » ; null si la date est passée ou illisible. */
export function countdown(when: string, now: Date): string | null {
  const d = new Date(when)
  if (isNaN(d.valueOf())) return null
  const n = daysUntil(when, now)
  return n < 0 ? null : n === 0 ? "Aujourd'hui" : n === 1 ? 'Demain' : `J-${n}`
}

/** L'objectif : le road book choisi, s'il est de type course et daté dans le futur (ou aujourd'hui). */
export function goalOf(list: RoadBookMeta[], goalId: string | null, now: Date): RoadBookMeta | null {
  const g = goalId ? list.find(m => m.id === goalId) : undefined
  return g && g.kind === 'course' && g.when && daysUntil(g.when, now) >= 0 ? g : null
}

/** La prochaine sortie : le road book daté le plus proche, d'aujourd'hui à dans 7 jours. */
export function nextOutingOf(list: RoadBookMeta[], now: Date): RoadBookMeta | null {
  const dated = list
    .filter(m => m.when && !isNaN(new Date(m.when).valueOf()) && daysUntil(m.when, now) >= 0 && daysUntil(m.when, now) <= 7)
    .sort((a, b) => new Date(a.when!).valueOf() - new Date(b.when!).valueOf())
  return dated[0] ?? null
}

/** Ce que propose le bouton Rouler : la sortie du jour, sinon le road book actif, sinon la sortie libre. */
export function rideTarget(list: RoadBookMeta[], activeId: string | null, now: Date): RoadBookMeta | null {
  const today = nextOutingOf(list, now)
  if (today?.when && daysUntil(today.when, now) === 0 && today.hasRoute) return today
  return list.find(m => m.id === activeId) ?? null
}
