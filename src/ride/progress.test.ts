import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../storage/defaults'
import { previewData } from './data'
import { rebase } from './progress'
import { tileOf } from '../ui/tiles'

describe('heures du plan recalées sur le départ réel', () => {
  it('décale une heure prévue de l’écart entre départ prévu et départ réel', () => {
    const planned = new Date(2026, 9, 10, 6, 0), at = new Date(2026, 9, 10, 8, 30), real = new Date(2026, 9, 10, 6, 20).valueOf()
    expect(rebase(at, planned, real)).toEqual(new Date(2026, 9, 10, 8, 50))
    expect(rebase(at, planned, null)).toBe(at)
    expect(rebase(null, planned, real)).toBeNull()
  })
  it('l’arrivée affiche l’estimée puis la prévue (départ réel + durée prévue)', () => {
    const t = tileOf('arrival', previewData())
    expect(t.sub!.some(x => x.startsWith('prévu 19:00'))).toBe(true)
  })
  it('la sortie libre n’a aucun widget qui exige un plan', () => {
    expect(TEMPLATES.libre.items.some(i => (i[0] as string) === 'intarget')).toBe(false)
  })
})
