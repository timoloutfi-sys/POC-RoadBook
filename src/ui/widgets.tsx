import { useMemo } from 'react'
import { fdur, hhmm, hms, nf0, nf1 } from '../core/format'
import type { WidgetData, Upcoming } from '../ride/data'
import { useStore } from '../storage/store'
import { POINT_TYPES, type Section } from '../strategy/types'
import { HR_ZONES, POWER_ZONES, hrZoneOfPowerZone, powerZoneOf } from '../strategy/zones'
import type { WidgetItem } from '../storage/defaults'
import { Icon, type IconName } from './icons'

export type Size = 'S' | 'M' | 'L'
export const sizeOf = (it: Pick<WidgetItem, 'w' | 'h'>): Size => ((it.w >= 3 && it.h >= 2) || it.w * it.h >= 6 ? 'L' : it.w >= 2 || it.h >= 2 ? 'M' : 'S')

const unit = (d: WidgetData) => (d.source === 'power' ? 'W' : 'bpm')
const zoneColor = (d: WidgetData, z: number) => (d.source === 'power' ? POWER_ZONES : HR_ZONES)[Math.min(z, d.source === 'power' ? 6 : 4)].c
const zoneOfTarget = (d: WidgetData) => (d.source === 'power' ? d.tg.zone : hrZoneOfPowerZone(d.tg.zone))
const evIcon = (k: Upcoming['kind']): IconName => (k === 'montee' ? 'montee' : k === 'zone' ? 'route' : (k as IconName))

function Spark({ arr }: { arr: number[] }) {
  if (arr.length < 2) return null
  let lo = Math.min(...arr), hi = Math.max(...arr)
  if (hi - lo < 10) { const m = (hi + lo) / 2; lo = m - 5; hi = m + 5 }
  const pts = arr.map((v, i) => `${((i / (arr.length - 1)) * 100).toFixed(1)},${(28 - ((v - lo) / (hi - lo)) * 26).toFixed(1)}`).join(' ')
  return <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" /></svg>
}

function EffortW({ d, sz }: { d: WidgetData; sz: Size }) {
  const lab = d.source === 'power' ? 'Puissance' : 'Fréquence cardiaque'
  if (d.noLthr) return <><div className="lab">{lab}</div><div className="val">{d.effort == null ? '--' : nf0(d.effort)}</div><div className="sub">Renseigne ta FC seuil</div></>
  if (d.effort == null || !isFinite(d.effort)) return <><div className="lab">{lab}</div><div className="val">--</div>{sz !== 'S' && <div className="sub">Pas de capteur</div>}</>
  const b = d.band, st = !b ? 'ok' : d.effort > b.max ? 'hi' : d.effort < b.min ? 'lo' : 'ok'
  const lo = b ? Math.max(0, b.min * 0.7) : 0, hi = b ? Math.max(b.max * 1.3, lo + 40) : 1
  const pc = (x: number) => Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100))
  return (
    <>
      <div className="lab">{lab}</div>
      <div className={`val st-${st}`}>{nf0(d.effort)}<small>{unit(d)}</small></div>
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

function NextW({ d, sz }: { d: WidgetData; sz: Size }) {
  const L = d.next
  if (!L.length) return <><div className="lab">Prochain</div><div className="sub">Rien d'annoncé</div></>
  const name = (e: Upcoming) => e.name || (e.kind in POINT_TYPES ? POINT_TYPES[e.kind as keyof typeof POINT_TYPES].n : 'Section')
  if (sz === 'S') return <><div className="lab">Prochain</div><div className="val ev"><Icon name={evIcon(L[0].kind)} size={28} />{nf1(L[0].km - d.km)}<small>km</small></div></>
  if (sz === 'M') {
    const e = L[0]
    return (
      <>
        <div className="lab">Prochain événement</div>
        <div className="nx first"><Icon name={evIcon(e.kind)} size={24} /><span className="nm">{name(e)}</span></div>
        <div className="sub"><b className="acc">{nf1(e.km - d.km)} km</b> <span className="dim">· dans {eta(d, e.km)}</span></div>
      </>
    )
  }
  const rows = L
  return (
    <>
      <div className="lab">Prochain événement</div>
      {rows.map((e, i) => (
        <div className={`nx${i === 0 ? ' first' : ''}`} key={e.km + name(e)}><Icon name={evIcon(e.kind)} size={22} /><span className="nm">{name(e)}</span><span className="dist">{nf1(e.km - d.km)} km</span></div>
      ))}
    </>
  )
}



function ProfileW({ d, sz }: { d: WidgetData; sz: Size }) {
  const route = useStore(s => s.route)
  const sections = useStore(s => s.sections)
  const points = useStore(s => s.points)
  const range = sz === 'S' ? 5 : sz === 'M' ? 15 : 25
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
  return <><div className="lab wrap">{d.fuel.msg}</div><div className="val y"><small>dans</small> {when}</div>{sz === 'L' && <div className="sub dim">Appui long à droite : Fait</div>}</>
}

export function Widget({ k, sz, d }: { k: WidgetItem['k']; sz: Size; d: WidgetData }) {
  switch (k) {
    case 'effort': return <EffortW d={d} sz={sz} />
    case 'target': return <TargetW d={d} sz={sz} />
    case 'next': return <NextW d={d} sz={sz} />
    case 'profile': return <ProfileW d={d} sz={sz} />
    case 'fuel': return <FuelW d={d} sz={sz} />
    case 'hr': return <><div className="lab">FC</div><div className="val">{d.hr == null ? '--' : nf0(d.hr)}<small>bpm</small></div>{sz !== 'S' && <Spark arr={d.hrHist} />}</>
    case 'cad': return <><div className="lab">Cadence</div><div className="val">{d.cad == null ? '--' : nf0(d.cad)}<small>rpm</small></div></>
    case 'speed': return <><div className="lab">Vitesse</div><div className="val">{nf1(d.speed)}<small>km/h</small></div></>
    case 'dist': return <><div className="lab">Distance</div><div className="val">{nf1(d.km)}<small>km</small></div>{sz !== 'S' && <div className="sub dim">Reste {nf1(Math.max(0, d.total - d.km))} km</div>}</>
    case 'time': return <><div className="lab">Temps de roulage</div><div className="val">{hms(d.t)}</div></>
    case 'clock': return <><div className="lab">Heure</div><div className="val">{hhmm(d.now)}</div>{sz !== 'S' && d.arrival && <div className="sub dim">arrivée {hhmm(d.arrival)}</div>}</>
  }
}
