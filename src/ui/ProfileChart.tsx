import { useEffect, useMemo, useRef, useState } from 'react'
import { nf0, nf1, slope } from '../core/format'
import { gradeAt, type Route } from '../route/route'
import type { RoutePoint, Section } from '../strategy/types'
import { Icon } from './icons'

const H = 220, PL = 46, PR = 12, PT = 30, PB = 24

/** Plus petit pas « rond » qui donne au plus `max` repères. */
const niceStep = (span: number, max: number) => [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(s => span / s <= max) ?? 1000

/**
 * Profil d'altitude en pixels réels (pas de déformation du texte), avec échelle en m et en km,
 * sections surlignées et points posés sur la courbe. Un appui long place un point ou une section.
 */
export function ProfileChart({ route, sections, points = [], onLongPress, onMove, onTapPoint }: {
  route: Route; sections: Section[]; points?: RoutePoint[]; onLongPress?: (km: number) => void
  /** Un point glissé suit le doigt ; un simple toucher appelle onTapPoint. */
  onMove?: (id: string, km: number) => void; onTapPoint?: (id: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [W, setW] = useState(360)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(200, el.clientWidth)))
    ro.observe(el)
    setW(Math.max(200, el.clientWidth))
    return () => ro.disconnect()
  }, [])

  const L = route.total / 1000
  const g = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < route.n; i++) { lo = Math.min(lo, route.ele[i]); hi = Math.max(hi, route.ele[i]) }
    const eStep = niceStep(Math.max(hi - lo, 40), 4)
    lo = Math.floor(lo / eStep) * eStep
    hi = Math.max(Math.ceil(hi / eStep) * eStep, lo + eStep * 2)
    return { lo, hi, eStep }
  }, [route])
  const X = (km: number) => PL + (km / L) * (W - PL - PR)
  const Y = (e: number) => PT + (1 - (e - g.lo) / (g.hi - g.lo)) * (H - PT - PB)
  const stride = Math.max(1, Math.floor(route.n / (W * 1.2)))
  let path = ''
  for (let i = 0; i < route.n; i += stride) path += `${path ? 'L' : 'M'}${X((i * 50) / 1000).toFixed(1)},${Y(route.ele[i]).toFixed(1)}`
  const area = `${path}L${X(L)},${H - PB}L${PL},${H - PB}Z`
  const eTicks: number[] = []
  for (let e = g.lo; e <= g.hi + 0.1; e += g.eStep) eTicks.push(e)
  const kStep = niceStep(L, Math.max(3, Math.floor((W - PL) / 70)))
  const kTicks: number[] = []
  for (let k = 0; k <= L; k += kStep) kTicks.push(k)

  // Points : icône en haut du trait, sur deux rangées quand ils se touchent.
  const markers = [...points].sort((a, b) => a.km - b.km).reduce<{ p: RoutePoint; x: number; row: number }[]>((acc, p) => {
    const x = X(p.km), prev = acc[acc.length - 1]
    acc.push({ p, x, row: prev && x - prev.x < 22 ? 1 - prev.row : 0 })
    return acc
  }, [])

  const kmAt = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect()
    return Math.max(0, Math.min(L, Math.round((((clientX - r.left - PL) / (W - PL - PR)) * L) * 10) / 10))
  }
  const [cursor, setCursor] = useState<number | null>(null)
  const hideT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scrub = useRef(false)
  const press = useRef<{ x: number; t: ReturnType<typeof setTimeout> } | null>(null)
  const drag = useRef<{ id: string; x0: number; moved: boolean } | null>(null)
  const cancel = () => { if (press.current) clearTimeout(press.current.t); press.current = null }
  return (
    <div ref={box} style={{ width: '100%' }}>
      <svg ref={svg} width={W} height={H} style={{ display: 'block', touchAction: 'pan-y', userSelect: 'none' }} role="img"
        aria-label={`Profil du parcours, ${nf0(L)} km, de ${nf0(g.lo)} à ${nf0(g.hi)} m. Appui long pour ajouter un point.`}
        onPointerDown={e => {
          if (!onLongPress) return
          const x = e.clientX
          press.current = { x, t: setTimeout(() => { navigator.vibrate?.(40); onLongPress(kmAt(x)); press.current = null }, 500) }
        }}
        onPointerMove={e => {
          if (press.current && Math.abs(e.clientX - press.current.x) > 10) {
            cancel(); scrub.current = true; clearTimeout(hideT.current)
            ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
          }
          if (scrub.current) setCursor(kmAt(e.clientX))
        }}
        onPointerUp={() => { cancel(); if (scrub.current) { scrub.current = false; hideT.current = setTimeout(() => setCursor(null), 1500) } }}
        onPointerCancel={() => { cancel(); scrub.current = false; setCursor(null) }} onContextMenu={e => e.preventDefault()}>
        {eTicks.map(e => <g key={e}><line x1={PL} x2={W - PR} y1={Y(e)} y2={Y(e)} stroke="var(--line)" strokeWidth={1} /><text x={PL - 6} y={Y(e) + 4} textAnchor="end" fontSize={12} fill="var(--muted)">{nf0(e)} m</text></g>)}
        {kTicks.map(k => <g key={k}><line x1={X(k)} x2={X(k)} y1={H - PB} y2={H - PB + 4} stroke="var(--muted)" /><text x={X(k)} y={H - 6} textAnchor={k === 0 ? 'start' : 'middle'} fontSize={12} fill="var(--muted)">{k} km</text></g>)}
        {sections.map(s => <rect key={s.id} x={X(s.a)} width={Math.max(3, X(s.b) - X(s.a))} y={PT} height={H - PT - PB} fill={s.kind === 'montee' ? 'rgba(255,107,90,.2)' : 'rgba(77,163,255,.2)'} />)}
        <path d={area} fill="rgba(242,194,0,.16)" />
        <path d={path} fill="none" stroke="var(--accent-fg)" strokeWidth={2.5} strokeLinejoin="round" />
        {cursor != null && (() => {
          const i = Math.min(route.n - 1, Math.round((cursor * 1000) / 50)), x = X(cursor), y = Y(route.ele[i])
          const label = `km ${nf1(cursor)} · ${nf0(route.ele[i])} m · ${slope(gradeAt(route, cursor * 1000))}`
          const w = label.length * 7.4 + 18, cx = Math.max(PL + w / 2, Math.min(W - PR - w / 2, x))
          return (
            <g pointerEvents="none">
              <line x1={x} x2={x} y1={PT} y2={H - PB} stroke="var(--ink)" strokeWidth={1.5} />
              <circle cx={x} cy={y} r={5} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
              <rect x={cx - w / 2} y={PT + 4} width={w} height={26} rx={8} fill="var(--ink)" />
              <text x={cx} y={PT + 22} textAnchor="middle" fontSize={14} fontWeight={600} fill="var(--bg)">{label}</text>
            </g>
          )
        })()}
        {markers.map(({ p, x, row }) => {
          const col = p.type === 'danger' ? 'var(--danger)' : 'var(--ink)'
          return (
            <g key={p.id} style={{ color: col, touchAction: 'none', cursor: onMove ? 'grab' : undefined }}
              onPointerDown={e => {
                if (!onMove) return
                e.stopPropagation(); cancel()
                ;(e.currentTarget as SVGGElement).setPointerCapture(e.pointerId)
                drag.current = { id: p.id, x0: e.clientX, moved: false }
              }}
              onPointerMove={e => {
                const d = drag.current
                if (!d || d.id !== p.id) return
                if (!d.moved && Math.abs(e.clientX - d.x0) < 5) return
                d.moved = true
                onMove?.(p.id, kmAt(e.clientX))
              }}
              onPointerUp={e => {
                const d = drag.current
                drag.current = null
                e.stopPropagation()
                if (d && !d.moved) onTapPoint?.(p.id)
              }}
              onPointerCancel={() => { drag.current = null }}>
              <rect x={x - 18} y={PT - 20} width={36} height={H - PB - PT + 20} fill="transparent" />
              <line x1={x} x2={x} y1={PT - 2} y2={H - PB} stroke={col} strokeWidth={1.5} strokeDasharray="4 3" />
              <circle cx={x} cy={Y(route.ele[Math.min(route.n - 1, Math.round((p.km * 1000) / 50))])} r={4} fill={col} />
              <g transform={`translate(${x - 9},${row ? 2 : 10})`}><rect x={-2} y={-2} width={22} height={22} rx={6} fill="var(--surface)" stroke={col} /><Icon name={p.type} size={18} /></g>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
