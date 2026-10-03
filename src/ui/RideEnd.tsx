import { useState } from 'react'
import { fdur, nf0, nf1 } from '../core/format'
import type { Ride, RideSummary } from '../library/types'
import { Sheet } from './Sheet'

const gap = (s: number) => `${s >= 0 ? '+' : '−'}${fdur(Math.abs(s))}`

export function SummaryList({ s }: { s: RideSummary }) {
  const rows: [string, string, string?][] = [
    ['Distance', `${nf1(s.km)} km`], ['Roulage', fdur(s.moving)], ['Temps total', fdur(s.total)], ['D+', `${nf0(s.dplus)} m`],
  ]
  if (s.avgP != null) rows.push(['Puissance moy.', `${nf0(s.avgP)} W`], ['Puissance norm.', `${nf0(s.np ?? 0)} W`])
  if (s.avgHr != null) rows.push(['FC moy.', `${nf0(s.avgHr)} bpm`])
  if (s.inTarget != null) rows.push(['Dans la cible', `${nf0(s.inTarget)} %`, s.inTarget >= 70 ? 'ok' : s.inTarget >= 50 ? 'wa' : 'ko'])
  if (s.deltaArrival != null) rows.push(['Écart au plan', Math.abs(s.deltaArrival) < 60 ? 'dans les temps' : gap(s.deltaArrival), Math.abs(s.deltaArrival) < 300 ? 'ok' : Math.abs(s.deltaArrival) < 900 ? 'wa' : 'ko'])
  if (s.remindersTotal) rows.push(['Rappels tenus', `${Math.min(s.remindersDone, s.remindersTotal)} sur ${s.remindersTotal}`])
  return (
    <dl className="sumlist">
      {rows.map(([k, v, t]) => <div key={k}><dt>{k}</dt><dd className={t}>{v}</dd></div>)}
    </dl>
  )
}

/** Écran de fin de sortie : les chiffres, puis enregistrer, reprendre ou supprimer. */
export function RideEnd({ ride, summary, onSave, onResume, onDelete }: {
  ride: Ride; summary: RideSummary; onSave: (name: string) => void; onResume: () => void; onDelete: () => void
}) {
  const [name, setName] = useState(ride.name)
  const [sure, setSure] = useState(false)
  return (
    <Sheet title="Sortie terminée" onClose={onResume}>
      <SummaryList s={summary} />
      <label className="field"><span>Nom</span><input value={name} onChange={e => setName(e.target.value)} /></label>
      <div className="stack" style={{ marginTop: 12 }}>
        <button className="btn primary big" disabled={!name.trim()} onClick={() => onSave(name)}>Enregistrer</button>
        <button className="btn" onClick={onResume}>Reprendre</button>
        {sure
          ? <button className="btn danger" onClick={onDelete}>Confirmer la suppression</button>
          : <button className="btn danger" onClick={() => setSure(true)}>Supprimer</button>}
      </div>
    </Sheet>
  )
}
