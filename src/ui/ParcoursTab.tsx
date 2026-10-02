import { useRef, useState } from 'react'
import { nf0, nf1, uid } from '../core/format'
import { parseGPX } from '../route/gpx'
import { buildRoute, findClimbs, sectionStats } from '../route/route'
import { POINT_TYPES, type RoutePoint, type Section } from '../strategy/types'
import { useStore } from '../storage/store'
import { MarkForm, PointForm, statsLine } from './forms'
import { Icon } from './icons'
import { ProfileChart } from './ProfileChart'
import { Sheet } from './Sheet'
import { toast } from './toast'

type Editing = { kind: 'point'; v: RoutePoint; isNew: boolean } | { kind: 'section'; v: Section; isNew: boolean }

export function ParcoursTab() {
  const { route, points, sections, set, setRoute, loadDemo } = useStore()
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

  const sorted = [...points].sort((a, b) => a.km - b.km)
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

      <h2 className="h2">Points · {points.length}</h2>
      <ul className="list">
        {sorted.map(p => (
          <li key={p.id}><button className="item" onClick={() => setEdit({ kind: 'point', v: p, isNew: false })}>
            <Icon name={p.type} /><span className="km">km {nf1(p.km)}</span><span className="t">{p.text || POINT_TYPES[p.type].n}</span>
          </button></li>
        ))}
        {!sorted.length && <li className="muted" style={{ padding: '12px 0' }}>Aucun point.</li>}
      </ul>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => setEdit(newPoint(0))}><Icon name="plus" size={20} />Ajouter un point</button>

      <h2 className="h2">Repères · {marks.length}</h2>
      <ul className="list">
        {marks.map(m => (
          <li key={m.id}><button className="item" onClick={() => setEdit({ kind: 'section', v: m, isNew: false })}>
            <Icon name={m.kind === 'montee' ? 'montee' : 'route'} /><span className="km">{nf1(m.a)}–{nf1(m.b)}</span>
            <span className="t">{m.name}<small>{statsLine(sectionStats(route, m.a, m.b))}</small></span>
          </button></li>
        ))}
        {!marks.length && <li className="muted" style={{ padding: '12px 0' }}>Aucun repère.</li>}
      </ul>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => setEdit(newMark(0))}><Icon name="plus" size={20} />Ajouter un repère</button>
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
          <PointForm initial={edit.v} isNew={edit.isNew} maxKm={L} onClose={() => setEdit(null)}
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
