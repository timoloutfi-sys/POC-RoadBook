import { useEffect, useRef, useState } from 'react'
import { fdur, hrs, nf0, nf1 } from '../core/format'
import { computePlan, defaultPlanCfg, BLOCK, type BlockZone, type PlanCfg, type PlanMode, type PlanResult } from '../strategy/plan'
import { effectiveFtp, effectiveLthr, effortUnit } from '../strategy/rider'
import { pctToValue, unitLabel } from '../strategy/units'
import { HR_ZONES, POWER_ZONES } from '../strategy/zones'
import { useStore } from '../storage/store'
import { Field, Num } from './fields'
import { Icon } from './icons'
import { ZoneProfile } from './ZoneProfile'

const MODES: { id: PlanMode; n: string; d: string }[] = [
  { id: 'tranquille', n: 'Sortie tranquille', d: 'Endurance, du début à la fin' },
  { id: 'entrainement', n: 'Entraînement', d: 'Des efforts placés sur le parcours' },
  { id: 'course', n: 'Course', d: 'Le plus vite possible, à ton rythme tenable' },
]
/** « 13:04 » le jour du départ, « sam. 02:10 » sinon. */
const arrival = (d: Date, start: string) => {
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), s = new Date(start)
  return s.toDateString() === d.toDateString() ? hm : `${d.toLocaleDateString('fr-FR', { weekday: 'short' })} ${hm}`
}

