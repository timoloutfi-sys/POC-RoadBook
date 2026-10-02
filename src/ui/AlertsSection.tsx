import { useState } from 'react'
import { uid } from '../core/format'
import { PRIO_LABEL, type AlertRule } from '../alerts/types'
import { useStore } from '../storage/store'
import { AlertForm, alertSentence } from './forms'
import { Num } from './fields'
import { Sheet } from './Sheet'

const blank = (): AlertRule => ({ id: uid(), on: true, name: 'Nouvelle alerte', metric: 'effort', op: '>', ref: 'max', val: 0, dur: 20, cool: 5, prio: 'action', msg: 'Au-dessus de {max}' })

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
        <button className="btn" style={{ marginTop: 8 }} onClick={() => setEdit({ a: blank(), isNew: true })}>Nouvelle alerte</button>

        <h3 className="h2">Rappels</h3>
        {periodic.map(p => (
          <div className="row" key={p.id} style={{ marginBottom: 8, flexWrap: 'nowrap' }}>
            <input type="checkbox" style={{ width: 24, height: 24 }} checked={p.on} aria-label="Activer le rappel" onChange={e => set({ periodic: periodic.map(x => (x.id === p.id ? { ...x, on: e.target.checked } : x)) })} />
            <span className="muted">toutes les</span>
            <div style={{ width: 64 }} className="field"><Num value={p.every} min={1} onChange={v => set({ periodic: periodic.map(x => (x.id === p.id ? { ...x, every: Math.max(1, v ?? 1) } : x)) })} /></div>
            <span className="muted">min</span>
            <div className="field grow"><input value={p.msg} maxLength={60} aria-label="Message du rappel" onChange={e => set({ periodic: periodic.map(x => (x.id === p.id ? { ...x, msg: e.target.value } : x)) })} /></div>
            <button className="iconbtn" aria-label="Supprimer le rappel" onClick={() => set({ periodic: periodic.filter(x => x.id !== p.id) })}>×</button>
          </div>
        ))}
        <button className="btn" onClick={() => set({ periodic: [...periodic, { id: uid(), on: true, every: 30, msg: 'Sel : une pastille', prio: 'info' }] })}>Nouveau rappel</button>
      </div>
      {edit && (
        <Sheet title={edit.isNew ? 'Nouvelle alerte' : "Modifier l'alerte"} onClose={() => setEdit(null)}>
          <AlertForm initial={edit.a} isNew={edit.isNew} onSave={save} onClose={() => setEdit(null)} onDelete={() => { set({ alerts: alerts.filter(x => x.id !== edit.a.id) }); setEdit(null) }} />
        </Sheet>
      )}
    </details>
  )
}
