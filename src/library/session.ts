import { create } from 'zustand'
import { buildRoute, demoPoints, type Route } from '../route/route'
import { useStore } from '../storage/store'
import { defaultBase } from '../strategy/types'
import { Db } from './db'
import { Library } from './library'
import { roadBookFromConfig } from './migrate'
import { duplicateRoadBook, newRoadBook } from './roadbooks'
import type { Ride, RoadBook, RoadBookMeta } from './types'

interface Session {
  ready: boolean
  list: RoadBookMeta[]
  /** Le road book chargé dans l'espace de travail (celui que Parcours et Cibles modifient). */
  current: RoadBook | null
  /** Affiche le détail du road book courant plutôt que la liste. */
  detail: boolean
  /** Sortie restée ouverte (Chrome fermé en route) : à reprendre ou à terminer. */
  unfinished: Ride | null
  setDetail: (d: boolean) => void
  create: (name: string, src: { route: Route } | { demo: true } | { file: RoadBook; route: Route | null }) => Promise<void>
  open: (id: string, detail?: boolean) => Promise<void>
  duplicate: (id: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  /** Supprime et renvoie de quoi annuler. */
  remove: (id: string) => Promise<() => Promise<void>>
  /** Modifie le road book courant (réglages propres) et l'enregistre. */
  patch: (p: Partial<Pick<RoadBook, 'overrides' | 'startScreen'>>) => Promise<void>
  load: (id: string) => Promise<{ rb: RoadBook; route: Route | null } | null>
}

let lib: Library | null = null
export const getLibrary = () => lib
const refresh = async () => { if (lib) useLibrary.setState({ list: await lib.list() }) }

/** Charge un road book dans l'espace de travail. */
function apply(rb: RoadBook, route: Route | null) {
  savedRoute = route
  useStore.setState({ route, sections: rb.sections, points: rb.points, base: rb.base, plan: rb.plan, activeRoadbook: rb.id, libre: false, libraryMigrated: true })
  useLibrary.setState({ current: rb })
}

export const useLibrary = create<Session>((set, get) => ({
  ready: false, list: [], current: null, detail: false, unfinished: null,
  setDetail: detail => set({ detail }),
  patch: async p => {
    const cur = get().current
    if (!cur || !lib) return
    set({ current: { ...cur, ...p } })
    const saved = await lib.saveRoadBook({ ...cur, ...p })
    const now = get().current
    if (now?.id === saved.id) set({ current: { ...now, updated: saved.updated } })
    await refresh()
  },
  load: async id => {
    const rb = await lib?.getRoadBook(id)
    return rb && lib ? { rb, route: await lib.getRoute(id) } : null
  },
  open: async (id, detail = true) => {
    const r = await get().load(id)
    if (r) { apply(r.rb, r.route); set({ detail }) }
  },
  create: async (name, src) => {
    if (!lib) return
    const rb0 = newRoadBook(name)
    const file = 'file' in src ? src : null
    const rb = file ? { ...file.file, id: rb0.id, name, created: rb0.created, updated: rb0.updated } : rb0
    const route = 'route' in src ? src.route : file ? file.route : buildRoute(name, demoPoints())
    await lib.saveRoadBook(rb, route)
    apply(rb, route)
    if ('demo' in src) useStore.getState().loadDemo()
    set({ detail: true })
    await refresh()
  },
  duplicate: async id => {
    const r = await get().load(id)
    if (!r || !lib) return
    await lib.saveRoadBook(duplicateRoadBook(r.rb), r.route, get().list.find(m => m.id === id)?.estH ?? null)
    await refresh()
  },
  rename: async (id, name) => {
    const rb = get().current?.id === id ? get().current! : (await get().load(id))?.rb
    if (!rb || !lib) return
    const next = { ...rb, name }
    await lib.saveRoadBook(next)
    if (get().current?.id === id) set({ current: next })
    await refresh()
  },
  remove: async id => {
    const r = await get().load(id)
    if (!lib) return async () => {}
    await lib.removeRoadBook(id)
    if (get().current?.id === id) {
      set({ current: null, detail: false })
      useStore.setState({ route: null, sections: [], points: [], base: defaultBase(), plan: null, activeRoadbook: null })
    }
    await refresh()
    return async () => { if (r) { await lib?.saveRoadBook(r.rb, r.route); await refresh() } }
  },
}))

let timer: ReturnType<typeof setTimeout> | undefined
let savedRoute: Route | null | undefined

/** Enregistre dans la bibliothèque ce que Parcours et Cibles modifient. */
function startAutosave() {
  useStore.subscribe((s, p) => {
    if (s.sections === p.sections && s.points === p.points && s.base === p.base && s.plan === p.plan && s.route === p.route && s.planResult === p.planResult) return
    clearTimeout(timer)
    timer = setTimeout(async () => {
      const { current } = useLibrary.getState()
      if (!lib || !current || s.activeRoadbook !== current.id) return
      const st = useStore.getState()
      const next = { ...current, sections: st.sections, points: st.points, base: st.base, plan: st.plan }
      const saved = await lib.saveRoadBook(next, st.route !== savedRoute ? st.route : undefined, st.planResult?.H ?? null)
      savedRoute = st.route
      useLibrary.setState({ current: saved })
      await refresh()
    }, 800)
  })
}

/** Ouvre la bibliothèque et reprend le travail en cours au premier lancement. */
export async function startLibrary() {
  try {
    lib = new Library(await Db.open())
    const st = useStore.getState()
    let id = st.activeRoadbook
    let rb = id ? await lib.getRoadBook(id) : undefined
    if (!rb && (!st.libraryMigrated || id)) {
      const m = roadBookFromConfig(st, st.route)
      if (m) { await lib.saveRoadBook(m.rb, m.route, st.planResult?.H ?? null); rb = m.rb; id = m.rb.id }
    }
    savedRoute = st.route
    if (rb) { useLibrary.setState({ current: rb }); useStore.setState({ activeRoadbook: rb.id, libraryMigrated: true }) }
    else useStore.setState({ activeRoadbook: null, libraryMigrated: true })
    await refresh()
    const open = (await lib.listRides()).find(r => !r.end && r.kind !== 'simu')
    if (open) useLibrary.setState({ unfinished: open })
    startAutosave()
  } catch { /* IndexedDB indisponible : l'appli reste sur l'espace de travail local */ }
  useLibrary.setState({ ready: true })
}
