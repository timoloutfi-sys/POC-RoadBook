import { syntheticRoute } from '../route/synthetic'
import type { Estimate } from '../library/types'
import { computePlan, defaultPlanCfg } from './plan'
import { effectiveFtp, effortUnit, type Rider } from './rider'

export interface CourseEstimate { H: number; total: number; nights: number }

/** Durée estimée d'une course sans GPX, au rythme tenable pour cette durée (mode course), avec le profil du coureur (parcours fictif, voir `syntheticRoute`). */
export function estimateCourse(est: Estimate, rider: Rider, start: string): CourseEstimate {
  const route = syntheticRoute('estimation', est)
  const r = computePlan({ route, body: rider, ftp: effectiveFtp(rider), unit: effortUnit(rider), cfg: { ...defaultPlanCfg(), mode: 'course', start } })
  return { H: r.H, total: r.total, nights: r.nights }
}
