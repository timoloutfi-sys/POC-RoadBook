import { buildRoute, serializeRoute, type Route } from '../route/route'
import { defaultConfig, migrateConfig, type Config } from './defaults'

export interface Snapshot { v: 2; cfg: Config; route: ReturnType<typeof serializeRoute> | null }

export const exportPlan = (cfg: Config, route: Route | null): string =>
  JSON.stringify({ v: 2, cfg, route: route ? serializeRoute(route) : null } satisfies Snapshot)

/**
 * Relit un plan exporté. Accepte aussi l'ancien format du prototype HTML
 * (ftp, mass, cda, global, zones… à plat dans cfg).
 */
export function importPlan(text: string): { cfg: Config; route: Route | null } {
  const d = JSON.parse(text)
  if (!d || typeof d !== 'object' || !d.cfg) throw new Error('Texte illisible : colle un plan exporté par Road book.')
  const base = defaultConfig()
  let cfg: Config
  if (d.v === 2) cfg = migrateConfig(d.cfg)
  else {
    const o = d.cfg
    cfg = {
      ...base,
      rider: { ...base.rider, ftp: o.ftp ?? base.rider.ftp, mass: o.mass ?? base.rider.mass, cda: o.cda ?? base.rider.cda },
      wheel: o.wheel ?? base.wheel,
      base: { ...base.base, ...o.global },
      sections: o.zones ?? [],
      points: o.points ?? [],
      periodic: o.periodic ?? base.periodic,
      maxPerHour: o.maxPerHour ?? base.maxPerHour,
      onboarded: true,
    }
    cfg = migrateConfig({ ...cfg, layout: o.layout } as Config)
  }
  const route = d.route ? buildRoute(d.route.name, d.route.pts.map((p: number[]) => ({ lat: p[0], lon: p[1], ele: p[2] }))) : null
  return { cfg, route }
}
