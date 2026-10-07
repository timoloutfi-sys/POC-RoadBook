import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../storage/defaults'
import { previewData } from './data'
import { pickScreen } from '../storage/screens'
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
  it('l’écran de la sortie : road book, sinon type de sortie, sinon écran de départ, sinon le premier', () => {
    const sc = ['a', 'b', 'c'].map(id => ({ id, name: id, items: [] }))
    expect(pickScreen(sc, { rbScreen: 'b', libre: false, activeScreen: 'a' })).toBe('b')
    expect(pickScreen(sc, { libre: false, activeScreen: 'c' })).toBe('c')
    expect(pickScreen(sc, { rbScreen: 'b', libre: true, libreScreen: 'c', activeScreen: 'a' })).toBe('c')
    expect(pickScreen(sc, { libre: true, activeScreen: 'a' })).toBe('a')
    expect(pickScreen(sc, { rbScreen: 'zzz', libre: false, activeScreen: 'zzz' })).toBe('a')
  })
})
