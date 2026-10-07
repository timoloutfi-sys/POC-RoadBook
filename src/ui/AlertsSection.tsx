import { useState } from 'react'
import { uid } from '../core/format'
import { PRIO_LABEL, type AlertRule, type Periodic } from '../alerts/types'
import { useStore } from '../storage/store'
import { AlertForm, alertSentence } from './forms'
import { Num } from './fields'
import { Sheet } from './Sheet'

export const blankAlert = (): AlertRule => ({ id: uid(), on: true, name: '', metric: 'effort', op: '>', ref: 'max', val: 0, dur: 20, cool: 5, prio: 'action', msg: '' })
export const blankReminder = (): Periodic => ({ id: uid(), on: true, every: 30, msg: '', prio: 'info' })

/** Alertes de seuil et rappels périodiques, dans une section dépliable. */
export function AlertsSection() {
  const { alerts, periodic, set } = useStore()
  const [edit, setEdit] = useState<{ a: AlertRule; isNew: boolean } | null>(null)
  const save = (a: AlertRule) => {
    set({ alerts: edit?.isNew ? [...alerts, a] : alerts.map(x => (x.id === a.id ? a : x)) })
    setEdit(null)
  }
  return (
    <details className="fold">
      <summary>Alertes et rappels</summary>
      <div>
        <ul className="list">
          {alerts.map(a => (
            <li key={a.id}>
              <div className="item" style={{ cursor: 'default' }}>
                <input type="checkbox" style={{ width: 24, height: 24 }} checked={a.on} aria-label={`Activer ${a.name}`} onChange={e => set({ alerts: alerts.map(x => (x.id === a.id ? { ...x, on: e.target.checked } : x)) })} />
                <button className="item grow" style={{ padding: 0 }} onClick={() => setEdit({ a, isNew: false })}>
                  <span className="t">{a.name}<small>{alertSentence(a)}</small></span><span className={`pill ${a.prio}`}>{PRIO_LABEL[a.prio]}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button className="btn" style={{ marginTop: 8 }} onClick={() => setEdit({ a: blankAlert(), isNew: true })}>Nouvelle alerte</button>

        <h3 className="h2">Rappels</h3>
        {periodic.map(p => (
          <div key={p.id} style={{ marginBottom: 12 }}>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input type="checkbox" style={{ width: 24, height: 24 }} checked={p.on} aria-label="Activer le rappel" onChange={e => set({ periodic: periodic.map(x => (x.id === p.id ? { ...x, on: e.target.checked } : x)) })} />
              <span className="muted">toutes les</span>
              <div style={{ width: 72 }} className="field"><Num value={p.every} min={1} onChange={v => set({ periodic: periodic.map(x => (x.id === p.id ? { ...x, every: Math.max(1, v ?? 1) } : x)) })} /></div>
              <span className="muted grow">min</span>
              <button className="iconbtn" aria-label="Supprimer le rappel" onClick={() => set({ periodic: periodic.filter(x => x.id !== p.id) })}>×</button>
            </div>
            <div className="field" style={{ marginTop: 6 }}><input value={p.msg} maxLength={60} placeholder="Message du rappel" aria-label="Message du rappel" onChange={e => set({ periodic: periodic.map(x => (x.id === p.id ? { ...x, msg: e.target.value } : x)) })} /></div>
          </div>
        ))}
        <button className="btn" onClick={() => set({ periodic: [...periodic, blankReminder()] })}>Nouveau rappel</button>
      </div>
      {edit && (
        <Sheet title={edit.isNew ? 'Nouvelle alerte' : "Modifier l'alerte"} onClose={() => setEdit(null)}>
          <AlertForm initial={edit.a} isNew={edit.isNew} onSave={save} onClose={() => setEdit(null)} onDelete={() => { set({ alerts: alerts.filter(x => x.id !== edit.a.id) }); setEdit(null) }} />
        </Sheet>
      )}
    </details>
  )
}
