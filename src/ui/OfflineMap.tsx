import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { nf0 } from '../core/format'
import { useLibrary } from '../library/session'
import { deletePack, downloadPack, estimate, packOf, sigOf, type MapPack, type Progress } from '../map/offline'
import { useStore } from '../storage/store'
import { toast } from './toast'

const mo = (b: number) => `${nf0(Math.max(1, b / 1048576))} Mo`

/** Téléchargement en cours : il continue si on quitte la page. */
const useDl = create<{ id: string | null; p: Progress | null; ctl: AbortController | null; gen: number }>(() => ({ id: null, p: null, ctl: null, gen: 0 }))

async function start(id: string, track: Parameters<typeof downloadPack>[1]) {
  if (useDl.getState().id) return
  const ctl = new AbortController()
  useDl.setState({ id, p: { done: 0, total: estimate(track).tiles, bytes: 0 }, ctl })
  try {
    const pack = await downloadPack(id, track, p => useDl.setState({ p }), ctl.signal)
    toast(pack.missing ? `Carte enregistrée, ${pack.missing} morceaux manquants : relance pour compléter.` : `Carte enregistrée (${mo(pack.bytes)}).`)
  } catch (e) {
    toast(e instanceof DOMException && e.name === 'AbortError' ? 'Téléchargement arrêté.' : 'Téléchargement impossible : vérifie le réseau.')
  }
  useDl.setState(s => ({ id: null, p: null, ctl: null, gen: s.gen + 1 }))
}

/** État de la carte hors ligne du road book ouvert. */
function usePack() {
  const { current } = useLibrary(), route = useStore(s => s.route), gen = useDl(s => s.gen)
  const [pack, setPack] = useState<MapPack | null | undefined>(undefined)
  const id = current?.id ?? null
  useEffect(() => { let on = true; if (id) void packOf(id).then(p => on && setPack(p ?? null)); return () => { on = false } }, [id, gen])
  const stale = !!(pack && route && pack.sig !== sigOf(route.track))
  return { id, route, pack, stale }
}

/** Carte hors ligne du road book : télécharger, voir l'avancement, supprimer. */
export function OfflineMapBlock() {
  const { id, route, pack, stale } = usePack(), dl = useDl()
  if (!id || !route || route.synthetic) return null
  const est = estimate(route.track), mine = dl.id === id
  return (
    <div className="card-block">
      <h2 className="h2" style={{ marginTop: 0 }}>Carte hors ligne</h2>
      <p className="muted" style={{ fontSize: 15, marginBottom: 10 }}>
        {mine && dl.p ? `Téléchargement : ${nf0((dl.p.done / Math.max(1, dl.p.total)) * 100)} % · ${mo(dl.p.bytes)}`
          : pack && !stale ? `Enregistrée sur le téléphone : ${mo(pack.bytes)}${pack.missing ? `, ${pack.missing} morceaux manquants` : ''}. La navigation marche sans réseau.`
          : stale ? 'Le parcours a changé : la carte est à refaire.'
          : `Le parcours et ses abords (environ ${mo(est.bytes)}), pour naviguer sans réseau. À faire en Wi-Fi.`}
      </p>
      {mine && dl.p && <progress max={dl.p.total} value={dl.p.done} style={{ width: '100%', marginBottom: 10 }} />}
      <div className="row">
        {mine ? <button className="btn" onClick={() => dl.ctl?.abort()}>Arrêter</button>
          : (!pack || stale || pack.missing > 0) && <button className="btn primary" disabled={!!dl.id} onClick={() => void start(id, route.track)}>{pack && !stale ? 'Compléter la carte' : 'Télécharger la carte'}</button>}
        {pack && !mine && <button className="btn ghost danger" onClick={() => void deletePack(id).then(() => useDl.setState(s => ({ gen: s.gen + 1 })))}>Supprimer</button>}
      </div>
    </div>
  )
}

/** Ligne de « Avant de partir » : la carte est-elle prête pour rouler sans réseau ? */
export function OfflineMapCheck({ Check }: { Check: (p: { s: 'ok' | 'ko' | 'wa'; t: string; sm?: string }) => React.ReactNode }) {
  const { id, route, pack, stale } = usePack(), dl = useDl()
  if (!id || !route || route.synthetic) return null
  if (dl.id === id && dl.p) return Check({ s: 'wa', t: `Carte en téléchargement : ${nf0((dl.p.done / Math.max(1, dl.p.total)) * 100)} %` })
  if (pack && !stale && !pack.missing) return Check({ s: 'ok', t: 'Carte enregistrée : navigation sans réseau' })
  return (
    <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
      <div className="grow">{Check({ s: 'wa', t: stale ? 'Carte à refaire (parcours changé)' : 'Carte pas enregistrée', sm: 'Sans réseau, la carte reste vide ; les virages s’affichent quand même' })}</div>
      <button className="btn" style={{ minHeight: 36, padding: '0 12px', fontSize: 15 }} disabled={!!dl.id} onClick={() => void start(id, route.track)}>Télécharger</button>
    </div>
  )
}
