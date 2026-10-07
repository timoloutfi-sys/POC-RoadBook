import type React from 'react'
import { fdur, hhmm, hms, nf0, nf1 } from '../core/format'
import { carbGapState, driftState, driftWord, gapState, inTargetState, reserveState, reserveWord, type State } from './state'
import type { WidgetData } from '../ride/data'
import type { WidgetKind } from '../storage/catalog'
import { HR_ZONES, POWER_ZONES } from '../strategy/zones'

/** Ce qu'un widget affiche, indépendamment de sa forme : le rendu s'adapte à l'espace. */
export interface Tile {
  lab: string
  val?: string
  unit?: string
  st?: State
  /** Détails, du plus important au moins important. */
  sub?: string[]
  /** Jauge de 0 à 1, avec une zone cible facultative. */
  gauge?: { v: number; zone?: [number, number] }
  /** Barres (temps par zone) : v de 0 à 1, `now` marque la ligne en cours. */
  bars?: { l: string; v: number; t: string; c: string; now?: boolean }[]
  /** Paliers de pente d'une montée. */
  steps?: { len: number; grade: number }[]
  /** Deux valeurs côte à côte (réserve). */
  pair?: { l: string; v: string; g: number }[]
  /** Grille de mini-valeurs (synthèses), du plus utile au moins utile. */
  cells?: { l: string; v: string; u?: string; st?: State }[]
  /** Texte quand il n'y a rien à montrer. */
  empty?: string
}

