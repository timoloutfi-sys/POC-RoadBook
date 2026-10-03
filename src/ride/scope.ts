import { defaultBase } from '../strategy/types'
import { useStore } from '../storage/store'

/** L'état vu par la sortie : en sortie libre, ni parcours, ni repères, ni plan. */
export function rideState() {
  const c = useStore.getState()
  return c.libre ? { ...c, route: null, sections: [], points: [], base: defaultBase(), plan: null } : c
}
