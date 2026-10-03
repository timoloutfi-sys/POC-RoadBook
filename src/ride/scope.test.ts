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
