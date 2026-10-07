import { useRef, useState } from 'react'
import { fdur, hhmm, nf0, nf1, uid } from '../core/format'
import { parseGPX } from '../route/gpx'
import { buildRoute, findClimbs } from '../route/route'
import { POINT_TYPES, type RoutePoint, type Section } from '../strategy/types'
import { useStore } from '../storage/store'
import { timeline } from '../strategy/timeline'
import { MarkForm, PointForm } from './forms'
import { Icon } from './icons'
import { ProfileChart } from './ProfileChart'
import { Sheet } from './Sheet'
import { toast } from './toast'

const when = (d: Date, start: Date | null) =>
  start && d.toDateString() !== start.toDateString() ? `${d.toLocaleDateString('fr-FR', { weekday: 'short' })} ${hhmm(d)}` : hhmm(d)

type Editing = { kind: 'point'; v: RoutePoint; isNew: boolean } | { kind: 'section'; v: Section; isNew: boolean }

export function ParcoursTab() {
  const { route, points, sections, set, setRoute, loadDemo, plan } = useStore()
  const res = useStore(s => s.planResult)
  const file = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState<Editing | null>(null)
  const [here, setHere] = useState<number | null>(null)
  const [menu, setMenu] = useState(false)
  const L = route ? route.total / 1000 : 0
  const marks = sections.filter(x => x.mark)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const g = parseGPX(await f.text())
      setRoute(buildRoute(g.name, g.pts))
      setErr(g.noEle ? 'Parcours chargé, mais sans altitude : pas de pentes ni de montées.' : '')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Import impossible.') }
  }
  const newPoint = (km: number): Editing => ({ kind: 'point', isNew: true, v: { id: uid(), type: 'eau', km: +km.toFixed(1), text: '', avant: 2 } })
  const newMark = (km: number): Editing => ({ kind: 'section', isNew: true, v: { id: uid(), kind: 'zone', name: '', a: +km.toFixed(1), b: +Math.min(L, km + 5).toFixed(1), min: 0, max: 0, mark: true, msg: '', avant: 1 } })

  const input = <input ref={file} type="file" accept=".gpx,application/gpx+xml" hidden onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />

  if (!route) return (
    <>
      <p className="muted" style={{ marginBottom: 16 }}>Importe le GPX de ta course.</p>
      <div className="stack">
        <button className="btn primary big" onClick={() => file.current?.click()}>Importer un GPX</button>
        <button className="btn" onClick={() => { loadDemo(); toast('Boucle démo chargée avec quelques annotations.') }}>Essayer avec la boucle démo</button>
      </div>
      {err && <p className="notice">{err}</p>}
      {input}
    </>
  )

  const t0 = plan?.start ? new Date(plan.start) : null
  const start = res && t0 && !isNaN(t0.valueOf()) ? t0 : null
  const rows = timeline({ route, res: res ?? { cumT: new Float64Array(route.n), H: 1, stops: 0 }, points, marks, start })
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <p className="muted grow">{route.name}</p>
        <button className="iconbtn" aria-label="Actions du parcours" onClick={() => setMenu(true)}><Icon name="more" /></button>
      </div>
      {err && <p className="notice">{err}</p>}
      <div className="facts">
        <div><b>{nf1(L)} km</b><span>distance</span></div>
        <div><b>{nf0(route.dplus)} m</b><span>D+</span></div>
        <div><b>{findClimbs(route).length}</b><span>montées</span></div>
      </div>
      <ProfileChart route={route} sections={sections} points={points} onLongPress={setHere}
        onMove={(id, km) => set({ points: points.map(x => (x.id === id ? { ...x, km } : x)) })}
        onTapPoint={id => { const v = points.find(x => x.id === id); if (v) setEdit({ kind: 'point', v, isNew: false }) }} />

      <h2 className="h2">Road book · {points.filter(p => !p.gen).length + marks.length}</h2>
      <ul className="list">
        {rows.map(r => {
          const pt = r.kind === 'point' ? points.find(x => x.id === r.id) : undefined
          const mk = r.kind === 'mark' ? sections.find(x => x.id === r.id) : undefined
          const info = [r.at && when(r.at, start), r.gapS ? `+${fdur(r.gapS)}` : '', r.stop ? `arrêt ${r.stop} min` : ''].filter(Boolean).join(' · ')
          const body = (
            <>
              <Icon name={r.icon} /><span className="km">{mk ? `${nf1(mk.a)}–${nf1(mk.b)}` : `km ${nf1(r.km)}`}</span>
              <span className="t">{r.label || (pt ? POINT_TYPES[pt.type].n : '')}{info && <small>{info}</small>}</span>
              {r.night && <Icon name="night" size={18} />}
            </>
          )
          return (
            <li key={r.id}>
              {pt || mk
                ? <button className="item" onClick={() => setEdit(pt ? { kind: 'point', v: pt, isNew: false } : { kind: 'section', v: mk!, isNew: false })}>{body}</button>
                : <div className="item" style={{ cursor: 'default' }}>{body}</div>}
            </li>
          )
        })}
      </ul>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn grow" onClick={() => setEdit(newPoint(0))}><Icon name="plus" size={20} />Point</button>
        <button className="btn grow" onClick={() => setEdit(newMark(0))}><Icon name="plus" size={20} />Repère</button>
      </div>
      {input}

      {here != null && (
        <Sheet title={`Ajouter au km ${nf1(here)}`} onClose={() => setHere(null)}>
          <div className="stack"><button className="btn" onClick={() => { setEdit(newPoint(here)); setHere(null) }}>Un point (eau, ravito, danger, note)</button><button className="btn" onClick={() => { setEdit(newMark(here)); setHere(null) }}>Un repère (tronçon nommé)</button></div>
        </Sheet>
      )}
      {menu && (
        <Sheet title="Parcours" onClose={() => setMenu(false)}>
          <div className="stack">
            <button className="btn" onClick={() => { setMenu(false); file.current?.click() }}>Importer un autre GPX</button>
          </div>
        </Sheet>
      )}
      {edit?.kind === 'point' && (
        <Sheet title={edit.isNew ? 'Nouveau point' : 'Modifier le point'} onClose={() => setEdit(null)}>
          <PointForm initial={edit.v} isNew={edit.isNew} maxKm={L} route={route} onClose={() => setEdit(null)}
            onSave={v => { set({ points: edit.isNew ? [...points, v] : points.map(x => (x.id === v.id ? v : x)) }); setEdit(null) }}
            onDelete={() => { set({ points: points.filter(x => x.id !== edit.v.id) }); setEdit(null) }} />
        </Sheet>
      )}
      {edit?.kind === 'section' && (
        <Sheet title={edit.isNew ? 'Nouveau repère' : 'Modifier le repère'} onClose={() => setEdit(null)}>
          <MarkForm initial={edit.v} isNew={edit.isNew} maxKm={L} route={route} onClose={() => setEdit(null)}
            onSave={v => { set({ sections: (edit.isNew ? [...sections, v] : sections.map(x => (x.id === v.id ? v : x))).sort((a, b) => a.a - b.a) }); setEdit(null) }}
            onDelete={() => { set({ sections: sections.filter(x => x.id !== edit.v.id) }); setEdit(null) }} />
        </Sheet>
      )}
    </>
  )
}
