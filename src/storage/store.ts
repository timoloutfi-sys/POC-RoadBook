import { create } from 'zustand'
import { buildRoute, demoPoints, deserializeRoute, findClimbs, serializeRoute, type Route } from '../route/route'
import { nf1, uid } from '../core/format'
import { defaultConfig, migrateConfig, type Config } from './defaults'

const KEY_CFG = 'roadbook-v2-cfg'
const KEY_ROUTE = 'roadbook-v2-route'

interface AppState extends Config {
  route: Route | null
  set: (p: Partial<Config>) => void
  setRoute: (r: Route | null) => void
  loadDemo: () => void
  detectClimbs: () => number
  replaceAll: (cfg: Config, route: Route | null) => void
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

/** Montées détectées, en sections annoncées 1 km avant. */
function climbSections(route: Route, base: Config['base']) {
  return findClimbs(route).map((c, k) => ({
    id: uid(), auto: true, kind: 'montee' as const,
    name: `Montée ${k + 1} (${nf1(c.len / 1000)} km à ${nf1(c.avg)} %)`,
    a: +c.a.toFixed(1), b: +c.b.toFixed(1), min: base.montee[0], max: base.montee[1],
    msg: 'Mange maintenant, avant la montée', avant: 1,
  }))
}

export const useStore = create<AppState>((set, get) => ({
  ...initial.cfg,
  route: initial.route,
  set: p => set(p),
  setRoute: route => set({ route, sections: [], points: [] }),
  loadDemo: () => {
    const route = buildRoute('Boucle démo autour de Chantilly', demoPoints())
    const L = route.total / 1000, base = get().base
    set({
      route,
      points: [
        { id: uid(), type: 'danger', km: +(L * 0.205).toFixed(1), text: 'Descente, virage serré en bas', avant: 1 },
        { id: uid(), type: 'eau', km: +(L * 0.24).toFixed(1), text: 'Fontaine du cimetière, remplir les 2 bidons', avant: 2 },
        { id: uid(), type: 'ravito', km: +(L * 0.55).toFixed(1), text: 'Station 24 h/24 : tout remplir', avant: 3 },
        { id: uid(), type: 'note', km: +(L * 0.9).toFixed(1), text: 'Plaine exposée : prolongateurs', avant: 1 },
      ],
      sections: [
        ...climbSections(route, base),
        { id: uid(), kind: 'zone' as const, name: 'Plaine au vent', a: +(L * 0.86).toFixed(1), b: +(L * 0.95).toFixed(1), min: 70, max: 76, msg: 'Vent de face : pousse un peu, reste aéro', avant: 1 },
      ].sort((x, y) => x.a - y.a),
    })
  },
  detectClimbs: () => {
    const { route, base, sections } = get()
    if (!route) return 0
    const found = climbSections(route, base)
    set({ sections: [...sections.filter(z => !z.auto), ...found].sort((x, y) => x.a - y.a) })
    return found.length
  },
  replaceAll: (cfg, route) => set({ ...cfg, route }),
}))

// Sauvegarde différée : la config à chaque changement, le parcours seulement s'il change.
let saveT: ReturnType<typeof setTimeout> | undefined
let savedRoute: Route | null | undefined = initial.route
useStore.subscribe(s => {
  clearTimeout(saveT)
  saveT = setTimeout(() => {
    try {
      const { route, set: _a, setRoute: _b, loadDemo: _c, detectClimbs: _d, replaceAll: _e, ...cfg } = s
      localStorage.setItem(KEY_CFG, JSON.stringify(cfg))
      if (route !== savedRoute) {
        savedRoute = route
        if (route) localStorage.setItem(KEY_ROUTE, JSON.stringify(serializeRoute(route)))
        else localStorage.removeItem(KEY_ROUTE)
      }
    } catch { /* stockage plein ou bloqué : l'appli continue sans sauvegarde */ }
  }, 400)
})