const gc = (g: number) => (g < 3 ? '#4da3ff' : g < 6 ? '#3ddc84' : g < 9 ? '#ffd21f' : g < 12 ? '#ff8a3d' : '#ff5a36')
export const gradeColor = gc
const pct = (v: number) => Math.min(1, Math.max(0, v))
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`


export function tileOf(k: WidgetKind, d: WidgetData, o: Record<string, string | number | boolean> = {}): Tile {
  const m = d.m
  const zdefs = d.source === 'power' ? POWER_ZONES : HR_ZONES
  switch (k) {
    case 'zone': {
      if (!m || m.zoneNow < 0) return { lab: 'Zone', empty: '--' }
      const z = m.zoneNow
      return { lab: 'Zone', val: `Z${z + 1}`, sub: [zdefs[z].l, `depuis ${mmss(Math.max(0, d.t - m.zoneSince))}`] }
    }
    case 'zones': {
      if (!m) return { lab: 'Temps par zone', empty: '--' }
      const tot = m.zones.reduce((a, b) => a + b, 0) || 1, n = m.zones.length
      const names = Array.from({ length: n }, (_, i) => (i === 4 && d.source === 'power' ? 'Z5+' : `Z${i + 1}`))
      return { lab: 'Temps par zone', bars: m.zones.map((s, i) => ({ l: names[i], v: s / tot, t: fdur(s), c: zdefs[i].c, now: i === m.zoneNow })) }
    }
    case 'intarget': {
      if (!m || m.inTarget == null) return { lab: 'Dans la cible', empty: '--' }
      const tot = m.under + m.inT + m.over || 1
      return { lab: 'Dans la cible', val: String(m.inTarget), unit: '%', sub: [`${nf0((m.under / tot) * 100)} % sous la cible`, `${nf0((m.over / tot) * 100)} % au-dessus`], gauge: { v: m.inTarget / 100 } }
    }
    case 'punch': {
      if (!m) return { lab: 'Punch', empty: '--' }
      if (m.punch == null) return { lab: 'Punch', empty: 'Puissance requise' }
      return { lab: 'Punch', val: String(m.punch), unit: '%', st: reserveState(m.punch), sub: [reserveWord(m.punch)], gauge: { v: m.punch / 100 } }
    }
    case 'endurance': {
      if (!m || m.endurance == null) return { lab: 'Endurance', empty: '--' }
      return { lab: 'Endurance', val: String(m.endurance), unit: '%', st: reserveState(m.endurance), sub: [reserveWord(m.endurance)], gauge: { v: m.endurance / 100 } }
    }
    case 'reserve': {
      if (!m) return { lab: 'Réserve', empty: '--' }
      if (m.punch == null || m.endurance == null) return { lab: 'Réserve', empty: 'Puissance requise' }
      return { lab: 'Réserve', pair: [{ l: 'Punch', v: `${m.punch} %`, g: m.punch / 100 }, { l: 'Endurance', v: `${m.endurance} %`, g: m.endurance / 100 }] }
    }
    case 'drift': {
      if (!m || m.drift == null) return { lab: 'Dérive cardiaque', empty: d.t < 1800 ? 'Mesure en cours' : '--' }
      const v = m.drift, st = driftState(v)
      return { lab: 'Dérive cardiaque', val: `${v > 0 ? '+' : ''}${nf1(v)}`, unit: '%', st, sub: [driftWord(v), 'limite 5 %'], gauge: { v: pct(v / 10), zone: [0, 0.5] } }
    }
    case 'carbs': {
      if (!m || m.carbPerH == null) return { lab: 'Glucides / h', empty: d.t < 300 ? 'Mesure en cours' : '--' }
      return { lab: 'Glucides / h', val: String(m.carbPerH), unit: 'g/h', sub: [`${m.carbBurned} g brûlés`, `${m.carbEaten} g mangés`] }
    }
    case 'carbgap': {
      if (!m) return { lab: 'Écart glucides', empty: '--' }
      const g = m.carbGap, st = carbGapState(g)
      return { lab: 'Écart glucides', val: `${g > 0 ? '+' : g < 0 ? '−' : ''}${Math.abs(g)}`, unit: 'g', st, sub: [g >= 0 ? 'En avance' : 'En retard'] }
    }
    case 'lap': {
      if (!m) return { lab: 'Tour', empty: '--' }
      const l = m.lap
      return { lab: `Tour ${m.laps + 1}`, val: mmss(l.dur), sub: [l.p != null ? `${nf0(l.p)} W` : '', l.hr != null ? `${nf0(l.hr)} bpm` : '', `${nf1(l.v)} km/h`].filter(Boolean) }
    }
    case 'slope': {
      if (d.slope == null) return { lab: 'Pente', empty: '--' }
      return { lab: 'Pente', val: nf1(d.slope), unit: '%' }
    }
    case 'climb': {
      const c = d.climb
      if (!c) return { lab: 'Montée', empty: 'Aucune à venir' }
      const prog = c.state === 'in' ? c.doneM / c.lenM : 0
      return {
        lab: c.state === 'in' ? 'Montée en cours' : 'Prochaine montée', val: nf1(c.toGoKm), unit: 'km',
        sub: [c.state === 'in' ? 'restants' : 'avant la montée', `${nf1(c.lenM / 1000)} km · ${nf1(c.avg)} %`, `${nf0(c.gainM)} m de D+`], gauge: { v: prog },
        steps: c.steps.map(s => ({ len: s.lenM, grade: s.grade })),
      }
    }
    case 'arrival': {
      if (!d.arrival) return { lab: 'Arrivée', empty: '--' }
      const left = Math.max(0, d.arrival.valueOf() - d.now.valueOf()) / 1000
      const p = d.plan, planned = p?.startedAt != null && p.plannedEndS != null ? new Date(p.startedAt + p.plannedEndS * 1000) : null
      return { lab: planned ? 'Arrivée estimée' : 'Arrivée', val: hhmm(d.arrival), sub: [`dans ${fdur(left)}`, ...(planned ? [`prévu ${hhmm(planned)}`] : [])] }
    }
    case 'sunset': {
      if (!d.sun) return { lab: 'Soleil', empty: '--' }
      const left = Math.max(0, d.sun.at.valueOf() - d.now.valueOf()) / 1000
      return { lab: d.sun.kind === 'set' ? 'Coucher du soleil' : 'Lever du soleil', val: hhmm(d.sun.at), sub: [`dans ${fdur(left)}`] }
    }
    case 'sumeffort': {
      const c: NonNullable<Tile['cells']> = []
      if (d.power != null) c.push({ l: 'Puissance', v: nf0(d.power), u: 'W' })
      if (d.hr != null) c.push({ l: 'FC', v: nf0(d.hr), u: 'bpm' })
      if (m && m.zoneNow >= 0) c.push({ l: 'Zone', v: `Z${m.zoneNow + 1}` })
      if (m?.inTarget != null) c.push({ l: 'Dans la cible', v: String(m.inTarget), u: '%' })
      if (m?.punch != null) c.push({ l: 'Punch', v: String(m.punch), u: '%', st: reserveState(m.punch) })
      if (m?.endurance != null) c.push({ l: 'Endurance', v: String(m.endurance), u: '%', st: reserveState(m.endurance) })
      if (m?.drift != null) c.push({ l: 'Dérive', v: `${m.drift > 0 ? '+' : ''}${nf1(m.drift)}`, u: '%', st: driftState(m.drift) })
      if (d.cad != null) c.push({ l: 'Cadence', v: nf0(d.cad), u: 'rpm' })
      return c.length ? { lab: 'Effort', cells: c } : { lab: 'Effort', empty: '--' }
    }
    case 'sumroute': {
      const c: NonNullable<Tile['cells']> = [{ l: 'Distance', v: nf1(d.km), u: 'km' }]
      if (d.total) c.push({ l: 'Reste', v: nf1(Math.max(0, d.total - d.km)), u: 'km' })
      if (d.arrival) c.push({ l: 'Arrivée', v: hhmm(d.arrival) })
      const g = d.plan?.gapS
      if (g != null) { const mn = Math.round(g / 60); c.push({ l: 'Écart au plan', v: `${mn > 0 ? '+' : mn < 0 ? '−' : ''}${Math.abs(mn)}`, u: 'min', st: gapState(mn) }) }
      if (d.slope != null) c.push({ l: 'Pente', v: nf1(d.slope), u: '%' })
      if (d.climb) c.push({ l: d.climb.state === 'in' ? 'Montée, reste' : 'Prochaine montée', v: nf1(d.climb.toGoKm), u: 'km' })
      if (d.next[0]) c.push({ l: 'Prochain point', v: nf1(d.next[0].km - d.km), u: 'km' })
      if (d.sun) c.push({ l: d.sun.kind === 'set' ? 'Coucher' : 'Lever', v: hhmm(d.sun.at) })
      return { lab: 'Parcours', cells: c }
    }
    case 'sumfuel': {
      const c: NonNullable<Tile['cells']> = []
      if (m?.carbPerH != null) c.push({ l: 'Glucides / h', v: String(m.carbPerH), u: 'g' })
      if (m) c.push({ l: 'Écart glucides', v: `${m.carbGap > 0 ? '+' : m.carbGap < 0 ? '−' : ''}${Math.abs(m.carbGap)}`, u: 'g', st: carbGapState(m.carbGap) })
      if (d.fuel) c.push({ l: 'Prochain rappel', v: d.fuel.s < 60 ? `${Math.round(d.fuel.s)} s` : `${Math.ceil(d.fuel.s / 60)} min` })
      if (m) { c.push({ l: 'Brûlés', v: String(m.carbBurned), u: 'g' }); c.push({ l: 'Mangés', v: String(m.carbEaten), u: 'g' }) }
      return c.length ? { lab: 'Nutrition', cells: c } : { lab: 'Nutrition', empty: '--' }
    }
    case 'time': return { lab: 'Roulage', val: hms(d.t) }
    case 'dist': return { lab: 'Distance', val: nf1(d.km), unit: 'km', sub: d.total ? [`reste ${nf1(Math.max(0, d.total - d.km))} km`] : [] }
    case 'clock': return { lab: 'Heure', val: hhmm(d.now) }
    case 'cad': return { lab: 'Cadence', val: d.cad == null ? '--' : nf0(d.cad), unit: 'rpm' }
    case 'speed': return o.avg ? { lab: 'Vitesse moyenne', val: nf1(d.vAvg), unit: 'km/h' } : { lab: 'Vitesse', val: nf1(d.speed), unit: 'km/h' }
    default: return { lab: k, empty: '--' }
  }
}

/** Forme d'un widget : détermine la mise en page. */
export type Shape = 'wide' | 'tall' | 'sq'
export const shapeOf = (w: number, h: number): Shape => (w > h ? 'wide' : h > w ? 'tall' : 'sq')

/** Le rendu s'adapte : large = valeur à gauche et détails à droite ; haut = valeur en haut et jauge dessous ; carré = valeur centrée, détails en bas. */
export function TileView({ t, w, h }: { t: Tile; w: number; h: number }) {
  const shape = shapeOf(w, h), roomy = w * h >= 4
  if (t.empty) return <div className={`tl tl-${shape}`}><div className="lab">{t.lab}</div><div className="sub dim">{t.empty}</div></div>

  if (t.bars) {
    if (w * h <= 3 && shape !== 'tall') {
      // Compact : une barre empilée et la zone en cours en texte.
      const now = t.bars.find(b => b.now)
      return (
        <div className={`tl tl-${shape}`}>
          <div className="lab">{t.lab}</div>
          <div className="zstack" aria-hidden="true">{t.bars.map(b => <i key={b.l} style={{ flex: Math.max(0.02, b.v), background: b.c, outline: b.now ? '2px solid var(--d-ink)' : undefined }} />)}</div>
          {now && <div className="sub"><b>{now.l}</b> · {now.t}</div>}
        </div>
      )
    }
    return (
      <div className={`tl tl-${shape}`}>
        <div className="lab">{t.lab}</div>
        <div className="bars">{t.bars.map(b => (
          <div className={`bar${b.now ? ' now' : ''}`} key={b.l}><span className="bl">{b.l}</span><span className="bt"><i style={{ width: `${Math.max(2, b.v * 100)}%`, background: b.c }} /></span><span className="bv">{roomy || shape === 'tall' ? b.t : ''}</span></div>
        ))}</div>
      </div>
    )
  }

  if (t.cells) {
    // Autant de valeurs que la place le permet, les plus utiles d'abord.
    const cap = Math.min(9, Math.max(3, Math.round(w * h * 1.5))), cells = t.cells.slice(0, cap)
    const cols = h === 1 ? Math.min(cells.length, w <= 2 ? 3 : 4) : w >= 3 ? 3 : 2
    return (
      <div className="tl tl-cells">
        <div className="lab">{t.lab}</div>
        <div className="cells" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>{cells.map(c => (
          <div className="cell" key={c.l}><span className="cl">{c.l}</span><b className={c.st ? `st-${c.st}` : undefined}>{c.v}{c.u && <small>{c.u}</small>}</b></div>
        ))}</div>
      </div>
    )
  }

  if (t.pair) {
    return (
      <div className={`tl tl-${shape} pair`}>
        <div className="lab">{t.lab}</div>
        <div className="pr">{t.pair.map(p => (
          <div className="pi" key={p.l}><span className="sub dim">{p.l}</span><b className="pval">{p.v}</b><span className="gbar" aria-hidden="true"><i style={{ width: `${pct(p.g) * 100}%` }} /></span></div>
        ))}</div>
      </div>
    )
  }

  if (t.steps && (w >= 4 || h >= 2)) {
    return (
      <div className="tl tl-climb">
        <div className="lab">{t.lab}</div>
        <div className="cl-top"><div className={`val${t.st ? ` st-${t.st}` : ''}`}>{t.val}<small>{t.unit}</small></div><div className="cl-sub">{t.sub?.map((x, i) => <div className={`sub${i ? ' dim' : ''}`} key={x}>{x}</div>)}</div></div>
        {t.gauge && <span className="gbar" aria-hidden="true"><i style={{ width: `${pct(t.gauge.v) * 100}%` }} /></span>}
        <div className="steps" aria-hidden="true">{t.steps.map((s, i) => <i key={i} style={{ flex: s.len, height: `${20 + Math.min(80, s.grade * 7)}%`, background: gradeColor(s.grade) }} />)}</div>
      </div>
    )
  }
  const showSub = shape !== 'sq' || h >= 2 || w >= 2 || !!t.sub?.length && w * h >= 2
  return (
    <div className={`tl tl-${shape}`}>
      <div className="tl-main">
        <div className="lab">{t.lab}</div>
        <div className={`val${t.st ? ` st-${t.st}` : ''}`}>{t.val}{t.unit && <small>{t.unit}</small>}</div>
      </div>
      <div className="tl-side">
        {showSub && t.sub?.map((s, i) => <div className={`sub${i ? ' dim' : ''}`} key={s}>{s}</div>)}
        {t.gauge && (shape !== 'wide' || roomy || h >= 1) && <span className={`gbar${t.st ? ` g-${t.st}` : ''}`} aria-hidden="true"><i style={{ width: `${pct(t.gauge.v) * 100}%` }} />{t.gauge.zone && <b style={{ left: `${t.gauge.zone[0] * 100}%`, width: `${(t.gauge.zone[1] - t.gauge.zone[0]) * 100}%` }} />}</span>}
        {t.steps && (w >= 4 || h >= 2) && (
          <div className="steps" aria-hidden="true">{t.steps.map((s, i) => <i key={i} style={{ flex: s.len, height: `${20 + Math.min(80, s.grade * 7)}%`, background: gradeColor(s.grade) }} />)}</div>
        )}
      </div>
    </div>
  )
}

/* ---- Widgets dessinés sur mesure : ils remplissent toute leur case. ---- */


/** Zone en cours : grand numéro, fond teinté de la couleur de la zone. */
export function ZoneNowView({ d, w }: { d: WidgetData; w: number }) {
  const m = d.m, zdefs = d.source === 'power' ? POWER_ZONES : HR_ZONES
  if (!m || m.zoneNow < 0) return <div className="tl"><div className="lab">Zone</div><div className="sub dim">--</div></div>
  const z = zdefs[m.zoneNow], since = mmss(Math.max(0, d.t - m.zoneSince))
  return (
    <div className={`zn${w > 1 ? ' wide' : ''}`} style={{ '--zc': z.c } as React.CSSProperties}>
      {w === 1 && <div className="lab">Zone</div>}
      <div className="zn-n">Z{m.zoneNow + 1}</div>
      {w > 1 ? <div className="zn-t"><b>{z.l}</b><span>depuis {since}</span></div> : <div className="zn-s">{since}</div>}
    </div>
  )
}

/** Temps par zone : colonnes (2×1), barre unique et légende (3×1 et plus large), barres épaisses (haut ou grand). */
export function ZonesView({ d, w, h }: { d: WidgetData; w: number; h: number }) {
  const m = d.m, zdefs = d.source === 'power' ? POWER_ZONES : HR_ZONES
  if (!m) return <div className="tl"><div className="lab">Temps par zone</div><div className="sub dim">--</div></div>
  const tot = m.zones.reduce((a, b) => a + b, 0), max = Math.max(1, ...m.zones)
  const name = (i: number) => (i === 4 && d.source === 'power' ? 'Z5+' : `Z${i + 1}`)
  const t = (s: number) => (s >= 3600 ? fdur(s) : `${Math.round(s / 60)}′`)
  if ((h === 1 && w <= 2) || w === 1) {
    return (
      <div className={`zs-cols${w === 1 ? ' narrow' : ''}`}>
        {m.zones.map((s, i) => (
          <div key={i} className={`zs-col${i === m.zoneNow ? ' now' : ''}`}>
            <span className="zs-area"><span className="zs-v" style={{ bottom: `${Math.max(3, (s / max) * 100)}%` }}>{t(s)}</span><i style={{ height: `${Math.max(3, (s / max) * 100)}%`, background: zdefs[i].c }} /></span>
            <b>{name(i)}</b>
          </div>
        ))}
      </div>
    )
  }
  if (h === 1) {
    return (
      <div className="zs-line">
        <div className="zs-head"><span className="lab">Temps par zone</span><span className="lab">{fdur(tot)}</span></div>
        <div className="zs-stack">{m.zones.map((s, i) => <i key={i} className={i === m.zoneNow ? 'now' : undefined} style={{ flex: Math.max(0.01, s), background: zdefs[i].c }} />)}</div>
        <div className="zs-leg">{m.zones.map((s, i) => <span key={i} className={i === m.zoneNow ? 'now' : undefined}>{name(i)} {t(s)}</span>)}</div>
      </div>
    )
  }
  return (
    <div className="zs-bars">
      <div className="lab">Temps par zone</div>
      <div className="zs-grid">
        {m.zones.map((s, i) => (
          <div key={i} className={`zs-row${i === m.zoneNow ? ' now' : ''}`}>
            <b>{name(i)}</b><span className="zs-track"><i style={{ width: `${Math.max(2, (s / max) * 100)}%`, background: zdefs[i].c }} /></span><span>{t(s)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Dans la cible : grand pourcentage, barre en trois couleurs (dessous, dedans, dessus). */
export function InTargetView({ d, w }: { d: WidgetData; w: number }) {
  const m = d.m
  if (!m || m.inTarget == null) return <div className="tl"><div className="lab">Dans la cible</div><div className="sub dim">--</div></div>
  const tot = m.under + m.inT + m.over || 1, pu = Math.round((m.under / tot) * 100), po = Math.round((m.over / tot) * 100)
  const bar = <div className="it-bar"><i className="lo" style={{ flex: Math.max(0.01, m.under) }} /><i className="ok" style={{ flex: Math.max(0.01, m.inT) }} /><i className="hi" style={{ flex: Math.max(0.01, m.over) }} /></div>
  return (
    <div className={`it${w > 1 ? ' wide' : ''}`}>
      <div className="it-main"><div className="lab">Dans la cible</div><div className={`val st-${inTargetState(m.inTarget)}`}>{m.inTarget}<small>%</small></div>{w === 1 && bar}</div>
      {w > 1 && <div className="it-side">{bar}<span className="st-lo">▾ {pu} % dessous</span><span className="st-warn">▴ {po} % dessus</span></div>}
    </div>
  )
}

/** Punch et endurance : deux lignes (2×1) ou deux blocs empilés (haut ou grand), en couleur. */
export function ReserveView({ d, w, h }: { d: WidgetData; w: number; h: number }) {
  const m = d.m
  if (!m || m.punch == null || m.endurance == null) return <div className="tl"><div className="lab">Punch et endurance</div><div className="sub dim">{m ? 'Puissance requise' : '--'}</div></div>
  const items = [{ l: 'Punch', v: m.punch }, { l: 'Endurance', v: m.endurance }]
  if (h === 1) {
    return (
      <div className="rv-lines">
        {items.map(x => (
          <div key={x.l} className={`rv-line st-${reserveState(x.v)}`}><span className="lab">{x.l}</span><b className="val">{x.v}<small>%</small></b><span className="rv-track"><i style={{ width: `${x.v}%` }} /></span></div>
        ))}
      </div>
    )
  }
  return (
    <div className={`rv-blocks${w === 1 ? ' narrow' : ''}`}>
      {items.map(x => (
        <div key={x.l} className={`rv-block st-${reserveState(x.v)}`}>
          <div className="rv-head"><span className="lab">{x.l}</span>{w > 1 && <span className="rv-st">{reserveWord(x.v)}</span>}</div>
          <b className="val">{x.v}<small>%</small></b>
          <span className="rv-track"><i style={{ width: `${x.v}%` }} /></span>
        </div>
      ))}
    </div>
  )
}
