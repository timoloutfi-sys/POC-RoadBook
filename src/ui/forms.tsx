import { useState } from 'react'
import { clamp, nf1 } from '../core/format'
import { METRICS, PRIO_LABEL, type AlertRule, type Metric } from '../alerts/types'
import { POINT_TYPES, type Prio, type PointType, type RoutePoint, type Section } from '../strategy/types'
import { pctToValue, unitLabel, valueToPct } from '../strategy/units'
import { HR_ZONES, POWER_ZONES, zoneBandPct, type Unit } from '../strategy/zones'
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

export function PointForm({ initial, isNew, onSave, onDelete, onClose, maxKm }: FormProps<RoutePoint> & { maxKm: number }) {
  const [p, setP] = useState(initial)
  const km = clamp(p.km, 0, maxKm)
  return (
    <form noValidate onSubmit={e => { e.preventDefault(); onSave({ ...p, km: +km.toFixed(1), text: p.text.trim() }) }}>
      <Field label="Type">
        <select value={p.type} onChange={e => setP({ ...p, type: e.target.value as PointType })}>
          {Object.entries(POINT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
        </select>
      </Field>
      <div className="cols2">
        <Field label="Kilomètre"><Num value={p.km} min={0} max={maxKm} step={1} onChange={v => setP({ ...p, km: v ?? 0 })} /></Field>
        <Field label="Annoncer (km avant)"><Num value={p.avant} min={0} step={1} onChange={v => setP({ ...p, avant: v ?? 0 })} /></Field>
      </div>
      <Field label="Message affiché" hint="Un danger s'affiche en alerte critique, une eau ou un ravito en action, une note en info.">
        <input value={p.text} maxLength={80} placeholder="Ex. station 24 h/24, remplir les 2 bidons" onChange={e => setP({ ...p, text: e.target.value })} />
      </Field>
      <Actions isNew={isNew} onDelete={onDelete} onClose={onClose} />
    </form>
  )
}

export function SectionForm({ initial, isNew, onSave, onDelete, onClose, maxKm, unit, ftp, lthr }: FormProps<Section> & { maxKm: number; unit: Unit; ftp: number; lthr: number | null }) {
  const [s, setS] = useState(initial)
  const zones = unit === 'power' ? POWER_ZONES : HR_ZONES
  const [zone, setZone] = useState<string>(() => {
    const k = zones.findIndex((_, i) => { const [lo, hi] = zoneBandPct(i, unit); return lo === initial.min && hi === initial.max })
    return k >= 0 ? String(k) : 'perso'
  })
  const u = unitLabel(unit), noBpm = unit === 'hr' && !lthr
  const a = clamp(Math.min(s.a, s.b), 0, maxKm), b = clamp(Math.max(s.a, s.b), 0, maxKm)
  const mn = Math.min(s.min, s.max), mx = Math.max(s.min, s.max)
  const pick = (z: string) => {
    setZone(z)
    if (z !== 'perso') { const [lo, hi] = zoneBandPct(+z, unit); setS({ ...s, min: lo, max: hi }) }
  }
  const setVal = (key: 'min' | 'max', v: number | null) => {
    setZone('perso')
    const pct = v == null ? null : valueToPct(v, unit, ftp, lthr)
    if (pct != null) setS({ ...s, [key]: pct })
  }
  const W = [pctToValue(mn, 'power', ftp, lthr), pctToValue(mx, 'power', ftp, lthr)], B = [pctToValue(mn, 'hr', ftp, lthr), pctToValue(mx, 'hr', ftp, lthr)]
  return (
    <form noValidate onSubmit={e => { e.preventDefault(); onSave({ ...s, a, b, min: mn, max: mx, auto: false, gen: false, name: s.name.trim() || (s.kind === 'montee' ? 'Montée' : 'Tronçon') }) }}>
      <Field label="Nom"><input value={s.name} maxLength={60} placeholder="Ex. vallée exposée au vent" onChange={e => setS({ ...s, name: e.target.value })} /></Field>
      <div className="cols2">
        <Field label="Type">
          <select value={s.kind} onChange={e => setS({ ...s, kind: e.target.value as Section['kind'] })}><option value="zone">Tronçon</option><option value="montee">Montée</option></select>
        </Field>
        <Field label="Annoncer (km avant)"><Num value={s.avant} min={0} step={1} onChange={v => setS({ ...s, avant: v ?? 0 })} /></Field>
        <Field label="Du km"><Num value={s.a} min={0} max={maxKm} step={1} onChange={v => setS({ ...s, a: v ?? 0 })} /></Field>
        <Field label="Au km"><Num value={s.b} min={0} max={maxKm} step={1} onChange={v => setS({ ...s, b: v ?? 0 })} /></Field>
      </div>
      <Field label="Cible" hint={unit === 'hr' ? 'Une zone suffit : pas besoin de chiffres.' : 'Choisis une zone, ou règle la fourchette toi-même.'}>
        <select value={zone} onChange={e => pick(e.target.value)}>
          <option value="perso">Personnalisée</option>
          {zones.map((z, i) => <option key={z.n} value={i}>{z.n} · {z.l}</option>)}
        </select>
      </Field>
      {noBpm ? (
        <p className="notice" style={{ marginBottom: 12 }}>Renseigne ta FC seuil dans les réglages pour voir et saisir les bpm. Le choix par zone fonctionne déjà.</p>
      ) : (
        <div className="cols2">
          <Field label={`Cible min (${u})`}><Num value={pctToValue(mn, unit, ftp, lthr)} step={unit === 'hr' ? 1 : 5} onChange={v => setVal('min', v)} /></Field>
          <Field label={`Cible max (${u})`}><Num value={pctToValue(mx, unit, ftp, lthr)} step={unit === 'hr' ? 1 : 5} onChange={v => setVal('max', v)} /></Field>
        </div>
      )}
      <p className="muted" style={{ marginBottom: 12 }}>
        Remplace les règles de base sur {nf1(b - a)} km : {W[0]}–{W[1]} W{B[0] != null ? ` · ${B[0]}–${B[1]} bpm` : ''}.
      </p>
      <Field label="Consigne à l'annonce"><input value={s.msg} maxLength={80} placeholder="Ex. mange maintenant, reste assis" onChange={e => setS({ ...s, msg: e.target.value })} /></Field>
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
      <Field label="Nom"><input value={a.name} maxLength={40} onChange={e => setA({ ...a, name: e.target.value })} /></Field>
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
      <Field label="Alors afficher" hint="{min} et {max} donnent la cible du moment, {val} la valeur mesurée.">
        <input value={a.msg} maxLength={70} onChange={e => setA({ ...a, msg: e.target.value })} />
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
