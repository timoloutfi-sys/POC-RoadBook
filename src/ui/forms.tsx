import { useState } from 'react'
import { clamp, nf0, nf1, slope } from '../core/format'
import { sectionStats, type Route } from '../route/route'
import { METRICS, PRIO_LABEL, type AlertRule, type Metric } from '../alerts/types'
import { POINT_TYPES, type Prio, type PointType, type RoutePoint, type Section } from '../strategy/types'
import type { Unit } from '../strategy/zones'
import { KmRange } from './KmRange'
import { TargetPicker } from './TargetPicker'
import { Field, Num } from './fields'

interface FormProps<T> { initial: T; isNew: boolean; onSave: (v: T) => void; onDelete?: () => void; onClose: () => void }

function Actions({ isNew, onDelete, onClose, valid = true }: { isNew: boolean; onDelete?: () => void; onClose: () => void; valid?: boolean }) {
  return (
    <div className="row" style={{ marginTop: 8 }}>
      <button className="btn primary grow" type="submit" disabled={!valid}>Enregistrer</button>
      <button className="btn" type="button" onClick={onClose}>Annuler</button>
      {!isNew && onDelete && <button className="btn danger" type="button" onClick={onDelete}>Supprimer</button>}
    </div>
  )
}

export function PointForm({ initial, isNew, onSave, onDelete, onClose, maxKm, route }: FormProps<RoutePoint> & { maxKm: number; route: Route }) {
  const [p, setP] = useState(initial)
  const km = clamp(p.km, 0, maxKm)
  return (
    <form noValidate onSubmit={e => { e.preventDefault(); onSave({ ...p, km: +km.toFixed(1), text: p.text.trim() }) }}>
      <Field label="Type">
        <select value={p.type} onChange={e => setP({ ...p, type: e.target.value as PointType })}>
          {Object.entries(POINT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
        </select>
      </Field>
      <KmRange route={route} a={p.km} b={p.km} point onChange={km => setP({ ...p, km })} />
      <div className="cols2">
        <Field label="Annoncer (km avant)"><Num value={p.avant} min={0} step={1} onChange={v => setP({ ...p, avant: v ?? 0 })} /></Field>
      </div>
      <Field label="Message affiché">
        <input value={p.text} maxLength={80} placeholder="Ex. station 24 h/24, remplir les 2 bidons" onChange={e => setP({ ...p, text: e.target.value })} />
      </Field>
      <Field label="Arrêt prévu (min)" hint="Décale les heures d'arrivée suivantes">
        <Num value={p.stop ?? null} min={0} step={5} placeholder="Aucun" onChange={v => setP({ ...p, stop: v ? Math.round(v) : undefined })} />
      </Field>
      <Actions isNew={isNew} onDelete={onDelete} onClose={onClose} />
    </form>
  )
}

/** Repère : nomme un tronçon et l'annonce, sans cible (les cibles se règlent dans le Plan). */
export function MarkForm({ initial, isNew, onSave, onDelete, onClose, maxKm, route }: FormProps<Section> & { maxKm: number; route: Route }) {
  const [s, setS] = useState(initial)
  const a = clamp(Math.min(s.a, s.b), 0, maxKm), b = clamp(Math.max(s.a, s.b), 0, maxKm)
  return (
    <form noValidate onSubmit={e => { e.preventDefault(); onSave({ ...s, a, b, mark: true, auto: false, gen: false, name: s.name.trim() || 'Repère' }) }}>
      <Field label="Nom"><input value={s.name} maxLength={60} placeholder="Ex. plaine au vent" onChange={e => setS({ ...s, name: e.target.value })} /></Field>
      <KmRange route={route} a={s.a} b={s.b} onChange={(a, b, c) => setS({ ...s, a, b, ...(c && !s.name.trim() ? { name: c.name } : {}) })} />
      <p className="muted" style={{ marginBottom: 12 }}>{statsLine(sectionStats(route, a, b))}</p>
      <div className="cols2">
        <Field label="Annoncer (km avant)"><Num value={s.avant} min={0} step={1} onChange={v => setS({ ...s, avant: v ?? 0 })} /></Field>
        <Field label="Consigne à l'annonce"><input value={s.msg} maxLength={80} placeholder="Ex. reste aéro" onChange={e => setS({ ...s, msg: e.target.value })} /></Field>
      </div>
      <Actions isNew={isNew} onDelete={onDelete} onClose={onClose} />
    </form>
  )
}

/** Segment (cible imposée) : telle zone ou telle fourchette entre deux km, gardée telle quelle par le plan. */
export function ImposedForm({ initial, isNew, onSave, onDelete, onClose, maxKm, route, unit, ftp, lthr }: FormProps<Section> & { maxKm: number; route: Route; unit: Unit; ftp: number; lthr: number | null }) {
  const [s, setS] = useState(initial)
  const a = clamp(Math.min(s.a, s.b), 0, maxKm), b = clamp(Math.max(s.a, s.b), 0, maxKm)
  return (
    <form noValidate onSubmit={e => { e.preventDefault(); onSave({ ...s, a, b, min: Math.min(s.min, s.max), max: Math.max(s.min, s.max), locked: true, gen: false, auto: false, mark: false, name: s.name.trim() || (s.urbanKmh ? 'Ville' : 'Segment'), urbanKmh: s.urbanKmh ? Math.min(40, Math.max(5, s.urbanKmh)) : undefined }) }}>
      <Field label="Nom"><input value={s.name} maxLength={60} placeholder="Ex. col au calme" onChange={e => setS({ ...s, name: e.target.value })} /></Field>
      <KmRange route={route} a={s.a} b={s.b} onChange={(a, b, c) => setS({ ...s, a, b, ...(c && !s.name.trim() ? { name: c.name } : {}) })} />
      <TargetPicker unit={unit} ftp={ftp} lthr={lthr} min={s.min} max={s.max} onChange={(min, max) => setS({ ...s, min, max })} />
      <label className="row" style={{ padding: '4px 0 8px', flexWrap: 'nowrap' }}>
        <span className="grow"><b>Ville</b><small style={{ display: 'block', color: 'var(--muted)' }}>Feux et carrefours : la vitesse moyenne est plafonnée</small></span>
        <input type="checkbox" role="switch" style={{ width: 28, height: 28 }} checked={!!s.urbanKmh} onChange={e => setS({ ...s, urbanKmh: e.target.checked ? 18 : undefined })} />
      </label>
      {!!s.urbanKmh && (
        <Field label="Vitesse moyenne (km/h)" hint="Paris intra-muros : 15 à 18 ; banlieue dense : 20 à 24">
          <Num value={s.urbanKmh} min={5} max={40} step={1} onChange={v => setS({ ...s, urbanKmh: Math.min(40, Math.max(5, v ?? 18)) })} />
        </Field>
      )}
      <Field label="Consigne à l'annonce"><input value={s.msg} maxLength={80} placeholder="Ex. reste assis" onChange={e => setS({ ...s, msg: e.target.value })} /></Field>
      <Actions isNew={isNew} onDelete={onDelete} onClose={onClose} />
    </form>
  )
}

export function AlertForm({ initial, isNew, onSave, onDelete, onClose }: FormProps<AlertRule>) {
  const [a, setA] = useState(initial)
  const hasBand = a.metric === 'effort' || a.metric === 'power' || a.metric === 'hr'
  const ref = hasBand ? a.ref : 'val'
  return (
    <form noValidate onSubmit={e => { e.preventDefault(); onSave({ ...a, ref, name: a.name.trim() || 'Alerte', msg: a.msg.trim() || 'Alerte' }) }}>
      <Field label="Nom"><input value={a.name} maxLength={40} placeholder="Ex. Trop fort en montée" onChange={e => setA({ ...a, name: e.target.value })} /></Field>
      <div className="cols2">
        <Field label="Quand">
          <select value={a.metric} onChange={e => setA({ ...a, metric: e.target.value as Metric })}>{Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select>
        </Field>
        <Field label="Est">
          <select value={a.op} onChange={e => setA({ ...a, op: e.target.value as '>' | '<' })}><option value=">">au-dessus de</option><option value="<">en dessous de</option></select>
        </Field>
        <Field label="Référence">
          <select value={ref} onChange={e => setA({ ...a, ref: e.target.value as AlertRule['ref'] })}>
            {hasBand && <><option value="max">Cible max</option><option value="min">Cible min</option></>}
            <option value="val">Valeur fixe</option>
          </select>
        </Field>
        <Field label="Valeur"><input type="number" disabled={ref !== 'val'} value={a.val} onChange={e => setA({ ...a, val: +e.target.value })} /></Field>
        <Field label="Pendant (s)"><Num value={a.dur} min={1} onChange={v => setA({ ...a, dur: Math.max(1, v ?? 1) })} /></Field>
        <Field label="Répéter au plus (min)"><Num value={a.cool} min={0} onChange={v => setA({ ...a, cool: Math.max(0, v ?? 0) })} /></Field>
      </div>
      <Field label="Priorité">
        <select value={a.prio} onChange={e => setA({ ...a, prio: e.target.value as Prio })}>{Object.entries(PRIO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </Field>
      <Field label="Alors afficher" hint="{min} {max} : cible · {val} : mesure">
        <input value={a.msg} maxLength={70} placeholder="Ex. Au-dessus de {max}" onChange={e => setA({ ...a, msg: e.target.value })} />
      </Field>
      <Actions isNew={isNew} onDelete={onDelete} onClose={onClose} />
    </form>
  )
}

export const alertSentence = (a: AlertRule) => {
  const m = a.metric === 'effort' ? "l'effort" : METRICS[a.metric].n
  const ref = a.ref === 'val' || !(a.metric === 'effort' || a.metric === 'power' || a.metric === 'hr') ? `${a.val} ${METRICS[a.metric].u}`.trim() : a.ref === 'max' ? 'la cible max' : 'la cible min'
  return `${a.op === '>' ? 'Au-dessus de' : 'En dessous de'} ${ref} (${m}) pendant ${a.dur} s`
}

/** « 2,1 km · +92 m · pente moy. +4,4 % · max +8,1 % » */
export const statsLine = (st: ReturnType<typeof sectionStats>) =>
  `${nf1(st.len)} km · +${nf0(st.dplus)} m · pente moy. ${slope(st.avg)}${st.max > Math.abs(st.avg) + 1 ? ` · max ${slope(st.max)}` : ''}`

