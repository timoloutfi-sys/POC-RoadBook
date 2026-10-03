import { useState } from 'react'
import { nf0, nf1 } from '../core/format'
import type { SeriesPoint } from '../library/analysis'

const W = 600, H = 200, PAD = 4

/** Profil de la sortie : altitude en fond, cible en bande, réel en trait. Le toucher donne les valeurs au km. */
export function RideChart({ series, unit }: { series: SeriesPoint[]; unit: 'W' | 'bpm' }) {
  const [at, setAt] = useState<number | null>(null)
  if (series.length < 2) return null
  const kmMax = series[series.length - 1].km
  const x = (km: number) => PAD + (km / kmMax) * (W - 2 * PAD)
  const vals = series.flatMap(p => [p.value, p.lo, p.hi]).filter((v): v is number => v != null)
  const vMax = Math.max(...vals, 1) * 1.08, vMin = Math.min(...vals, vMax) * 0.9
  const y = (v: number) => H - PAD - ((v - vMin) / (vMax - vMin)) * (H - 2 * PAD)
  const eles = series.map(p => p.ele).filter((v): v is number => v != null)
  const eMin = Math.min(...eles), eMax = Math.max(...eles, eMin + 30)
  const ye = (e: number) => H - PAD - ((e - eMin) / (eMax - eMin)) * (H - 2 * PAD) * 0.6
  const eleD = eles.length ? `M${x(series[0].km)} ${H}` + series.map(p => (p.ele != null ? `L${x(p.km)} ${ye(p.ele)}` : '')).join('') + `L${x(kmMax)} ${H}Z` : ''
  const withBand = series.filter(p => p.lo != null && p.hi != null)
  const band = withBand.length > 1 ? 'M' + withBand.map(p => `${x(p.km)} ${y(p.hi!)}`).join('L') + 'L' + [...withBand].reverse().map(p => `${x(p.km)} ${y(p.lo!)}`).join('L') + 'Z' : ''
  let line = '', pen = false
  for (const p of series) { if (p.value == null) { pen = false; continue } line += `${pen ? 'L' : 'M'}${x(p.km)} ${y(p.value)}`; pen = true }
  const cur = at != null ? series[at] : null
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const km = ((e.clientX - r.left) / r.width) * kmMax
    let best = 0
    for (let i = 1; i < series.length; i++) if (Math.abs(series[i].km - km) < Math.abs(series[best].km - km)) best = i
    setAt(best)
  }
  const ticks = Array.from({ length: Math.min(6, Math.floor(kmMax / 5) + 1) }, (_, i) => Math.round(((i + 1) * kmMax) / (Math.min(6, Math.floor(kmMax / 5) + 1) + 1)))
  return (
    <div className="ridechart">
      <div className="rc-read" aria-live="polite">
        {cur ? <>km {nf1(cur.km)} · <b>{cur.value != null ? `${nf0(cur.value)} ${unit}` : '–'}</b>{cur.lo != null && ` · cible ${nf0(cur.lo)}–${nf0(cur.hi!)}`}</> : 'Touche le profil pour lire un point'}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} onPointerDown={move} onPointerMove={e => e.buttons || e.pointerType === 'mouse' ? move(e) : undefined} onPointerLeave={() => setAt(null)} role="img" aria-label="Profil de la sortie">
        <path className="rc-ele" d={eleD} />
        {band && <path className="rc-band" d={band} />}
        <path className="rc-line" d={line} />
        {ticks.map(k => <text key={k} x={x(k)} y={H - 6} className="rc-tick">{k}</text>)}
        {cur && <line className="rc-cur" x1={x(cur.km)} x2={x(cur.km)} y1={0} y2={H} />}
      </svg>
      <div className="rc-legend"><span className="lg line" />Réel<span className="lg band" />Cible<span className="lg ele" />Altitude</div>
    </div>
  )
}
