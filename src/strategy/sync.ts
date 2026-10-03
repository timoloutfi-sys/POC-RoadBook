import { useStore } from '../storage/store'
import { computePlan, defaultPlanCfg } from './plan'
import { effectiveFtp, effortUnit } from './rider'

/** Minutes d'arrêts prévus aux points : elles remplacent l'estimation générique. */
export const plannedStops = (points: { stop?: number; gen?: boolean }[]) =>
  points.reduce((a, p) => a + (p.gen ? 0 : p.stop ?? 0), 0)

let timer: ReturnType<typeof setTimeout> | undefined

/**
 * Garde le plan à jour en permanence : dès qu'un parcours est chargé il y a un plan (sortie tranquille par défaut),
 * recalculé et appliqué à chaque changement du parcours, du profil ou du plan, quel que soit l'onglet ouvert.
 */
export function startPlanSync() {
  const run = () => {
    const s = useStore.getState()
    if (!s.route) { if (s.planResult) useStore.setState({ planResult: null }); return }
    if (!s.plan) { useStore.setState({ plan: defaultPlanCfg() }); return }
    const stops = plannedStops(s.points)
    const r = computePlan({ route: s.route, body: s.rider, ftp: effectiveFtp(s.rider), unit: effortUnit(s.rider), cfg: stops ? { ...s.plan, stops } : s.plan })
    useStore.setState({ planResult: r })
    s.applyPlan(r)
  }
  useStore.subscribe((s, p) => {
    if (s.route !== p.route || s.rider !== p.rider || s.plan !== p.plan || plannedStops(s.points) !== plannedStops(p.points)) { clearTimeout(timer); timer = setTimeout(run, 120) }
  })
  run()
}
