import { useRef, useState } from 'react'
import { fdur, nf0, nf1 } from '../core/format'
import { exportRoadBook, parseRoadBookFile } from '../library/transfer'
import { useLibrary } from '../library/session'
import type { RoadBookMeta } from '../library/types'
import { useStore } from '../storage/store'
import { parseGPX } from '../route/gpx'
import { buildRoute, type Route } from '../route/route'
import { Icon } from './icons'
import { ParcoursTab } from './ParcoursTab'
import { PlanTab } from './PlanTab'
import { RoadBookSettings } from './RoadBookSettings'
import { Sheet } from './Sheet'
import { toast } from './toast'
import type { RoadBook } from '../library/types'

type Draft = { name: string; src: { route: Route } | { demo: true } | { file: RoadBook; route: Route | null } }

const when = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

function Spark({ v }: { v: number[] }) {
  if (v.length < 2) return <div className="rb-spark" />
  const d = v.map((y, i) => `${i ? 'L' : 'M'}${(i / (v.length - 1)) * 100} ${100 - y * 0.8 - 10}`).join('')
  return <svg className="rb-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden><path d={`${d}L100 100L0 100Z`} /></svg>
}

function Detail({ onRide }: { onRide: () => void }) {
  const { current, setDetail } = useLibrary()
  const [sub, setSub] = useState<'parcours' | 'cibles' | 'reglages'>('parcours')
  if (!current) return null
  return (
    <>
      <div className="row rb-head">
        <button className="iconbtn" aria-label="Retour aux road books" onClick={() => setDetail(false)}><Icon name="chevron" size={24} /></button>
        <b className="grow">{current.name}</b>
      </div>
      <div className="seg rb-sub" role="tablist">
        <button role="tab" aria-pressed={sub === 'parcours'} onClick={() => setSub('parcours')}>Parcours</button>
        <button role="tab" aria-pressed={sub === 'cibles'} onClick={() => setSub('cibles')}>Cibles</button>
        <button role="tab" aria-pressed={sub === 'reglages'} onClick={() => setSub('reglages')}>Réglages</button>
      </div>
      {sub === 'parcours' ? <ParcoursTab /> : sub === 'cibles' ? <PlanTab /> : <RoadBookSettings />}
      <div className="rb-cta"><button className="btn primary big" onClick={onRide}><Icon name="ride" size={22} />Rouler avec</button></div>
    </>
  )
}

export function RoadBooksTab({ onRide }: { onRide: () => void }) {
  const { ready, list, current, detail, open, create, duplicate, rename, remove, load } = useLibrary()
  const libre = useStore(s => s.libre)
  const file = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [menu, setMenu] = useState<RoadBookMeta | null>(null)
  const [renaming, setRenaming] = useState<RoadBookMeta | null>(null)
  const [undo, setUndo] = useState<{ name: string; run: () => Promise<void> } | null>(null)
  const [err, setErr] = useState('')

  if (detail && current) return <Detail onRide={onRide} />

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const text = await f.text()
      if (f.name.endsWith('.json')) {
        const m = parseRoadBookFile(text)
        setDraft({ name: m.rb.name, src: { file: m.rb, route: m.route } })
      } else {
        const g = parseGPX(text)
        setDraft({ name: g.name || f.name.replace(/\.gpx$/i, ''), src: { route: buildRoute(g.name, g.pts) } })
        setErr(g.noEle ? 'Ce GPX n’a pas d’altitude : pas de pentes ni de montées.' : '')
      }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Import impossible.') }
  }
  const download = async (m: RoadBookMeta) => {
    const r = await load(m.id)
    if (!r) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([exportRoadBook(r.rb, r.route)], { type: 'application/json' }))
    a.download = `${r.rb.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.roadbook.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const input = <input ref={file} type="file" accept=".gpx,.json,application/gpx+xml,application/json" hidden onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />

  if (!ready) return null
  return (
    <>
      {err && <p className="notice">{err}</p>}
      {!list.length ? (
        <>
          <p className="muted" style={{ marginBottom: 16 }}>Importe le GPX de ta course pour créer ton premier road book.</p>
          <div className="stack">
            <button className="btn primary big" onClick={() => file.current?.click()}>Importer un GPX</button>
            <button className="btn" onClick={() => setDraft({ name: 'Boucle démo', src: { demo: true } })}>Essayer avec la boucle démo</button>
          </div>
        </>
      ) : (
        <>
          <ul className="list rbs">
            {list.map(m => (
              <li key={m.id} className="rb-card">
                <button className="rb-open" onClick={() => void open(m.id)}>
                  <Spark v={m.prof} />
                  <b>{m.name}</b>
                  <span>{nf1(m.km)} km · {nf0(m.dplus)} m D+{m.estH ? ` · ${fdur(m.estH * 3600)}` : ''}</span>
                  <small>{current?.id === m.id && !libre ? 'Sélectionné · ' : ''}modifié le {when(m.updated)}</small>
                </button>
                <button className="iconbtn" aria-label={`Actions de ${m.name}`} onClick={() => setMenu(m)}><Icon name="more" /></button>
              </li>
            ))}
          </ul>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => file.current?.click()}><Icon name="plus" size={20} />Nouveau road book</button>
        </>
      )}
      {undo && (
        <div className="row undo" role="status">
          <span className="grow">« {undo.name} » supprimé</span>
          <button className="btn" onClick={() => { void undo.run(); setUndo(null) }}>Annuler</button>
        </div>
      )}
      {input}

      {draft && (
        <Sheet title="Nouveau road book" onClose={() => setDraft(null)}>
          <label className="field"><span>Nom</span><input value={draft.name} autoFocus onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn grow" onClick={() => setDraft(null)}>Annuler</button>
            <button className="btn primary grow" disabled={!draft.name.trim()} onClick={() => { void create(draft.name.trim(), draft.src); setDraft(null) }}>Créer</button>
          </div>
        </Sheet>
      )}
      {menu && (
        <Sheet title={menu.name} onClose={() => setMenu(null)}>
          <div className="stack">
            <button className="btn" onClick={() => { void duplicate(menu.id); setMenu(null); toast('Road book dupliqué.') }}>Dupliquer</button>
            <button className="btn" onClick={() => { setRenaming(menu); setMenu(null) }}>Renommer</button>
            <button className="btn" onClick={() => { void download(menu); setMenu(null) }}>Exporter</button>
            <button className="btn danger" onClick={() => { const m = menu; setMenu(null); void remove(m.id).then(run => setUndo({ name: m.name, run })) }}>Supprimer</button>
          </div>
        </Sheet>
      )}
      {renaming && (
        <Sheet title="Renommer" onClose={() => setRenaming(null)}>
          <label className="field"><span>Nom</span><input value={renaming.name} autoFocus onChange={e => setRenaming({ ...renaming, name: e.target.value })} /></label>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn grow" onClick={() => setRenaming(null)}>Annuler</button>
            <button className="btn primary grow" disabled={!renaming.name.trim()} onClick={() => { void rename(renaming.id, renaming.name.trim()); setRenaming(null) }}>Enregistrer</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
