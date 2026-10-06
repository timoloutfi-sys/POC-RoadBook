import { useMemo, type CSSProperties } from 'react'
import { fdur, hhmm, nf0, nf1 } from '../core/format'
import type { WidgetData, Upcoming } from '../ride/data'
import { useStore } from '../storage/store'
import { POINT_TYPES, type Section } from '../strategy/types'
import { HR_ZONES, POWER_ZONES, hrZoneOfPowerZone, powerZoneOf } from '../strategy/zones'
import type { WidgetItem } from '../storage/defaults'
import { Icon, type IconName } from './icons'
import { InTargetView, ReserveView, TileView, ZoneNowView, ZonesView, tileOf } from './tiles'

export type Size = 'S' | 'M' | 'L'
export const sizeOf = (it: Pick<WidgetItem, 'w' | 'h'>): Size => ((it.w >= 3 && it.h >= 2) || it.w * it.h >= 6 ? 'L' : it.w >= 2 || it.h >= 2 ? 'M' : 'S')

const unit = (d: WidgetData) => (d.source === 'power' ? 'W' : 'bpm')
const zoneColor = (d: WidgetData, z: number) => (d.source === 'power' ? POWER_ZONES : HR_ZONES)[Math.min(z, d.source === 'power' ? 6 : 4)].c
const zoneOfTarget = (d: WidgetData) => (d.source === 'power' ? d.tg.zone : hrZoneOfPowerZone(d.tg.zone))
const evIcon = (k: Upcoming['kind']): IconName => (k === 'montee' ? 'montee' : k === 'zone' ? 'route' : (k as IconName))

function EffortW({ d, sz, metric, wkg }: { d: WidgetData; sz: Size; metric?: 'power' | 'hr'; wkg?: boolean }) {
  const src = metric ?? d.source
  if (src !== d.source) d = { ...d, source: src, effort: src === 'power' ? d.power : d.hr, band: src === 'power' ? d.tg.power : d.tg.hr ?? null, noLthr: src === 'hr' && d.noLthr }
  const lab = src === 'power' ? 'Puissance' : 'FC'
  if (d.noLthr) return <><div className="lab">{lab}</div><div className="val">{d.effort == null ? '--' : nf0(d.effort)}</div><div className="sub">Renseigne ta FC seuil</div></>
  if (d.effort == null || !isFinite(d.effort)) return <><div className="lab">{lab}</div><div className="val">--</div>{sz !== 'S' && <div className="sub">Pas de capteur</div>}</>
  const b = d.band, st = !b ? 'ok' : d.effort > b.max ? 'hi' : d.effort < b.min ? 'lo' : 'ok'
  const lo = b ? Math.max(0, b.min * 0.7) : 0, hi = b ? Math.max(b.max * 1.3, lo + 40) : 1
  const pc = (x: number) => Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100))
  return (
    <>
      <div className="lab">{lab}</div>
      <div className={`val st-${st}`}>{wkg && d.source === 'power' ? nf1(d.effort / d.mass) : nf0(d.effort)}<small>{wkg && d.source === 'power' ? 'W/kg' : unit(d)}</small></div>
      {sz !== 'S' && b && (
        <div className="band" aria-hidden="true"><span className="bz" style={{ left: `${pc(b.min)}%`, width: `${Math.max(2, pc(b.max) - pc(b.min))}%` }} /><span className="bm" style={{ left: `${pc(d.effort)}%` }} /></div>
      )}
      {sz === 'L' && b && <div className={`sub st-${st}`}>{st === 'ok' ? 'Dans la cible' : st === 'hi' ? `+${nf0(d.effort - b.max)} ${unit(d)} au-dessus` : `${nf0(b.min - d.effort)} ${unit(d)} sous la cible`}</div>}
    </>
  )
}

function TargetW({ d, sz }: { d: WidgetData; sz: Size }) {
  const b = d.band, z = zoneOfTarget(d)
  if (!b) return <><div className="lab">Cible</div><div className="sub">{d.noLthr ? 'Renseigne ta FC seuil' : '--'}</div></>
  return (
    <>
      <div className="lab">Cible</div>
      <div className="val" style={{ color: zoneColor(d, z) }}>{b.min}–{b.max}<small>{unit(d)}</small></div>
      {sz !== 'S' && <div className="sub"><b>Z{z + 1}</b> · {d.tg.label}{d.leftS != null && d.tg.section ? ` · encore ${fdur(d.leftS)}` : ''}</div>}
      {sz === 'L' && d.after && <div className="sub dim">ensuite <b style={{ color: zoneColor(d, d.after.zone) }}>Z{d.after.zone + 1}</b> · {d.after.name}</div>}
    </>
  )
}

