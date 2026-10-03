import { describe, expect, it } from 'vitest'
import { buildRoute, demoPoints } from '../route/route'
import { useStore } from '../storage/store'
import { rideState } from './scope'

describe('sortie libre', () => {
  it('masque parcours, repères et plan, sans toucher à l’espace de travail', () => {
    const route = buildRoute('t', demoPoints().slice(0, 300))
    useStore.setState({ route, points: [{ id: 'p', type: 'eau', km: 1, text: '', avant: 1 }], libre: true })
    const s = rideState()
    expect(s.route).toBeNull(); expect(s.points).toEqual([]); expect(s.sections).toEqual([])
    expect(useStore.getState().route).toBe(route)
    useStore.setState({ libre: false })
    expect(rideState().route).toBe(route)
  })
})

describe('réglages du road book en sortie', () => {
  it('applique les écarts aux alertes et rappels, sans modifier les défauts', async () => {
    const { useLibrary } = await import('../library/session')
    const { newRoadBook, setOverride } = await import('../library/roadbooks')
    const al = useStore.getState().alerts, pe = useStore.getState().periodic
    const rb = newRoadBook('x')
    rb.overrides = setOverride(setOverride(rb.overrides, 'alerts', al[0], { dur: 77 }), 'periodic', pe[0], { every: 45 })
    useLibrary.setState({ current: rb })
    useStore.setState({ libre: false })
    const s = rideState()
    expect(s.alerts[0].dur).toBe(77); expect(s.periodic[0].every).toBe(45)
    expect(useStore.getState().alerts[0].dur).not.toBe(77)
    useStore.setState({ libre: true })
    expect(rideState().alerts[0].dur).not.toBe(77) // libre : défauts globaux
  })
})
