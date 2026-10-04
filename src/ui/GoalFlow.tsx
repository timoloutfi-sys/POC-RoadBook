import { useEffect, useRef, useState } from 'react'
import { fdur, nf0 } from '../core/format'
import { useLibrary } from '../library/session'
import { parseGPX } from '../route/gpx'
import { buildRoute } from '../route/route'
import type { Terrain } from '../route/synthetic'
import { estimateCourse, type CourseEstimate } from '../strategy/estimate'
import { useStore } from '../storage/store'
import { Field, Num } from './fields'
import { Icon } from './icons'
import { Sheet } from './Sheet'
import { toast } from './toast'

const TERRAINS: [Terrain, string][] = [['plat', 'Plat'], ['vallonne', 'Vallonné'], ['montagne', 'Montagne']]

/** « Fixer un objectif » : une nouvelle course, ou un road book existant. */
export function FixGoalSheet({ onClose, onNew, onPick }: { onClose: () => void; onNew: () => void; onPick: (id: string) => void }) {
  const list = useLibrary(s => s.list)
  return (
    <Sheet title="Fixer un objectif" onClose={onClose}>
      <button className="btn primary big" style={{ minHeight: 52, fontSize: 17 }} onClick={onNew}><Icon name="flag" size={22} />Nouvelle course</button>
      <p className="muted" style={{ margin: '6px 2px 12px', fontSize: 14 }}>Sans GPX : tu l’ajouteras quand l’organisateur le publie.</p>
      {list.length > 0 && (
        <>
          <h2 className="h2">Ou un road book existant</h2>
          <ul className="list">
            {list.map(m => (
              <li key={m.id}><button className="item" onClick={() => onPick(m.id)}>
                <span className="t">{m.name}<small>{m.km ? `${nf0(m.km)} km` : 'GPX à venir'}{m.dplus ? ` · ${nf0(m.dplus)} m` : ''}</small></span><Icon name="chevron" size={18} />
              </button></li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  )
}

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** Formulaire plein écran : une course, avec ou sans GPX. Elle devient l'objectif. */
export function NewCourse({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { createCourse } = useLibrary()
  const rider = useStore(s => s.rider)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('06:00')
  const [km, setKm] = useState<number | null>(null)
  const [dplus, setDplus] = useState<number | null>(null)
  const [terrain, setTerrain] = useState<Terrain>('vallonne')
  const [est, setEst] = useState<CourseEstimate | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const when = date ? `${date}T${time || '06:00'}` : ''
  const ok = name.trim() && date >= todayIso() && (km ?? 0) >= 5

  // L'estimation se recalcule un instant après la dernière frappe.
  useEffect(() => {
    if (!km || km < 5) { setEst(null); return }
    const t = setTimeout(() => setEst(estimateCourse({ km, dplus: dplus ?? 0, terrain }, rider, when || `${todayIso()}T06:00`)), 400)
    return () => clearTimeout(t)
  }, [km, dplus, terrain, when, rider])

  const create = async (route?: ReturnType<typeof buildRoute>) => {
    await createCourse({ name: name.trim(), when, km: km ?? 0, dplus: dplus ?? 0, terrain, route })
    toast('Objectif fixé.')
    onDone()
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try { const g = parseGPX(await f.text()); await create(buildRoute(g.name, g.pts)) } catch (e) { toast(e instanceof Error ? e.message : 'GPX illisible.') }
  }

  return (
    <div className="fullscreen" role="dialog" aria-modal="true" aria-label="Nouvelle course">
      <div className="row rb-head"><button className="iconbtn" aria-label="Retour" onClick={onClose}><Icon name="chevron" size={24} /></button><b className="grow">Nouvelle course</b></div>
      <Field label="Nom"><input value={name} placeholder="Ex. Race Across Paris" onChange={e => setName(e.target.value)} /></Field>
      <div className="cols2">
        <Field label="Date" hint={date && date < todayIso() ? 'Choisis une date à venir' : undefined}><input type="date" value={date} min={todayIso()} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Départ"><input type="time" value={time} onChange={e => setTime(e.target.value)} /></Field>
        <Field label="Distance (km)"><Num value={km} min={0} step={10} onChange={setKm} /></Field>
        <Field label="Dénivelé (m D+)"><Num value={dplus} min={0} step={100} onChange={setDplus} /></Field>
      </div>
      <Field label="Terrain">
        <div className="seg" role="group" style={{ display: 'flex' }}>
          {TERRAINS.map(([k, n]) => <button key={k} type="button" style={{ flex: 1 }} aria-pressed={terrain === k} onClick={() => setTerrain(k)}>{n}</button>)}
        </div>
      </Field>
      <div className="estimate" aria-live="polite">
        <span className="muted">Estimation avec ton profil</span>
        {est ? (
          <div className="facts"><div><b>~{fdur(est.H * 3600)}</b><span>roulage</span></div><div><b>~{fdur(est.total * 3600)}</b><span>avec arrêts</span></div><div><b>{est.nights}</b><span>{est.nights > 1 ? 'nuits' : 'nuit'}</span></div></div>
        ) : <span className="muted">Renseigne la distance.</span>}
        <small className="muted">Affinée dès que tu ajoutes le GPX.</small>
      </div>
      <button className="btn primary big" disabled={!ok} onClick={() => void create()}>Créer l’objectif</button>
      <button className="btn ghost" style={{ marginTop: 8, width: '100%' }} disabled={!ok} onClick={() => file.current?.click()}><Icon name="upload" size={20} />J’ai déjà le GPX</button>
      <input ref={file} type="file" accept=".gpx,application/gpx+xml" hidden onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}