const eta = (d: WidgetData, km: number) => {
  const m = Math.round(((km - d.km) / Math.max(15, d.vAvg || 28)) * 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

/** Prochains points : des lignes empilées comme sur un cahier ; plus large = plus de détails, plus haut = plus de lignes. */
function NextW({ d, w, h, content }: { d: WidgetData; w: number; h: number; content: string }) {
  const isNote = (e: Upcoming) => e.kind === 'note'
  const L = d.next.filter(e => (content === 'notes' ? isNote(e) : content === 'points' ? !isNote(e) : true))
  const lab = content === 'notes' ? 'Prochaines notes' : 'Prochains points'
  if (!L.length) return <><div className="lab">{lab}</div><div className="sub dim">--</div></>
  const name = (e: Upcoming) => e.name || (e.kind in POINT_TYPES ? POINT_TYPES[e.kind as keyof typeof POINT_TYPES].n : 'Section')
  const rows = h === 1 ? 2 : h * 2, shown = L.slice(0, rows)
  const at = (km: number) => hhmm(new Date(d.now.valueOf() + ((km - d.km) / Math.max(15, d.vAvg || 28)) * 3600e3))
  return (
    <div className="nb">
      <div className="lab">{lab}</div>
      <div className="nb-lines">
        {shown.map(e => {
          const note = isNote(e) && h > 1
          return (
            <div key={e.km + name(e)} className={`nb-line${note ? ' note' : ''}`} style={note ? ({ '--l': Math.max(1, rows - shown.length + 1) } as CSSProperties) : undefined}>
              <Icon name={evIcon(e.kind)} size={18} />
              <span className="nm">{name(e)}</span>
              {w >= 3 && <span className="eta">{w >= 4 ? `dans ${eta(d, e.km)} · ${at(e.km)}` : eta(d, e.km)}</span>}
              <span className="km">{nf1(e.km - d.km)} km</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProfileW({ d, sz, range: opt }: { d: WidgetData; sz: Size; range?: string | number | boolean }) {
  const route = useStore(s => s.route)
  const sections = useStore(s => s.sections)
  const points = useStore(s => s.points)
  const range = typeof opt === 'number' ? opt : sz === 'S' ? 5 : sz === 'M' ? 15 : 25
  const view = useMemo(() => {
    if (!route) return null
    const a = Math.min(d.km, route.total / 1000), b = Math.min(route.total / 1000, a + range)
    const i0 = Math.floor((a * 1000) / 50), i1 = Math.max(i0 + 2, Math.ceil((b * 1000) / 50))
    let lo = Infinity, hi = -Infinity
    for (let i = i0; i <= Math.min(i1, route.n - 1); i++) { lo = Math.min(lo, route.ele[i]); hi = Math.max(hi, route.ele[i]) }
    if (hi - lo < 40) { const m = (hi + lo) / 2; lo = m - 20; hi = m + 20 }
    const span = Math.max(0.5, b - a), W = 1000, H = 200
    let p = ''
    for (let i = i0; i <= Math.min(i1, route.n - 1); i += Math.max(1, Math.floor((i1 - i0) / 200))) {
      const x = ((i * 50) / 1000 - a) / span * W, y = 14 + (1 - (route.ele[i] - lo) / (hi - lo)) * (H - 24)
      p += `${p ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    }
    return { a, b, span, W, H, path: p }
  }, [route, d.km, range])
  if (!view) return <><div className="lab">Profil</div><div className="sub">Aucun parcours</div></>
  const X = (km: number) => ((km - view.a) / view.span) * view.W
  const tint = (s: Section) => (d.source === 'power' ? POWER_ZONES : HR_ZONES)[Math.min(d.source === 'power' ? 6 : 4, d.source === 'power' ? powerZoneOf((s.min + s.max) / 200) : hrZoneOfPowerZone(powerZoneOf((s.min + s.max) / 200)))].c
  return (
    <>
      <div className="lab">Profil · {range} km à venir</div>
      <svg className="mini" viewBox={`0 0 ${view.W} ${view.H}`} preserveAspectRatio="none" aria-hidden="true">
        {sections.filter(s => s.b > view.a && s.a < view.b).map(s => <rect key={s.id} x={X(Math.max(s.a, view.a))} width={Math.max(3, X(Math.min(s.b, view.b)) - X(Math.max(s.a, view.a)))} y={0} height={view.H} fill={tint(s)} opacity={0.28} />)}
        <path d={`${view.path}L${view.W},${view.H}L0,${view.H}Z`} className="mfill" />
        <path d={view.path} className="mline" fill="none" vectorEffect="non-scaling-stroke" />
        {points.filter(p => p.km >= view.a && p.km <= view.b).map(p => <line key={p.id} x1={X(p.km)} x2={X(p.km)} y1={0} y2={view.H} className="mpt" vectorEffect="non-scaling-stroke" />)}
        <line x1={0} x2={0} y1={0} y2={view.H} className="mnow" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="axis"><span>{nf0(view.a)} km</span><span>{nf0(view.b)} km</span></div>
    </>
  )
}


function FuelW({ d, sz }: { d: WidgetData; sz: Size }) {
  if (!d.fuel) return <><div className="lab">Rappel</div><div className="sub">Aucun rappel actif</div></>
  const s = d.fuel.s
  const when = s < 60 ? `${Math.round(s)} s` : `${Math.ceil(s / 60)} min`
  return <><div className="lab wrap">{d.fuel.msg}</div><div className="val y">{sz !== 'S' && <small>dans</small>} {when}</div></>
}

function NextStopsW({ d, sz }: { d: WidgetData; sz: Size }) {
  const n = d.plan?.nextStop
  if (!d.plan) return <><div className="lab">Prochain arrêt</div><div className="val">--</div></>
  if (!n) return <><div className="lab">Prochain arrêt</div><div className="sub">Aucun prévu</div></>
  return (
    <>
      <div className="lab">Prochain arrêt</div>
      <div className="nx first"><span className="nm">{n.name}</span></div>
      <div className="sub"><b className="acc">{nf1(n.kmAway)} km</b>{n.at && <span className="dim"> · vers {hhmm(n.at)}</span>}{sz === 'L' && n.stopMin > 0 && <span className="dim"> · {n.stopMin} min</span>}</div>
    </>
  )
}

function GapW({ d, w, h }: { d: WidgetData; w: number; h: number }) {
  const g = d.plan?.gapS
  if (g == null) return <><div className="lab">Écart au plan</div><div className="val">--</div></>
  const m = Math.round(g / 60), st = Math.abs(m) < 5 ? 'ok' : m > 0 ? 'hi' : 'lo'
  const p = d.plan, pct = p && p.kj != null && p.kjPlan ? Math.round((p.kj / p.kjPlan - 1) * 100) : null
  return (
    <>
      <div className="lab">Écart au plan</div>
      <div className={`val st-${st}`}>{m === 0 ? '0' : `${m > 0 ? '+' : '−'}${Math.abs(m)}`}<small>min</small></div>
      {w * h > 1 && <div className={`sub st-${st}`}>{Math.abs(m) < 2 ? 'Dans les temps' : m > 0 ? 'En retard' : 'En avance'}</div>}
      {w * h >= 4 && p && p.kj != null && p.kjPlan && pct != null && <div className="sub dim">Dépense {nf0(p.kj)} / {nf0(p.kjPlan)} kJ ({pct > 0 ? '+' : pct < 0 ? '−' : ''}{Math.abs(pct)} %)</div>}
    </>
  )
}

const TILES = new Set<WidgetItem['k']>(['punch', 'endurance', 'drift', 'carbs', 'carbgap', 'lap', 'slope', 'climb', 'arrival', 'sunset', 'time', 'dist', 'clock', 'cad', 'speed', 'sumeffort', 'sumroute', 'sumfuel'])

export function Widget({ it, d }: { it: WidgetItem; d: WidgetData }) {
  const sz = sizeOf(it), o = it.o ?? {}
  if (TILES.has(it.k)) return <TileView t={tileOf(it.k, d, o)} w={it.w} h={it.h} />
  if (it.k === 'zone') return <ZoneNowView d={d} w={it.w} />
  if (it.k === 'zones') return <ZonesView d={d} w={it.w} h={it.h} />
  if (it.k === 'intarget') return <InTargetView d={d} w={it.w} />
  if (it.k === 'reserve') return <ReserveView d={d} w={it.w} h={it.h} />
  switch (it.k) {
    case 'effort': return <EffortW d={d} sz={sz} wkg={!!o.wkg} />
    case 'hr': return <EffortW d={d} sz={sz} metric="hr" />
    case 'target': return <TargetW d={d} sz={sz} />
    case 'next': return o.stops || o.content === 'stops' ? <NextStopsW d={d} sz={sz} /> : <NextW d={d} w={it.w} h={it.h} content={String(o.content ?? 'all')} />
    case 'profile': return <ProfileW d={d} sz={sz} range={o.range} />
    case 'fuel': return <FuelW d={d} sz={sz} />
    case 'gap': return <GapW d={d} w={it.w} h={it.h} />
    default: return null
  }
}
