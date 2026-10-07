import { useState } from 'react'
import { fdur, hrs, nf0, nf1, uid } from '../core/format'
import { defaultPlanCfg, type PlanCfg, type ProgramRow } from '../strategy/plan'
import { effectiveFtp, effectiveLthr, effortUnit } from '../strategy/rider'
import { INTENTS, suggestPlan, suggestedMinutes, type Intent } from '../strategy/suggest'
import type { Section } from '../strategy/types'
import { pctToValue, unitLabel } from '../strategy/units'
import { HR_ZONES, POWER_ZONES, hrZoneOfPowerZone, powerZoneOf } from '../strategy/zones'
import { useStore } from '../storage/store'
import { Field, Num, Stepper } from './fields'
import { ImposedForm } from './forms'
import { Icon } from './icons'
import { Sheet } from './Sheet'
import { TargetPicker } from './TargetPicker'
import { ZoneProfile } from './ZoneProfile'
import { toast } from './toast'

/** « 13:04 » le jour du départ, « sam. 02:10 » sinon. */
const arrival = (d: Date, start: string) => {
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), s = new Date(start)
  return s.toDateString() === d.toDateString() ? hm : `${d.toLocaleDateString('fr-FR', { weekday: 'short' })} ${hm}`
}

type Editing = { v: Section; isNew: boolean }
const BLOCK_INTENTS: Intent[] = ['tempo', 'seuil', 'vo2max']