export function PlanTab() {
  const { route, rider, plan, set, applyPlan, clearPlan } = useStore()
  const [res, setRes] = useState<PlanResult | null>(null)
  const [delta, setDelta] = useState('')
  const pending = useRef<{ z: BlockZone; d: number; H: number; tss: number } | null>(null)
  const unit = effortUnit(rider), ftp = effectiveFtp(rider), lthr = effectiveLthr(rider), u = unitLabel(unit)
  const zones = unit === 'power' ? POWER_ZONES : HR_ZONES

  // Chaque changement recalcule le plan et l'applique : sections, points d'eau, rappels. Le travail manuel reste.
  useEffect(() => {
    if (!route || !plan) { setRes(null); return }
    const t = setTimeout(() => {
      const r = computePlan({ route, body: rider, ftp, unit, cfg: plan })
      setRes(r)
      applyPlan(r)
      const p = pending.current
      pending.current = null
      if (p) {
        const dm = Math.round((r.H - p.H) * 60), dc = Math.round(((r.tss - p.tss) / Math.max(1, p.tss)) * 100)
        const when = dm === 0 ? 'même arrivée' : `arrivée ${Math.abs(dm)} min ${dm < 0 ? 'plus tôt' : 'plus tard'}`
        setDelta(`${p.d > 0 ? '+' : '−'}${Math.abs(p.d)} min en Z${p.z + 1} : ${when}, charge ${dc >= 0 ? '+' : '−'}${Math.abs(dc)} %`)
      }
    }, 150)
    return () => clearTimeout(t)
  }, [route, plan, rider, ftp, unit, applyPlan])

  if (!route) return <p className="muted">Charge un parcours dans l'onglet Parcours.</p>

  const setPlan = (p: Partial<PlanCfg>) => set({ plan: { ...(plan ?? defaultPlanCfg()), ...p } })
  const choose = (mode: PlanMode) => { setDelta(''); setPlan({ mode, minutes: {}, targetHours: mode === 'course' ? plan?.targetHours ?? null : null }) }
  const adjust = (z: BlockZone, d: number) => {
    if (!res || !plan) return
    const cur = plan.minutes[z] ?? res.defaults[z], next = Math.max(0, Math.min(res.limits[z], cur + d))
    if (next === cur) return
    pending.current = { z, d: next - cur, H: res.H, tss: res.tss }
    setPlan({ minutes: { ...plan.minutes, [z]: next } })
  }
  const nZones = zones.length
  const zt = res ? (unit === 'power' ? res.zt : [...res.zt.slice(0, 4), res.zt[4] + res.zt[5] + res.zt[6]]) : []
  const total = zt.reduce((a, b) => a + b, 0) || 1, mx = Math.max(...zt, 1)

  return (
    <>
      <div className="stack" role="radiogroup" aria-label="Ce que tu veux faire">
        {MODES.map(m => (
          <button key={m.id} className="card mode" role="radio" aria-checked={plan?.mode === m.id} onClick={() => choose(m.id)}>
            <div className="t"><b>{m.n}</b><small>{m.d}</small></div>
          </button>
        ))}
      </div>

      {plan?.mode === 'course' && (
        <div style={{ marginTop: 12 }}>
          <Field label="Temps de roulage visé (h)"><Num value={plan.targetHours} min={1} step={0.5} placeholder="Auto : intensité tenable" onChange={v => setPlan({ targetHours: v })} /></Field>
        </div>
      )}

      {plan && res && (
        <>
          <div className="facts">
            <div><b>{hrs(res.H)}</b><span>de roulage</span></div>
            <div><b>{res.arrive ? arrival(res.arrive, plan.start) : '--'}</b><span>arrivée</span></div>
            <div><b>{nf1(res.vavg)}</b><span>km/h de moyenne</span></div>
          </div>
          {res.warnings.map(w => <p key={w} className="notice">{w}</p>)}

          <ZoneProfile route={route} ratio={res.ratio} unit={unit} />

          <h2 className="h2">Temps par zone</h2>
          <div className="zrows">
            {zones.map((z, k) => {
              const t = zt[k] ?? 0, adj = res.adjustable.includes(k as BlockZone) && k >= 2 && k < nZones - (unit === 'hr' ? 1 : 2)
              const bz = k as BlockZone, val = plan.minutes[bz] ?? res.defaults[bz]
              if (!adj && t < 60) return null
              return (
                <div className="zrow" key={z.n}>
                  <span className="zl"><b style={{ color: z.c }}>{z.n}</b> {z.l}</span>
                  <span className="zb"><i style={{ width: `${(t / mx) * 100}%`, background: z.c }} /></span>
                  <span className="zv">{fdur(t)}<small>{Math.round((t / total) * 100)} %</small></span>
                  {adj && (
                    <span className="zadj">
                      <button className="iconbtn" aria-label={`Moins en ${z.n}`} disabled={val <= 0} onClick={() => adjust(bz, -BLOCK[bz].step)}><Icon name="minus" /></button>
                      <button className="iconbtn" aria-label={`Plus en ${z.n}`} disabled={val >= res.limits[bz]} onClick={() => adjust(bz, BLOCK[bz].step)}><Icon name="plus" /></button>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          {delta && <p className="delta" role="status">{delta}</p>}

          <details className="fold">
            <summary>Programme · {res.program.length}</summary>
            <div>
              <ul className="list">
                {res.program.map((r, i) => {
                  const lo = pctToValue(r.minPct, unit, ftp, lthr), hi = pctToValue(r.maxPct, unit, ftp, lthr)
                  return (
                    <li key={i}><div className="item" style={{ cursor: 'default' }}>
                      <span className="dot" style={{ background: zones[Math.min(r.zone, nZones - 1)].c }} />
                      <span className="km">km {nf0(r.a)}–{nf0(r.b)}</span>
                      <span className="t">{r.label}<small>{lo != null ? `${lo}–${hi} ${u}` : `Z${Math.min(r.zone, nZones - 1) + 1}`} · {fdur(r.t)}{r.note ? ` · ${r.note}` : ''}</small></span>
                    </div></li>
                  )
                })}
                {!res.program.length && <li className="muted" style={{ padding: '12px 0' }}>Allure de base partout, aucune section.</li>}
              </ul>
            </div>
          </details>
          <details className="fold">
            <summary>Pourquoi</summary>
            <div><ul className="why">{res.why.map(w => <li key={w}>{w}</li>)}</ul></div>
          </details>
          <details className="fold">
            <summary>Options</summary>
            <div>
              <Field label="Départ"><input type="datetime-local" value={plan.start} onChange={e => setPlan({ start: e.target.value })} /></Field>
              <div className="cols2">
                <Field label="Arrêts (min)"><Num value={plan.stops} min={0} step={5} placeholder="Auto" onChange={v => setPlan({ stops: v })} /></Field>
                <Field label="Eau emportée (L)"><Num value={plan.water} min={0} step={0.25} onChange={v => setPlan({ water: v ?? 0 })} /></Field>
                <Field label="Glucides (g/h)"><Num value={plan.carbs} min={0} max={150} step={5} placeholder="Auto" onChange={v => setPlan({ carbs: v })} /></Field>
              </div>
            </div>
          </details>
          <button className="btn danger" style={{ marginTop: 16 }} onClick={() => { clearPlan(); setDelta('') }}>Retirer le plan</button>
        </>
      )}
    </>
  )
}
