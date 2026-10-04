import { useState } from 'react'
import { PRIO_LABEL, type AlertRule, type Periodic } from '../alerts/types'
import { effectiveAlerts, effectivePeriodic, isOverridden, resetOverride, setOverride } from '../library/roadbooks'
import { useLibrary } from '../library/session'
import { useStore } from '../storage/store'
import { Field, Num } from './fields'
import { AlertForm, alertSentence } from './forms'
import { Sheet } from './Sheet'

const Mod = ({ on, reset }: { on: boolean; reset: () => void }) => on
  ? <span className="row mod"><span className="pill">modifié</span><button className="btn ghost" onClick={reset}>Rétablir</button></span>
  : null

/** Réglages propres à un road book : écran de départ, et écarts aux alertes et rappels par défaut. */
export function RoadBookSettings() {
  const { current, patch } = useLibrary()
  const { alerts, periodic, screens, goalId, set } = useStore()
  const [edit, setEdit] = useState<AlertRule | null>(null)
  if (!current) return null
  const o = current.overrides
  const ea = effectiveAlerts(alerts, o), ep = effectivePeriodic(periodic, o)
  const base = (id: string) => alerts.find(a => a.id === id)!
  const basep = (id: string) => periodic.find(p => p.id === id)!
  const upA = (a: AlertRule, patchA: Partial<AlertRule>) => patch({ overrides: setOverride(o, 'alerts', base(a.id), patchA) })
  const upP = (p: Periodic, patchP: Partial<Periodic>) => patch({ overrides: setOverride(o, 'periodic', basep(p.id), patchP) })

  const [date = '', time = '06:00'] = (current.when ?? '').split('T')
  const course = current.kind === 'course'
  const setWhen = (d: string, t: string) => void patch({ when: d ? `${d}T${t || '06:00'}` : undefined })

  return (
    <>
      <div className="card-block">
        <h2 className="h2" style={{ marginTop: 0 }}>Date et type</h2>
        <Field label="Type">
          <div className="seg" role="group" style={{ display: 'flex' }}>
            <button type="button" style={{ flex: 1 }} aria-pressed={!course} onClick={() => void patch({ kind: 'sortie' })}>Sortie</button>
            <button type="button" style={{ flex: 1 }} aria-pressed={course} onClick={() => void patch({ kind: 'course' })}>Course</button>
          </div>
        </Field>
        <div className="cols2">
          <Field label="Date"><input type="date" value={date} onChange={e => setWhen(e.target.value, time)} /></Field>
          <Field label="Départ"><input type="time" value={time} disabled={!date} onChange={e => setWhen(date, e.target.value)} /></Field>
        </div>
        {course && (
          <label className="row" style={{ padding: '4px 0', flexWrap: 'nowrap' }}>
            <span className="grow"><b>C’est mon objectif</b><small style={{ display: 'block', color: 'var(--muted)' }}>Compte à rebours sur l’accueil</small></span>
            <input type="checkbox" role="switch" style={{ width: 28, height: 28 }} checked={goalId === current.id} onChange={e => set({ goalId: e.target.checked ? current.id : null })} />
          </label>
        )}
        <p className="muted" style={{ fontSize: 14 }}>La date de départ sert aussi aux heures d’arrivée, à la nuit et au plan.</p>
      </div>

      <Field label="Écran de départ">
        <select value={current.startScreen ?? ''} onChange={e => void patch({ startScreen: e.target.value || undefined })}>
          <option value="">Par défaut</option>
          {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>

      <h2 className="h2">Alertes</h2>
      <ul className="list">
        {ea.map(a => (
          <li key={a.id}>
            <div className="item" style={{ cursor: 'default' }}>
              <input type="checkbox" style={{ width: 24, height: 24 }} checked={a.on} aria-label={`Activer ${a.name}`} onChange={e => void upA(a, { on: e.target.checked })} />
              <button className="item grow" style={{ padding: 0 }} onClick={() => setEdit(a)}>
                <span className="t">{a.name}<small>{alertSentence(a)}</small></span><span className={`pill ${a.prio}`}>{PRIO_LABEL[a.prio]}</span>
              </button>
            </div>
            <Mod on={isOverridden(o, 'alerts', a.id)} reset={() => void patch({ overrides: resetOverride(o, 'alerts', a.id) })} />
          </li>
        ))}
      </ul>

      <h2 className="h2">Rappels</h2>
      {ep.map(p => (
        <div key={p.id} style={{ marginBottom: 8 }}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input type="checkbox" style={{ width: 24, height: 24 }} checked={p.on} aria-label="Activer le rappel" onChange={e => void upP(p, { on: e.target.checked })} />
            <span className="muted">toutes les</span>
            <div style={{ width: 64 }} className="field"><Num value={p.every} min={1} onChange={v => void upP(p, { every: Math.max(1, v ?? 1) })} /></div>
            <span className="muted">min</span>
            <div className="field grow"><input value={p.msg} maxLength={60} aria-label="Message du rappel" onChange={e => void upP(p, { msg: e.target.value })} /></div>
          </div>
          <Mod on={isOverridden(o, 'periodic', p.id)} reset={() => void patch({ overrides: resetOverride(o, 'periodic', p.id) })} />
        </div>
      ))}
      <p className="muted" style={{ fontSize: 14 }}>Les valeurs non modifiées suivent les réglages par défaut de l’onglet Écrans.</p>

      {edit && (
        <Sheet title="Modifier l'alerte" onClose={() => setEdit(null)}>
          <AlertForm initial={edit} isNew={false} onClose={() => setEdit(null)} onSave={a => { void upA(a, a); setEdit(null) }} />
        </Sheet>
      )}
    </>
  )
}
