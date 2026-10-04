import { describe, expect, it } from 'vitest'
import { countdown, goalOf, nextOutingOf, rideTarget } from './goal'
import type { RoadBookMeta } from './types'

const now = new Date('2026-10-04T10:00:00')
const m = (id: string, over: Partial<RoadBookMeta> = {}): RoadBookMeta => ({ id, name: id, km: 100, dplus: 500, estH: 4, updated: 0, prof: [], kind: 'sortie', hasRoute: true, ...over })

describe('objectif et prochaine sortie', () => {
  it('compte à rebours : J-n, demain, aujourd’hui, passé', () => {
    expect(countdown('2027-04-10T06:00', now)).toBe('J-188')
    expect(countdown('2026-10-05T08:00', now)).toBe('Demain')
    expect(countdown('2026-10-04T06:00', now)).toBe("Aujourd'hui") // même jour, heure passée
    expect(countdown('2026-10-03T23:00', now)).toBeNull()
    expect(countdown('pas une date', now)).toBeNull()
  })
  it('l’objectif est une course datée dans le futur, choisie comme objectif', () => {
    const list = [m('a', { kind: 'course', when: '2027-04-10T06:00' }), m('b', { kind: 'course', when: '2026-09-01T06:00' }), m('c', { when: '2027-05-01T06:00' }), m('d', { kind: 'course' })]
    expect(goalOf(list, 'a', now)!.id).toBe('a')
    expect(goalOf(list, 'b', now)).toBeNull() // date passée
    expect(goalOf(list, 'c', now)).toBeNull() // pas une course
    expect(goalOf(list, 'd', now)).toBeNull() // pas de date
    expect(goalOf(list, null, now)).toBeNull()
    expect(goalOf(list, 'zz', now)).toBeNull()
  })
  it('la prochaine sortie : la plus proche dans les 7 jours', () => {
    const list = [m('far', { when: '2026-10-20T08:00' }), m('late', { when: '2026-10-10T08:00' }), m('soon', { when: '2026-10-05T08:00' }), m('none')]
    expect(nextOutingOf(list, now)!.id).toBe('soon')
    expect(nextOutingOf([m('far', { when: '2026-10-20T08:00' })], now)).toBeNull()
    expect(nextOutingOf([m('past', { when: '2026-10-01T08:00' })], now)).toBeNull()
  })
  it('le bouton Rouler : la sortie du jour, sinon le road book actif, sinon rien', () => {
    const list = [m('today', { when: '2026-10-04T14:00' }), m('active'), m('nogpx', { when: '2026-10-04T15:00', hasRoute: false })]
    expect(rideTarget(list, 'active', now)!.id).toBe('today')
    expect(rideTarget([m('tomorrow', { when: '2026-10-05T08:00' }), m('active')], 'active', now)!.id).toBe('active')
    expect(rideTarget([m('nogpx', { when: '2026-10-04T15:00', hasRoute: false }), m('active')], 'active', now)!.id).toBe('active')
    expect(rideTarget([m('x')], null, now)).toBeNull()
  })
})
