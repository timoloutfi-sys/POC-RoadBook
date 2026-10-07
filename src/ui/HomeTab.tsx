import { useEffect, useRef, useState } from 'react'
import { fdur, hhmm, nf0, nf1 } from '../core/format'
import { conformity } from '../library/analysis'
import { countdown, goalOf, nextOutingOf, rideTarget } from '../library/goal'
import { getLibrary, useLibrary } from '../library/session'
import type { Ride, RoadBookMeta } from '../library/types'
import { ride, type RideSource } from '../ride/controller'
import { parseGPX } from '../route/gpx'
import { buildRoute } from '../route/route'
import { bluetoothAvailable, bluetoothOn } from '../sensors/ble'
import { useStore } from '../storage/store'
import { FixGoalSheet, NewCourse } from './GoalFlow'
import { Icon } from './icons'
import { KINDS, ICON, LABEL, statusOf } from './SensorsBlock'
import { Sheet } from './Sheet'
import { toast } from './toast'

const dayLabel = (when: string, now: Date) => {
  const cd = countdown(when, now), d = new Date(when)
  const date = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  return cd === 'Demain' || cd === "Aujourd'hui" ? `${cd} · ${hhmm(d)}` : date
}

function Spark({ v }: { v: number[] }) {
  if (v.length < 2) return null
  const d = v.map((y, i) => `${i ? 'L' : 'M'}${(i / (v.length - 1)) * 100} ${100 - y * 0.8 - 10}`).join('')
  return <svg className="rb-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden><path d={`${d}L100 100L0 100Z`} /></svg>
}

