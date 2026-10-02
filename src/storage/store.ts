import { create } from 'zustand'
import { uid } from '../core/format'
import { buildRoute, demoPoints, deserializeRoute, serializeRoute, type Route } from '../route/route'
import type { PlanResult } from '../strategy/plan'
import type { Section } from '../strategy/types'
import { defaultConfig, migrateConfig, type Config } from './defaults'

const KEY_CFG = 'roadbook-v2-cfg'
const KEY_ROUTE = 'roadbook-v2-route'

interface AppState extends Config {
  route: Route | null
  /** Dernier plan calculé (non sauvegardé, recalculé au démarrage). */
  planResult: PlanResult | null
  set: (p: Partial<Config>) => void
  setRoute: (r: Route | null) => void
  loadDemo: () => void
  replaceAll: (cfg: Config, route: Route | null) => void
  /** Remplace ce qu'un plan a généré (sections, points, rappels, règles de base) ; le travail manuel reste. */
  applyPlan: (r: Pick<PlanResult, 'sections' | 'points' | 'periodic' | 'base'>) => void
}

function load(): { cfg: Config; route: Route | null } {
  const cfg = defaultConfig()
  let route: Route | null = null
  try {
    const c = JSON.parse(localStorage.getItem(KEY_CFG) ?? 'null')
    if (c) Object.assign(cfg, migrateConfig(c))
    const r = JSON.parse(localStorage.getItem(KEY_ROUTE) ?? 'null')
    if (r) route = deserializeRoute(r)
  } catch { /* stockage illisible ou indisponible : on repart des valeurs par défaut */ }
  return { cfg, route }
}

const initial = typeof localStorage !== 'undefined' ? load() : { cfg: defaultConfig(), route: null }

/** Les clés de configuration sauvegardées : tout sauf le parcours, le plan calculé et les actions. */
const CONFIG_KEYS = Object.keys(defaultConfig()) as (keyof Config)[]
export const pickConfig = (s: Config): Config => Object.fromEntries(CONFIG_KEYS.map(k => [k, s[k]])) as unknown as Config

export const useStore = create<AppState>((set, get) => ({
  ...initial.cfg,
  route: initial.route,
  planResult: null,
  set: p => set(p),
  setRoute: route => set({ route, sections: [], points: [], plan: null }),
  loadDemo: () => {
    const route = buildRoute('Boucle démo autour de Chantilly', demoPoints())
    const L = route.total / 1000
    set({
      route,
      plan: null,
      points: [
        { id: uid(), type: 'danger', km: +(L * 0.205).toFixed(1), text: 'Descente, virage serré en bas', avant: 1 },
        { id: uid(), type: 'eau', km: +(L * 0.24).toFixed(1), text: 'Fontaine du cimetière, remplir les 2 bidons', avant: 2 },
        { id: uid(), type: 'ravito', km: +(L * 0.55).toFixed(1), text: 'Station 24 h/24 : tout remplir', avant: 3 },
        { id: uid(), type: 'note', km: +(L * 0.9).toFixed(1), text: 'Plaine exposée : prolongateurs', avant: 1 },
      ],
      sections: [
        { id: uid(), kind: 'zone', mark: true, name: 'Plaine au vent', a: +(L * 0.86).toFixed(1), b: +(L * 0.95).toFixed(1), min: 0, max: 0, msg: 'Vent de face : reste aéro', avant: 1 } as Section,
      ],
    })
  },
  replaceAll: (cfg, route) => set({ ...cfg, route }),
  applyPlan: r => {
    const c = get()
    set({
      sections: [...c.sections.filter(s => !s.gen && !s.auto), ...r.sections].sort((a, b) => a.a - b.a),
      points: [...c.points.filter(p => !p.gen), ...r.points],
      periodic: [...c.periodic.filter(p => !p.auto), ...r.periodic],
      base: r.base,
    })
  },
}))

// Sauvegarde différée : la config à chaque changement, le parcours seulement s'il change.
let saveT: ReturnType<typeof setTimeout> | undefined
let savedRoute: Route | null | undefined = initial.route
useStore.subscribe(s => {
  clearTimeout(saveT)
  saveT = setTimeout(() => {
    try {
      localStorage.setItem(KEY_CFG, JSON.stringify(pickConfig(s)))
      if (s.route !== savedRoute) {
        savedRoute = s.route
        if (s.route) localStorage.setItem(KEY_ROUTE, JSON.stringify(serializeRoute(s.route)))
        else localStorage.removeItem(KEY_ROUTE)
      }
    } catch { /* stockage plein ou bloqué : l'appli continue sans sauvegarde */ }
  }, 400)
})
