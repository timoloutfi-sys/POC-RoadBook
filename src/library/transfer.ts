import { deserializeRoute, serializeRoute, type Route } from '../route/route'
import { emptyOverrides } from './roadbooks'
import type { RoadBook } from './types'

/** Fichier d'un road book, avec son tracé : à envoyer ou à garder en sauvegarde. */
export const exportRoadBook = (rb: RoadBook, route: Route | null): string =>
  JSON.stringify({ roadbook: 1, rb, route: route ? serializeRoute(route) : null })

export function parseRoadBookFile(text: string): { rb: RoadBook; route: Route | null } {
  const d = JSON.parse(text)
  if (d?.roadbook !== 1 || !d.rb) throw new Error('Fichier illisible : ce n’est pas un road book exporté.')
  const rb: RoadBook = { ...d.rb, overrides: { ...emptyOverrides(), ...d.rb.overrides } }
  return { rb, route: d.route ? deserializeRoute(d.route) : null }
}