export function PlanTab() {
  const { route, rider, plan, planResult: res, set } = useStore()
  const [edit, setEdit] = useState<Editing | null>(null)
  const [suggest, setSuggest] = useState<{ intent: Intent | null; minutes: number } | null>(null)
  const [undo, setUndo] = useState<{ prev: PlanCfg; note: string } | null>(null)
  const unit = effortUnit(rider), ftp = effectiveFtp(rider), lthr = effectiveLthr(rider), u = unitLabel(unit)
  const zones = unit === 'power' ? POWER_ZONES : HR_ZONES

  if (!route) return <p className="muted">Charge un parcours dans l'onglet Road book.</p>
  if (!plan || !res) return null

  const setPlan = (p: Partial<PlanCfg>) => { setUndo(null); set({ plan: { ...(plan ?? defaultPlanCfg()), ...p } }) }
  const imposed = [...plan.imposed].sort((a, b) => a.a - b.a)
  const nZones = zones.length
  const zt = unit === 'power' ? res.zt : [...res.zt.slice(0, 4), res.zt[4] + res.zt[5] + res.zt[6]]
  const total = zt.reduce((a, b) => a + b, 0) || 1, mx = Math.max(...zt, 1)
  const line = (s: { min: number; max: number }) => { const lo = pctToValue(s.min, unit, ftp, lthr), hi = pctToValue(s.max, unit, ftp, lthr); return lo != null ? `${lo}–${hi} ${u}` : 'FC seuil à renseigner' }
  const zoneOfPct = (min: number, max: number) => { const z = powerZoneOf((min + max) / 200); return Math.min(unit === 'power' ? z : hrZoneOfPowerZone(z), nZones - 1) }
  const newImposed = (r?: ProgramRow): Editing => ({ isNew: true, v: { id: uid(), kind: 'zone', locked: true, name: r && !r.locked ? r.label : '', a: r ? +r.a.toFixed(1) : 0, b: r ? +r.b.toFixed(1) : Math.min(5, route.total / 1000), min: r?.minPct ?? 55, max: r?.maxPct ?? 75, msg: '', avant: 1 } })
  const saveImposed = (v: Section) => { setPlan({ imposed: plan.imposed.some(x => x.id === v.id) ? plan.imposed.map(x => (x.id === v.id ? v : x)) : [...plan.imposed, v] }); setEdit(null) }

  const openSuggest = () => setSuggest({ intent: null, minutes: 0 })
  const pick = (i: Intent) => setSuggest({ intent: i, minutes: suggestedMinutes(i, res.H, unit) })
  const propose = () => {
    if (!suggest?.intent) return
    const s = suggestPlan({ route, body: rider, ftp, unit, cfg: plan }, suggest.intent, suggest.minutes || undefined)
    const prev = plan
    set({ plan: { ...plan, manual: s.manual, imposed: s.imposed, mode: 'manuel' } })
    setUndo({ prev, note: s.note })
    setSuggest(null)
  }

  return (
    <>
      <div className="facts">
        <div><b>{hrs(res.H)}</b><span>de roulage</span><small>{hrs(res.range[0])} à {hrs(res.range[1])}</small></div>
        <div><b>{res.arriveRange ? arrival(new Date(res.arriveRange[0].valueOf() / 2 + res.arriveRange[1].valueOf() / 2), plan.start) : '--'}</b><span>arrivée</span>{res.arriveRange && <small>{arrival(res.arriveRange[0], plan.start)} à {arrival(res.arriveRange[1], plan.start)}</small>}</div>
        <div><b>{nf1(res.vavg)}</b><span>km/h en roulant</span></div>
      </div>
      {res.warnings.map(w => <p key={w} className="notice">{w}</p>)}
      <button className="btn primary big" style={{ marginBottom: 12 }} onClick={openSuggest}>Suggérer un plan</button>
      {undo && (
        <div className="row undo" role="status">
          <span className="grow">{undo.note}</span>
          <button className="btn" onClick={() => { set({ plan: undo.prev }); setUndo(null); toast('Plan précédent rétabli.') }}>Annuler</button>
        </div>
      )}

      <ZoneProfile route={route} ratio={res.ratio} unit={unit} />

      <h2 className="h2">Terrain</h2>
      <div className="stack">
        {([['plat', 'Plat'], ['montee', 'Montée'], ['descente', 'Descente']] as const).map(([k, label]) => (
          <details className="fold" key={k} style={{ marginTop: 0 }}>
            <summary>{label} · {line({ min: plan.manual[k][0], max: plan.manual[k][1] })}</summary>
            <div><TargetPicker unit={unit} ftp={ftp} lthr={lthr} min={plan.manual[k][0]} max={plan.manual[k][1]} onChange={(min, max) => setPlan({ manual: { ...plan.manual, [k]: [min, max] } })} /></div>
          </details>
        ))}
      </div>

      <h2 className="h2">Segments · {imposed.length}</h2>
      <ul className="list">
        {imposed.map(s => (
          <li key={s.id}><button className="item" onClick={() => setEdit({ v: s, isNew: false })}>
            <span className="dot" style={{ background: zones[zoneOfPct(s.min, s.max)].c }} />
            <span className="km">{nf1(s.a)}–{nf1(s.b)}</span>
            <span className="t">{s.name}<small>Z{zoneOfPct(s.min, s.max) + 1} · {line(s)}</small></span>
          </button></li>
        ))}
        {!imposed.length && <li className="muted" style={{ padding: '12px 0' }}>Aucun : ton terrain s’applique partout.</li>}
      </ul>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => setEdit(newImposed())}><Icon name="plus" size={20} />Ajouter un segment</button>

      <details className="fold">
        <summary>Répartition par zone</summary>
        <div className="zrows">
          {zones.map((z, k) => {
            const t = zt[k] ?? 0
            if (t < 60) return null
            return (
              <div className="zrow" key={z.n}>
                <span className="zl"><b style={{ color: z.c }}>{z.n}</b> {z.l}</span>
                <span className="zb"><i style={{ width: `${(t / mx) * 100}%`, background: z.c }} /></span>
                <span className="zv">{fdur(t)}<small>{Math.round((t / total) * 100)} %</small></span>
              </div>
            )
          })}
        </div>
      </details>
      <details className="fold">
        <summary>Programme · {res.program.length}</summary>
        <div>
          <ul className="list">
            {res.program.map((r, i) => (
              <li key={r.id ?? i}><button className="item" onClick={() => { const s = r.id ? plan.imposed.find(x => x.id === r.id) : undefined; setEdit(s ? { v: s, isNew: false } : newImposed(r)) }}>
                <span className="dot" style={{ background: zones[Math.min(r.zone, nZones - 1)].c }} />
                <span className="km">km {nf0(r.a)}–{nf0(r.b)}</span>
                <span className="t">{r.label}<small>{line({ min: r.minPct, max: r.maxPct })} · {fdur(r.t)}{r.note ? ` · ${r.note}` : ''}</small></span>
              </button></li>
            ))}
            {!res.program.length && <li className="muted" style={{ padding: '12px 0' }}>Tes cibles de base partout.</li>}
          </ul>
        </div>
      </details>
      <details className="fold">
        <summary>Chiffres</summary>
        <div>
          <dl className="kv">
            <dt>Puissance moyenne</dt><dd>{nf0(res.pavgW)} W</dd>
            <dt>Puissance normalisée</dt><dd>{nf0(res.npW)} W · IF {nf1(res.IF * 100)} %</dd>
            <dt>Charge</dt><dd>{nf0(res.tss)} TSS</dd>
            <dt>Énergie</dt><dd>{nf0(res.kcal)} kcal</dd>
            <dt>Glucides</dt><dd>{nf0(res.carbsTotal)} g · {res.carbsPerHour} g/h</dd>
            <dt>Eau</dt><dd>{nf1(res.waterTotal)} L</dd>
            <dt>Arrêts</dt><dd>{res.stops ? hrs(res.stops / 60) : '0'}{plan.stops == null ? ' (estimés)' : ''}</dd>
            <dt>Au total</dt><dd>{hrs(res.total)} · {nf1(route.total / 1000 / res.total)} km/h</dd>
          </dl>
        </div>
      </details>
      <details className="fold">
        <summary>Options</summary>
        <div>
          <div className="cols2">
            <Field label="Arrêts (min)"><Num value={plan.stops} min={0} step={5} placeholder="Auto" onChange={v => setPlan({ stops: v })} /></Field>
            <Field label="Eau emportée (L)"><Num value={plan.water} min={0} step={0.25} onChange={v => setPlan({ water: v ?? 0 })} /></Field>
            <Field label="Glucides (g/h)"><Num value={plan.carbs} min={0} max={150} step={5} placeholder="Auto" onChange={v => setPlan({ carbs: v })} /></Field>
            <Field label="Température (°C)"><Num value={plan.tempC ?? 15} min={-10} max={45} step={1} onChange={v => setPlan({ tempC: v ?? 15 })} /></Field>
            <Field label="Vent (km/h)"><Num value={plan.windKmh ?? 0} min={0} max={80} step={5} onChange={v => setPlan({ windKmh: v ?? 0 })} /></Field>
            <Field label="Vent venant du">
              <select value={plan.windFrom ?? 270} onChange={e => setPlan({ windFrom: +e.target.value })}>
                {['Nord', 'Nord-est', 'Est', 'Sud-est', 'Sud', 'Sud-ouest', 'Ouest', 'Nord-ouest'].map((d, k) => <option key={d} value={k * 45}>{d}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </details>

      {edit && (
        <Sheet title={edit.isNew ? 'Nouveau segment' : 'Segment'} onClose={() => setEdit(null)}>
          <ImposedForm initial={edit.v} isNew={edit.isNew} maxKm={route.total / 1000} route={route} unit={unit} ftp={ftp} lthr={lthr} onClose={() => setEdit(null)}
            onSave={saveImposed} onDelete={() => { setPlan({ imposed: plan.imposed.filter(x => x.id !== edit.v.id) }); setEdit(null) }} />
        </Sheet>
      )}
      {suggest && (
        <Sheet title="Que cherches-tu ?" onClose={() => setSuggest(null)}>
          <div className="stack">
            {INTENTS.map(i => (
              <button key={i.id} className="card mode" role="radio" aria-checked={suggest.intent === i.id} onClick={() => pick(i.id)}>
                <b>{i.n}</b><small>{i.d}</small>
              </button>
            ))}
          </div>
          {suggest.intent && BLOCK_INTENTS.includes(suggest.intent) && (
            <Stepper label="Temps d'effort" value={`${suggest.minutes} min`} hint="au total, en blocs"
              onMinus={() => setSuggest({ ...suggest, minutes: Math.max(suggest.intent === 'vo2max' ? 2 : 5, suggest.minutes - (suggest.intent === 'vo2max' ? 2 : 5)) })}
              onPlus={() => setSuggest({ ...suggest, minutes: suggest.minutes + (suggest.intent === 'vo2max' ? 2 : 5) })} />
          )}
          <button className="btn primary big" style={{ marginTop: 12 }} disabled={!suggest.intent} onClick={propose}>Proposer</button>
        </Sheet>
      )}
    </>
  )
}