/** Accueil : la prochaine chose à faire, le bouton Rouler, l'état des capteurs, la dernière sortie. */
export function HomeTab({ go, onStart, onRide, onPrep }: { go: (tab: string) => void; onStart: (src: RideSource) => void; onRide: (m: RoadBookMeta | null) => void; onPrep: () => void }) {
  const { list, current, unfinished, open, setSub, setRideToOpen, create } = useLibrary()
  const { goalId, libre, set } = useStore()
  const now = new Date()
  const [last, setLast] = useState<Ride | null>(null)
  const [choose, setChoose] = useState(false)
  const [fix, setFix] = useState(false)
  const [course, setCourse] = useState(false)
  const [, bump] = useState(0)
  const [btOn, setBtOn] = useState<boolean | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const sensors = useStore(s => s.sensors)

  useEffect(() => { void getLibrary()?.listRides().then(r => setLast(r.find(x => x.end && x.kind !== 'simu') ?? null)) }, [unfinished, list])
  useEffect(() => { const id = setInterval(() => bump(n => n + 1), 1000); return () => clearInterval(id) }, [])
  useEffect(() => { void bluetoothOn().then(setBtOn) }, [])

  const goal = goalOf(list, goalId, now), next = nextOutingOf(list, now)
  const target = rideTarget(list, libre ? null : current?.id ?? null, now)
  const resume = ride.hasRide && ride.src === 'live'

  const openRb = async (id: string, sub: 'parcours' | 'reglages' = 'parcours') => { await open(id); setSub(sub); go('roadbooks') }
  // Une sortie en cours se reprend tout de suite ; sinon on passe par « Avant de partir ».
  const rollWith = (m: RoadBookMeta | null) => { if (resume) onStart('live'); else onRide(m) }
  const importGpx = async (f: File | undefined) => {
    if (!f) return
    try { const g = parseGPX(await f.text()); await create(g.name || f.name.replace(/\.gpx$/i, ''), { route: buildRoute(g.name, g.pts) }); go('roadbooks') } catch (e) { toast(e instanceof Error ? e.message : 'Import impossible.') }
  }

  // Premier lancement : rien encore dans la bibliothèque.
  if (!list.length && !unfinished) return (
    <>
      <h2 style={{ fontSize: 26, lineHeight: 1.15, margin: '8px 0 4px' }}>Prépare ta prochaine sortie</h2>
      <p className="muted" style={{ marginBottom: 8 }}>Trois étapes, puis l’écran se fixe au cintre.</p>
      <div className="step done"><i>1</i><div className="grow"><b>Ton profil</b><div className="muted">Poids, FTP, cardio seuil</div></div></div>
      <div className="step"><i>2</i><div className="grow"><b>Ton parcours</b><div className="muted" style={{ marginBottom: 8 }}>Le GPX de Komoot, Strava ou Ride with GPS, ou une course dont le GPX n’est pas publié.</div>
        <div className="stack"><button className="btn" onClick={() => file.current?.click()}><Icon name="upload" size={20} />Importer un GPX</button><button className="btn" onClick={() => setCourse(true)}><Icon name="flag" size={20} />Nouvelle course sans GPX</button></div></div></div>
      <div className="step"><i>3</i><div className="grow"><b>Tes capteurs</b><div className="muted" style={{ marginBottom: 8 }}>Cardio, puissance, cadence en Bluetooth.</div><button className="btn" onClick={() => onPrep()}>Connecter</button></div></div>
      <div className="stack" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => void create('Boucle démo', { demo: true }).then(() => go('roadbooks'))}>Essayer la boucle démo</button>
        <button className="btn ghost" onClick={() => onRide(null)}>ou sortie libre tout de suite</button>
      </div>
      <input ref={file} type="file" accept=".gpx,application/gpx+xml" hidden onChange={e => { void importGpx(e.target.files?.[0]); e.target.value = '' }} />
      {course && <NewCourse onClose={() => setCourse(false)} onDone={() => { setCourse(false) }} />}
    </>
  )

  const bt = bluetoothAvailable()
  const saved = KINDS.filter(k => sensors[k])
  const missing = bt && btOn === false ? 'Bluetooth éteint' : !saved.length ? 'aucun capteur enregistré' : (() => { const m = saved.filter(k => statusOf(k) !== 'on'); return m.length ? `${LABEL[m[0]].toLowerCase()} absente` : 'tout est connecté' })()

  const headCard = () => {
    if (next) {
      return (
        <>
          {goal && goal.id !== next.id && goal.when && <div className="goal-line"><Icon name="flag" size={18} /><span className="grow"><b>{goal.name}</b> <span className="muted">· {new Date(goal.when).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></span><b className="cd">{countdown(goal.when, now)}</b></div>}
          <button className="hcard" onClick={() => void openRb(next.id)}>
            <div className="hc-top">
              <div className="row"><span className="pill tag blue">PROCHAINE SORTIE</span><span className="grow" /><span><b>{dayLabel(next.when!, now).split(' · ')[0]}</b>{dayLabel(next.when!, now).includes('·') ? <span className="muted"> · {dayLabel(next.when!, now).split(' · ')[1]}</span> : <span className="muted"> · {hhmm(new Date(next.when!))}</span>}</span></div>
              <div className="hc-title">{next.name}</div>
              <div className="muted" style={{ fontSize: 14 }}>{nf0(next.km)} km · {nf0(next.dplus)} m D+{next.kind === 'sortie' ? ' · sortie' : ' · course'}</div>
            </div>
            <Spark v={next.prof} />
            <div className="facts"><div><b>{next.estH ? `~${fdur(next.estH * 3600)}` : '–'}</b><span>roulage</span></div><div><b>{hhmm(new Date(next.when!))}</b><span>départ</span></div><div><b>{next.stops ?? 0}</b><span>arrêts prévus</span></div></div>
          </button>
        </>
      )
    }
    if (goal && goal.when) {
      return (
        <div className="hcard">
          <button className="hc-top" style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => void openRb(goal.id)}>
            <div className="row"><span className="pill tag">OBJECTIF</span><span className="grow" /><span className="muted" style={{ fontSize: 14 }}>{new Date(goal.when).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
            <div className="hc-row"><div className="grow"><div className="hc-title">{goal.name}</div><div className="muted" style={{ fontSize: 14 }}>{nf0(goal.km)} km · {nf0(goal.dplus)} m D+{goal.estH ? ` · ~${fdur(goal.estH * 3600)}${goal.hasRoute ? '' : ' (estimé)'}` : ''}</div></div><div className="hc-cd">{countdown(goal.when, now)}</div></div>
          </button>
          {goal.hasRoute ? <Spark v={goal.prof} /> : (
            <div className="nogpx"><Icon name="upload" size={22} /><div className="grow"><b>Parcours pas encore publié</b><div className="muted">Ajoute le GPX pour les cibles, les points et les heures.</div></div><button className="btn" style={{ minHeight: 40, padding: '0 12px' }} onClick={() => void openRb(goal.id)}>Ajouter</button></div>
          )}
        </div>
      )
    }
    return (
      <div className="dashbox"><div className="row"><Icon name="flag" size={22} /><b className="grow">Pas encore d’objectif</b></div>
        <span className="muted" style={{ fontSize: 14 }}>Donne une date à une course : l’accueil affichera le compte à rebours.</span>
        <button className="btn" onClick={() => setFix(true)}><Icon name="plus" size={20} />Fixer un objectif</button></div>
    )
  }

  return (
    <>
      {headCard()}

      {unfinished && (
        <div className="notice" role="status">
          <b>Sortie interrompue</b>
          <p style={{ margin: '4px 0 8px' }}>{unfinished.name}</p>
          <div className="row">
            <button className="btn primary" onClick={async () => {
              if (unfinished.roadbookId) await open(unfinished.roadbookId, false)
              set({ libre: !unfinished.roadbookId })
              await ride.restore(unfinished); onStart('live')
            }}>Reprendre</button>
            <button className="btn" onClick={async () => { const { finalize } = await import('../ride/recorder'); await finalize(unfinished); toast('Sortie enregistrée.') }}>Terminer</button>
          </div>
        </div>
      )}

      <button className="btn primary big" style={{ width: '100%' }} onClick={() => void rollWith(target)}><Icon name="ride" size={22} />{resume ? 'Reprendre la sortie' : `Rouler · ${target?.name ?? 'sortie libre'}`}</button>
      {!resume && (
        <div className="row" style={{ marginTop: 8 }}>
          {list.length > 0 && <button className="btn grow" onClick={() => setChoose(true)}>Autre road book</button>}
          {target && <button className="btn grow" onClick={() => void rollWith(null)}>Sortie libre</button>}
        </div>
      )}
      {target && !target.hasRoute && <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>Sans GPX : sortie libre avec les cibles de ce road book.</p>}

      <button className="ready" onClick={() => onPrep()} aria-label="Avant de partir">
        <span className="muted">Prêt à partir</span>
        <span className="sicons">{KINDS.map(k => <span key={k} className={`st-${statusOf(k)}`} title={LABEL[k]}><Icon name={ICON[k]} size={22} /></span>)}<span className="st-on"><Icon name="gps" size={22} /></span></span>
        <span className="muted warn">{missing}</span>
      </button>

      {last?.summary && (
        <>
          <h2 className="h2">Dernière sortie</h2>
          <button className="hcard" style={{ padding: 12 }} onClick={() => { setRideToOpen(last.id); go('sorties') }}>
            <div className="row"><span className={`dot ${conformity(last.summary) ?? ''}`} /><b className="grow">{last.name.split(' · ')[0]}</b><span className="muted" style={{ fontSize: 14 }}>{new Date(last.start).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
            <div className="facts" style={{ padding: '8px 0 0' }}>
              <div><b>{nf1(last.summary.km)} km</b><span>{fdur(last.summary.moving)} roulage</span></div>
              <div><b>{last.summary.deltaArrival == null ? '–' : Math.abs(last.summary.deltaArrival) < 60 ? '0 min' : `${last.summary.deltaArrival > 0 ? '+' : '−'}${Math.round(Math.abs(last.summary.deltaArrival) / 60)} min`}</b><span>écart au plan</span></div>
              <div><b>{last.summary.inTarget == null ? '–' : `${nf0(last.summary.inTarget)} %`}</b><span>dans la cible</span></div>
            </div>
          </button>
        </>
      )}

      <h2 className="h2">Road books</h2>
      <ul className="list">
        {list.slice(0, 3).map(m => (
          <li key={m.id}><button className="item" onClick={() => void openRb(m.id)}>
            <span className="t">{m.kind === 'course' ? '🏁 ' : ''}{m.name}<small>{m.hasRoute ? `${nf1(m.km)} km · ${nf0(m.dplus)} m${m.estH ? ` · ${fdur(m.estH * 3600)}` : ''}` : `${m.when ? new Date(m.when).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' : ''}GPX à venir`}</small></span><Icon name="chevron" size={18} />
          </button></li>
        ))}
      </ul>
      {list.length > 3 && <button className="btn ghost" style={{ width: '100%' }} onClick={() => go('roadbooks')}>Tout voir ({list.length})</button>}

      {choose && (
        <Sheet title="Rouler avec" onClose={() => setChoose(false)}>
          <ul className="list">
            {list.map(m => (
              <li key={m.id}><button className="item" onClick={() => { setChoose(false); void rollWith(m) }}>
                <span className="t">{m.name}<small>{m.hasRoute ? `${nf1(m.km)} km` : 'GPX à venir : sortie libre avec ses cibles'}</small></span>
              </button></li>
            ))}
            <li><button className="item" onClick={() => { setChoose(false); void rollWith(null) }}><span className="t">Sortie libre<small>Sans parcours ni plan</small></span></button></li>
          </ul>
        </Sheet>
      )}
      {fix && <FixGoalSheet onClose={() => setFix(false)} onNew={() => { setFix(false); setCourse(true) }} onPick={id => { setFix(false); void openRb(id, 'reglages') }} />}
      {course && <NewCourse onClose={() => setCourse(false)} onDone={() => setCourse(false)} />}
    </>
  )
}
