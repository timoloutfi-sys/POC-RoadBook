import { fdur, hhmm, hms, nf0, nf1 } from '../core/format'
import type { WidgetData } from '../ride/data'
import type { WidgetKind } from '../storage/catalog'
import { HR_ZONES, POWER_ZONES } from '../strategy/zones'

/** Ce qu'un widget affiche, indépendamment de sa forme : le rendu s'adapte à l'espace. */
export interface Tile {
  lab: string
  val?: string
  unit?: string
  st?: 'ok' | 'hi' | 'lo'
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
  /** Texte quand il n'y a rien à montrer. */
  empty?: string
}

const gc = (g: number) => (g < 3 ? '#4da3ff' : g < 6 ? '#3ddc84' : g < 9 ? '#ffd21f' : g < 12 ? '#ff8a3d' : '#ff5a36')
export const gradeColor = gc
const pct = (v: number) => Math.min(1, Math.max(0, v))
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

/** Libellé court d'un état de réserve : jamais la couleur seule. */
const reserveState = (v: number) => (v >= 70 ? 'Bonne' : v >= 40 ? 'Moyenne' : 'Faible')
const reserveSt = (v: number): Tile['st'] => (v >= 70 ? 'ok' : v >= 40 ? undefined : 'hi')

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
      return { lab: 'Punch', val: String(m.punch), unit: '%', st: reserveSt(m.punch), sub: [reserveState(m.punch)], gauge: { v: m.punch / 100 } }
    }
    case 'endurance': {
      if (!m || m.endurance == null) return { lab: 'Endurance', empty: '--' }
      return { lab: 'Endurance', val: String(m.endurance), unit: '%', st: reserveSt(m.endurance), sub: [reserveState(m.endurance)], gauge: { v: m.endurance / 100 } }
    }
    case 'reserve': {
      if (!m) return { lab: 'Réserve', empty: '--' }
      if (m.punch == null || m.endurance == null) return { lab: 'Réserve', empty: 'Puissance requise' }
      return { lab: 'Réserve', pair: [{ l: 'Punch', v: `${m.punch} %`, g: m.punch / 100 }, { l: 'Endurance', v: `${m.endurance} %`, g: m.endurance / 100 }] }
    }
    case 'drift': {
      if (!m || m.drift == null) return { lab: 'Dérive cardiaque', empty: d.t < 1800 ? 'Mesure en cours' : '--' }
      const v = m.drift, st: Tile['st'] = v >= 5 ? 'hi' : v >= 3 ? undefined : 'ok'
      return { lab: 'Dérive cardiaque', val: `${v > 0 ? '+' : ''}${nf1(v)}`, unit: '%', st, sub: [v >= 5 ? 'Élevée' : v >= 3 ? 'Moyenne' : 'Faible', 'limite 5 %'], gauge: { v: pct(v / 10), zone: [0, 0.5] } }
    }
    case 'carbs': {
      if (!m || m.carbPerH == null) return { lab: 'Glucides / h', empty: d.t < 300 ? 'Mesure en cours' : '--' }
      return { lab: 'Glucides / h', val: String(m.carbPerH), unit: 'g/h', sub: [`${m.carbBurned} g brûlés`, `${m.carbEaten} g mangés`] }
    }
    case 'carbgap': {
      if (!m) return { lab: 'Écart glucides', empty: '--' }
      const g = m.carbGap, st: Tile['st'] = g > -30 ? 'ok' : g > -60 ? undefined : 'hi'
      return { lab: 'Écart glucides', val: `${g > 0 ? '+' : g < 0 ? '−' : ''}${Math.abs(g)}`, unit: 'g', st, sub: [g >= 0 ? 'En avance' : 'En retard'] }
    }
    case 'lap': {
      if (!m) return { lab: 'Tour', empty: '--' }
      const l = m.lap
      return { lab: `Tour ${m.laps + 1}`, val: mmss(l.dur), sub: [l.p != null ? `${nf0(l.p)} W` : '', l.hr != null ? `${nf0(l.hr)} bpm` : '', `${nf1(l.v)} km/h`].filter(Boolean) }
    }
    case 'slope': {
      if (d.slope == null) return { lab: 'Pente', empty: '--' }
      return { lab: 'Pente', val: nf1(d.slope), unit: '%', st: d.slope >= 8 ? 'hi' : undefined }
    }
    case 'climb': {
      const c = d.climb
      if (!c) return { lab: 'Montée', empty: 'Aucune à venir' }
      const prog = c.state === 'in' ? c.doneM / c.lenM : 0
      return {
        lab: c.state === 'in' ? 'Montée en cours' : 'Prochaine montée', val: nf1(c.toGoKm), unit: 'km',
        sub: [c.state === 'in' ? 'restants' : 'avant la montée', `${nf1(c.lenM / 1000)} km · ${nf1(c.avg)} % · ${nf0(c.gainM)} m de D+`], gauge: { v: prog },
        steps: c.steps.map(s => ({ len: s.lenM, grade: s.grade })),
      }
    }
    case 'arrival': {
      if (!d.arrival) return { lab: 'Arrivée', empty: '--' }
      const left = Math.max(0, d.arrival.valueOf() - d.now.valueOf()) / 1000
      return { lab: 'Arrivée', val: hhmm(d.arrival), sub: [`dans ${fdur(left)}`] }
    }
    case 'sunset': {
      if (!d.sun) return { lab: 'Soleil', empty: '--' }
      const left = Math.max(0, d.sun.at.valueOf() - d.now.valueOf()) / 1000
      return { lab: d.sun.kind === 'set' ? 'Coucher du soleil' : 'Lever du soleil', val: hhmm(d.sun.at), sub: [`dans ${fdur(left)}`] }
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
          <div className="stack" aria-hidden="true">{t.bars.map(b => <i key={b.l} style={{ flex: Math.max(0.02, b.v), background: b.c, outline: b.now ? '2px solid var(--d-ink)' : undefined }} />)}</div>
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

  if (t.pair) {
    return (
      <div className={`tl tl-${shape} pair`}>
        <div className="lab">{t.lab}</div>
        <div className="pr">{t.pair.map(p => (
          <div className="pi" key={p.l}><span className="sub dim">{p.l}</span><b className="pv">{p.v}</b><span className="gbar" aria-hidden="true"><i style={{ width: `${pct(p.g) * 100}%` }} /></span></div>
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
        {t.gauge && (shape !== 'wide' || roomy || h >= 1) && <span className="gbar" aria-hidden="true"><i style={{ width: `${pct(t.gauge.v) * 100}%` }} />{t.gauge.zone && <b style={{ left: `${t.gauge.zone[0] * 100}%`, width: `${(t.gauge.zone[1] - t.gauge.zone[0]) * 100}%` }} />}</span>}
        {t.steps && (w >= 4 || h >= 2) && (
          <div className="steps" aria-hidden="true">{t.steps.map((s, i) => <i key={i} style={{ flex: s.len, height: `${20 + Math.min(80, s.grade * 7)}%`, background: gradeColor(s.grade) }} />)}</div>
        )}
      </div>
    </div>
  )
}
