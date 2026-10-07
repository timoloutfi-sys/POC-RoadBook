import { useRef, useState } from 'react'
import { fdur, nf0, nf1 } from '../core/format'
import { exportRoadBook, parseRoadBookFile } from '../library/transfer'
import { useLibrary } from '../library/session'
import type { RoadBookMeta } from '../library/types'
import { useStore } from '../storage/store'
import { POWER_ZONES } from '../strategy/zones'
import { countdown } from '../library/goal'
import { parseGPX } from '../route/gpx'
import { buildRoute, type Route } from '../route/route'
import { Icon } from './icons'
import { ParcoursTab } from './ParcoursTab'
import { PlanTab } from './PlanTab'
import { NoGpx } from './NoGpx'
import { RoadBookSettings } from './RoadBookSettings'
import { SortiesTab } from './SortiesTab'
import { Sheet } from './Sheet'
import { toast } from './toast'
import type { RoadBook } from '../library/types'

type Draft = { name: string; src: { route: Route } | { demo: true } | { file: RoadBook; route: Route | null } }


/** Profil du parcours en bandeau : courbe lissée, remplissage en dégradé qui s'efface vers le bas. */
function Spark({ v, id, work }: { v: number[]; id: string; work?: RoadBookMeta['work'] }) {
  if (v.length < 2) return null
  const W = 300, H = 40, B = 6, lo = Math.min(...v), hi = Math.max(...v), span = Math.max(8, hi - lo)
  const pts = v.map((y, i) => [(i / (v.length - 1)) * W, H - 3 - ((y - lo) / span) * (H - 10)] as const)
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const cx = ((pts[i - 1][0] + pts[i][0]) / 2).toFixed(1)
    d += ` C${cx} ${pts[i - 1][1].toFixed(1)} ${cx} ${pts[i][1].toFixed(1)} ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`
  }
  return (
    <svg className="rb-prof" viewBox={`0 0 ${W} ${H + B}`} preserveAspectRatio="none" aria-hidden>
      <defs><linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".35" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${W} ${H} L0 ${H}Z`} fill={`url(#g${id})`} />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {work?.bands.map((z, i) => <rect key={i} x={z.a * W} y={H + 1} width={Math.max(2, (z.b - z.a) * W)} height={B - 1} fill={z.z >= 0 ? POWER_ZONES[z.z].c : 'var(--muted)'} opacity={z.z >= 0 ? 1 : 0.5} />)}
      {work?.points.map((p, i) => <line key={i} x1={p * W} x2={p * W} y1={4} y2={H} stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="2 3" opacity=".7" vectorEffect="non-scaling-stroke" />)}
    </svg>
  )
}

/** « 12 points · 4 cibles · plan » ou « À préparer » : le travail déjà fait sur ce road book. */
const workLine = (w?: RoadBookMeta['work']) => {
  if (!w) return null
  const cibles = w.bands.filter(b => b.z >= 0).length, reperes = w.bands.length - cibles
  const parts = [w.points.length && `${w.points.length} point${w.points.length > 1 ? 's' : ''}`, cibles && `${cibles} cible${cibles > 1 ? 's' : ''}`, reperes && `${reperes} repère${reperes > 1 ? 's' : ''}`].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'À préparer'
}

function Detail({ onRide }: { onRide: () => void }) {
  const { current, setDetail, sub, setSub } = useLibrary()
  const noGpx = useStore(s => !!s.route?.synthetic)
  if (!current) return null
  return (
    <>
      <div className="row rb-head">
        <button className="iconbtn" aria-label="Retour aux road books" onClick={() => setDetail(false)}><Icon name="chevron" size={24} /></button>
        <b className="grow">{current.name}</b>
      </div>
      <div className="seg rb-sub" role="tablist">
        <button role="tab" aria-pressed={sub === 'parcours'} onClick={() => setSub('parcours')}>Parcours</button>
        <button role="tab" aria-pressed={sub === 'cibles'} onClick={() => setSub('cibles')}>Plan</button>
        <button role="tab" aria-pressed={sub === 'reglages'} onClick={() => setSub('reglages')}>Réglages</button>
        <button role="tab" aria-pressed={sub === 'sorties'} onClick={() => setSub('sorties')}>Sorties</button>
      </div>
      {sub === 'parcours' ? (noGpx ? <NoGpx /> : <ParcoursTab />) : sub === 'cibles' ? <PlanTab /> : sub === 'reglages' ? <RoadBookSettings /> : <SortiesTab roadbookId={current.id} />}
      <div className="rb-cta"><button className="btn primary" style={{ width: '100%' }} onClick={onRide}><Icon name="ride" size={22} />{noGpx ? 'Rouler en sortie libre' : 'Rouler avec'}</button></div>
    </>
  )
}

export function RoadBooksTab({ onRide }: { onRide: () => void }) {
  const { ready, list, current, detail, open, create, duplicate, rename, remove, load } = useLibrary()
  const libre = useStore(s => s.libre), goalId = useStore(s => s.goalId)
  const now = new Date()
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
                  <b>{m.name}</b>
                  <span>{m.hasRoute === false ? `${nf0(m.km)} km${m.estH ? ` · ~${fdur(m.estH * 3600)} estimées` : ''}` : `${nf1(m.km)} km · ${nf0(m.dplus)} m D+${m.estH ? ` · ${fdur(m.estH * 3600)}` : ''}`}</span>
                  {workLine(m.work) && <span className="rb-work">{workLine(m.work)}</span>}
                  <span className="rb-chips">
                    {current?.id === m.id && !libre && <i className="chip-s">Sélectionné</i>}
                    {goalId === m.id && m.when && countdown(m.when, now) && <i className="chip-c">🏁 Objectif · {countdown(m.when, now)}</i>}
                    {m.when && <i className="chip-o">{new Date(m.when).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</i>}
                  </span>
                  {m.hasRoute === false ? <span className="rb-nogpx">Ajouter le GPX</span> : <Spark v={m.prof} id={m.id} work={m.work} />}
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
