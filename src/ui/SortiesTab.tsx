import { useCallback, useEffect, useState } from 'react'
import { fdur, nf0, nf1 } from '../core/format'
import { analyze, conformity, type Analysis } from '../library/analysis'
import { getLibrary, useLibrary } from '../library/session'
import { plannedAt } from '../library/summary'
import type { Ride } from '../library/types'
import type { Route } from '../route/route'
import { HR_ZONES, POWER_ZONES } from '../strategy/zones'
import { Icon } from './icons'
import { RideChart } from './RideChart'
import { SummaryList } from './RideEnd'
import { rideToGpx } from '../library/gpxExport'
import { Sheet } from './Sheet'
import { toast } from './toast'

const dateOf = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const clock = (s: number | null) => (s == null ? '–' : fdur(Math.abs(s)))
const sgn = (s: number) => `${s >= 0 ? '+' : '−'}${fdur(Math.abs(s))}`

/** Liste des sorties, toutes ou celles d'un road book. */
export function SortiesTab({ roadbookId }: { roadbookId?: string }) {
  const [rides, setRides] = useState<Ride[] | null>(null)
  const pending = useLibrary(s => s.rideToOpen)
  const [open, setOpen] = useState<string | null>(pending)
  useEffect(() => { if (pending) useLibrary.getState().setRideToOpen(null) }, [pending])
  const { list } = useLibrary()
  const [filter, setFilter] = useState('')
  const load = useCallback(() => { void getLibrary()?.listRides(roadbookId).then(r => setRides(r.filter(x => x.end && x.kind !== 'simu'))) }, [roadbookId])
  useEffect(load, [load])

  if (open) return <RideDetail id={open} onBack={() => { setOpen(null); load() }} />
  if (!rides) return null
  const shown = rides.filter(r => !filter || (filter === 'libre' ? !r.roadbookId : r.roadbookId === filter))
  return (
    <>
      {!roadbookId && rides.length > 0 && (
        <label className="field"><span>Road book</span>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">Tous</option>
            {list.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value="libre">Sortie libre</option>
          </select>
        </label>
      )}
      {!shown.length ? <p className="muted">Aucune sortie enregistrée. Lance une sortie depuis l’onglet Rouler.</p> : (
        <ul className="list">
          {shown.map(r => {
            const s = r.summary, c = s ? conformity(s) : null
            return (
              <li key={r.id}><button className="item" onClick={() => setOpen(r.id)}>
                <span className="t">{r.name}<small>{dateOf(r.start)}{s ? ` · ${nf1(s.km)} km · ${fdur(s.moving)}` : ''}{r.roadbookId || r.kind === 'libre' ? '' : ' · road book supprimé'}</small></span>
                {c && <span className={`dot ${c}`} aria-label={{ ok: 'Plan tenu', wa: 'Plan à peu près tenu', ko: 'Plan non tenu' }[c]} />}
                <Icon name="chevron" size={18} />
              </button></li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function RideDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [d, setD] = useState<{ ride: Ride; a: Analysis } | null>(null)
  const [menu, setMenu] = useState<'rename' | 'delete' | null>(null)
  const [name, setName] = useState('')
  useEffect(() => {
    void (async () => {
      const lib = getLibrary()
      const ride = await lib?.getRide(id)
      if (!lib || !ride) return
      const route: Route | null = ride.roadbookId ? await lib.getRoute(ride.roadbookId) : null
      setD({ ride, a: analyze(ride, await lib.chunks(id), route) })
      setName(ride.name)
    })()
  }, [id])
  if (!d) return null
  const { ride, a } = d, s = ride.summary
  const unit = a.unit === 'power' ? 'W' : 'bpm'
  const zdefs = a.unit === 'power' ? POWER_ZONES : HR_ZONES
  const zmax = Math.max(1, ...a.zones.real, ...(a.zones.plan ?? []))
  const planned = s && ride.planSnapshot ? plannedAt(ride.planSnapshot.etas, s.km) : null
  const rename = async () => { const lib = getLibrary(); if (lib) { await lib.saveRide({ ...ride, name: name.trim() || ride.name }); setD({ ride: { ...ride, name: name.trim() || ride.name }, a }); setMenu(null) } }
  const exportGpx = async () => {
    const lib = getLibrary()
    const gpx = lib ? rideToGpx(ride, await lib.chunks(ride.id)) : null
    setMenu(null)
    if (!gpx) { toast('Pas de position enregistrée pour cette sortie.'); return }
    const file = new File([gpx], `${ride.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.gpx`, { type: 'application/gpx+xml' })
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: ride.name }); return }
    } catch { /* partage annulé : on télécharge */ }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file); a.download = file.name; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const remove = async () => { await getLibrary()?.removeRide(ride.id); onBack() }

  return (
    <>
      <div className="row rb-head">
        <button className="iconbtn" aria-label="Retour aux sorties" onClick={onBack}><Icon name="chevron" size={24} /></button>
        <b className="grow">{ride.name}</b>
        <button className="iconbtn" aria-label="Actions" onClick={() => setMenu('rename')}><Icon name="more" /></button>
      </div>
      <p className="muted" style={{ marginBottom: 8 }}>{dateOf(ride.start)}{ride.roadbookName ? ` · ${ride.roadbookName}` : ride.kind === 'libre' ? ' · Sortie libre' : ''}</p>

      {s && <SummaryList s={s} />}
      {s && planned != null && (
        <dl className="sumlist">
          <div><dt>Arrivée prévue</dt><dd>{fdur(planned)}</dd></div>
          <div><dt>Arrivée réelle</dt><dd>{fdur(s.total)}</dd></div>
          <div><dt>Arrêts réels</dt><dd>{fdur(Math.max(0, s.total - s.moving))}</dd></div>
        </dl>
      )}

      <h2 className="h2">Profil</h2>
      <RideChart series={a.series} unit={unit} />

      {a.rows.length > 0 && (
        <>
          <h2 className="h2">Road book réalisé</h2>
          <ul className="list">
            {a.rows.map(r => {
              const delta = r.actual != null && r.planned != null ? r.actual - r.planned : null
              return (
                <li key={r.id}><div className="item" style={{ cursor: 'default' }}>
                  <span className="km">km {nf1(r.km)}</span>
                  <span className="t">{r.label || 'Repère'}<small>{r.actual == null ? 'Non atteint' : `${clock(r.actual)}${r.planned != null ? ` · prévu ${clock(r.planned)}` : ''}${r.stopS ? ` · arrêt ${fdur(r.stopS)}` : ''}`}</small></span>
                  {delta != null && <b className={Math.abs(delta) < 300 ? 'ok' : Math.abs(delta) < 900 ? 'wa' : 'ko'}>{Math.abs(delta) < 60 ? '0' : sgn(delta)}</b>}
                </div></li>
              )
            })}
          </ul>
        </>
      )}

      <details className="fold">
        <summary>Zones</summary>
        <div>
          {zdefs.map((z, i) => (
            <div className="zbar" key={z.n}>
              <span className="zn">{z.n}</span>
              <span className="zb">
                {a.zones.plan && <i className="plan" style={{ width: `${(a.zones.plan[i] / zmax) * 100}%`, borderColor: z.c }} />}
                <i className="real" style={{ width: `${(a.zones.real[i] / zmax) * 100}%`, background: z.c }} />
              </span>
              <span className="zt">{fdur(a.zones.real[i])}{a.zones.plan ? ` / ${fdur(a.zones.plan[i])}` : ''}</span>
            </div>
          ))}
          {a.zones.plan && <p className="muted" style={{ fontSize: 14 }}>Réel / prévu</p>}
        </div>
      </details>

      <details className="fold">
        <summary>Chiffres</summary>
        <div>
          {s && (
            <dl className="sumlist">
              {s.np != null && <div><dt>Puissance normalisée</dt><dd>{nf0(s.np)} W</dd></div>}
              {s.avgP != null && <div><dt>Puissance moyenne</dt><dd>{nf0(s.avgP)} W</dd></div>}
              {s.avgHr != null && <div><dt>FC moyenne</dt><dd>{nf0(s.avgHr)} bpm</dd></div>}
              {a.cad != null && <div><dt>Cadence</dt><dd>{nf0(a.cad)} rpm</dd></div>}
              {s.kcal != null && <div><dt>Énergie</dt><dd>{nf0(s.kcal)} kcal</dd></div>}
              {a.drift != null && <div><dt>Dérive cardiaque</dt><dd>{a.drift >= 0 ? '+' : '−'}{nf1(Math.abs(a.drift))} %</dd></div>}
              {s.remindersTotal > 0 && <div><dt>Rappels tenus</dt><dd>{Math.min(s.remindersDone, s.remindersTotal)} sur {s.remindersTotal}</dd></div>}
            </dl>
          )}
        </div>
      </details>

      {menu && (
        <Sheet title={menu === 'delete' ? 'Supprimer la sortie ?' : 'Sortie'} onClose={() => setMenu(null)}>
          {menu === 'rename' ? (
            <>
              <label className="field"><span>Nom</span><input value={name} onChange={e => setName(e.target.value)} /></label>
              <div className="stack" style={{ marginTop: 12 }}>
                <button className="btn primary" disabled={!name.trim()} onClick={() => void rename()}>Renommer</button>
                <button className="btn" onClick={() => void exportGpx()}>Exporter (GPX)</button>
                <button className="btn danger" onClick={() => setMenu('delete')}>Supprimer</button>
              </div>
            </>
          ) : (
            <div className="stack">
              <p className="muted">Les mesures seront perdues.</p>
              <button className="btn danger" onClick={() => void remove()}>Supprimer</button>
              <button className="btn" onClick={() => setMenu(null)}>Annuler</button>
            </div>
          )}
        </Sheet>
      )}
    </>
  )
}
