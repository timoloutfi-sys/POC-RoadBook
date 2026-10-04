import { effectiveAlerts, effectivePeriodic } from '../library/roadbooks'
import { useLibrary } from '../library/session'
import { defaultBase } from '../strategy/types'
import { useStore } from '../storage/store'

/** L'état vu par la sortie : en sortie libre, ni parcours, ni repères, ni plan. */
export function rideState() {
  const c = useStore.getState()
  // Course en attente de son GPX : on roule en sortie libre, avec les cibles de ce road book.
  if (c.route?.synthetic) return { ...c, route: null, sections: [], points: [], plan: null }
  if (c.libre) return { ...c, route: null, sections: [], points: [], base: defaultBase(), plan: null }
  const o = useLibrary.getState().current?.overrides
  return o ? { ...c, alerts: effectiveAlerts(c.alerts, o), periodic: effectivePeriodic(c.periodic, o) } : c
}
