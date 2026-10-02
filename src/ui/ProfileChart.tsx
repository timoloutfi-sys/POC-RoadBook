import { useEffect, useMemo, useRef, useState } from 'react'
import { nf0, nf1, slope } from '../core/format'
import { gradeAt, type Route } from '../route/route'
import { POINT_TYPES, type RoutePoint, type Section } from '../strategy/types'
import { Icon } from './icons'

const H = 220, PL = 46, PR = 12, PT = 30, PB = 24, MINI_H = 40

/** Plus petit pas « rond » qui donne au plus `max` repères. */
const niceStep = (span: number, max: number) => [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(s => span / s <= max) ?? 1000
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/**
 * Profil d'altitude en pixels réels, avec échelles en m et en km, sections et points.
 * Zoom : molette avec ⌘/Ctrl ou pincement à deux doigts, boutons + et −, mini-vue pour se déplacer.
 * Survol ou glissement : lecture km, altitude, pente. Glisser un point le déplace. Appui long : ajouter.
 */
export function ProfileChart({ route, sections, points = [], onLongPress, onMove, onTapPoint }: {
  route: Route; sections: Section[]; points?: RoutePoint[]; onLongPress?: (km: number) => void
  onMove?: (id: string, km: number) => void; onTapPoint?: (id: string) => void
}) {
  const L = route.total / 1000
  const minSpan = Math.min(L, Math.max(0.5, L / 300))
  const box = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [W, setW] = useState(360)
  const [view, setViewState] = useState<[number, number]>([0, L])
  const viewRef = useRef(view)
  viewRef.current = view
  const [a, b] = view, span = b - a, zoomed = span < L * 0.995

  const setView = (na: number, nb: number) => {
    const sp = clamp(nb - na, minSpan, L), s = clamp(na, 0, L - sp)
    setViewState([s, s + sp])
  }
  useEffect(() => { setViewState([0, L]) }, [route, L])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(200, el.clientWidth)))
    ro.observe(el)
    setW(Math.max(200, el.clientWidth))
    return () => ro.disconnect()
  }, [])

  const plotW = W - PL - PR
  const kmRaw = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect(), [va, vb] = viewRef.current
    return va + ((clientX - r.left - PL) / plotW) * (vb - va)
  }
  const kmAt = (clientX: number) => Math.round(clamp(kmRaw(clientX), 0, L) * 10) / 10
  const zoomAt = (factor: number, centerKm: number) => {
    const [va, vb] = viewRef.current, sp = clamp((vb - va) * factor, minSpan, L)
    const na = centerKm - ((centerKm - va) / (vb - va)) * sp
    setView(na, na + sp)
  }

  // Molette : ⌘/Ctrl (et pincement du pavé tactile) zoome autour du curseur, le défilement horizontal déplace.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const h = (e: WheelEvent) => {
      const [va, vb] = viewRef.current
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(Math.exp(clamp(e.deltaY, -80, 80) * 0.01), kmRaw(e.clientX)) }
      else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && vb - va < L * 0.995) { e.preventDefault(); const d = (e.deltaX / plotW) * (vb - va); setView(va + d, vb + d) }
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  })

  // Échelle d'altitude recalée sur la partie visible.
  const g = useMemo(() => {
    const i0 = clamp(Math.floor((a * 1000) / 50), 0, route.n - 1), i1 = clamp(Math.ceil((b * 1000) / 50), 0, route.n - 1)
    let lo = Infinity, hi = -Infinity
    for (let i = i0; i <= i1; i++) { lo = Math.min(lo, route.ele[i]); hi = Math.max(hi, route.ele[i]) }
    const eStep = niceStep(Math.max(hi - lo, 20), 4)
    lo = Math.floor(lo / eStep) * eStep
    hi = Math.max(Math.ceil(hi / eStep) * eStep, lo + eStep * 2)
    return { lo, hi, eStep, i0, i1 }
  }, [route, a, b])
  const X = (km: number) => PL + ((km - a) / span) * plotW
  const Y = (e: number) => PT + (1 - (e - g.lo) / (g.hi - g.lo)) * (H - PT - PB)
  const stride = Math.max(1, Math.floor((g.i1 - g.i0) / (W * 1.2)))
  let path = ''
  for (let i = Math.max(0, g.i0 - 1); i <= Math.min(route.n - 1, g.i1 + 1); i += stride) path += `${path ? 'L' : 'M'}${X((i * 50) / 1000).toFixed(1)},${Y(route.ele[i]).toFixed(1)}`
  const area = `${path}L${X(Math.min(L, ((g.i1 + 1) * 50) / 1000))},${H - PB}L${X(Math.max(0, ((g.i0 - 1) * 50) / 1000))},${H - PB}Z`
  const eTicks: number[] = []
  for (let e = g.lo; e <= g.hi + 0.1; e += g.eStep) eTicks.push(e)
  const kStep = niceStep(span, Math.max(3, Math.floor(plotW / 70)))
  const kTicks: number[] = []
  for (let k = Math.ceil(a / kStep - 1e-9) * kStep; k <= b + 1e-9; k += kStep) kTicks.push(+k.toFixed(2))

  const markers = [...points].filter(p => p.km >= a - 0.01 && p.km <= b + 0.01).sort((p, q) => p.km - q.km).reduce<{ p: RoutePoint; x: number; row: number }[]>((acc, p) => {
    const x = X(p.km), prev = acc[acc.length - 1]
    acc.push({ p, x, row: prev && x - prev.x < 22 ? 1 - prev.row : 0 })
    return acc
  }, [])

  const [cursor, setCursor] = useState<number | null>(null)
  const hideT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scrub = useRef(false)
  const press = useRef<{ x: number; t: ReturnType<typeof setTimeout> } | null>(null)
  const drag = useRef<{ id: string; x0: number; moved: boolean } | null>(null)
  const pointers = useRef(new Map<number, number>())
  const pinch = useRef<{ d0: number; kc: number; span0: number } | null>(null)
  const pan = useRef<{ x0: number; a0: number } | null>(null)
  const cancel = () => { if (press.current) clearTimeout(press.current.t); press.current = null }
  const ids = () => [...pointers.current.values()]

  const miniX = (km: number) => (km / L) * W
  const miniPath = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < route.n; i++) { lo = Math.min(lo, route.ele[i]); hi = Math.max(hi, route.ele[i]) }
    const st = Math.max(1, Math.floor(route.n / 400))
    let p = ''
    for (let i = 0; i < route.n; i += st) p += `${p ? 'L' : 'M'}${((i / (route.n - 1)) * 1000).toFixed(1)},${(4 + (1 - (route.ele[i] - lo) / Math.max(1, hi - lo)) * (MINI_H - 8)).toFixed(1)}`
    return p
  }, [route])
  const mini = useRef<{ off: number } | null>(null)
  const miniKm = (e: React.PointerEvent) => ((e.clientX - e.currentTarget.getBoundingClientRect().left) / W) * L

  return (
    <div ref={box} style={{ width: '100%' }}>
      <svg ref={svg} width={W} height={H} style={{ display: 'block', touchAction: 'pan-y', userSelect: 'none' }} role="img"
        aria-label={`Profil du parcours, ${nf0(L)} km. Zoom avec la molette et ⌘, ou deux doigts.`}
        onPointerDown={e => {
          pointers.current.set(e.pointerId, e.clientX)
          const xs = ids()
          if (xs.length === 2) {
            cancel(); scrub.current = false; setCursor(null); pan.current = null
            pinch.current = { d0: Math.max(10, Math.abs(xs[0] - xs[1])), kc: kmRaw((xs[0] + xs[1]) / 2), span0: viewRef.current[1] - viewRef.current[0] }
            return
          }
          if (e.pointerType === 'mouse' && zoomed) pan.current = { x0: e.clientX, a0: viewRef.current[0] }
          if (!onLongPress) return
          const x = e.clientX
          press.current = { x, t: setTimeout(() => { navigator.vibrate?.(40); onLongPress(kmAt(x)); press.current = null }, 500) }
        }}
        onPointerMove={e => {
          if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, e.clientX)
          const xs = ids()
          if (pinch.current && xs.length === 2) {
            const d = Math.max(10, Math.abs(xs[0] - xs[1])), sp = clamp(pinch.current.span0 * (pinch.current.d0 / d), minSpan, L)
            const r = svg.current!.getBoundingClientRect(), cx = (xs[0] + xs[1]) / 2
            const na = pinch.current.kc - ((cx - r.left - PL) / plotW) * sp
            setView(na, na + sp)
            return
          }
          if (pan.current && e.buttons === 1) {
            const dx = e.clientX - pan.current.x0
            if (Math.abs(dx) > 4) { cancel(); const na = pan.current.a0 - (dx / plotW) * span; setView(na, na + span) }
            return
          }
          if (press.current && Math.abs(e.clientX - press.current.x) > 10) {
            cancel(); scrub.current = true; clearTimeout(hideT.current)
            ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
          }
          if (scrub.current) setCursor(kmAt(e.clientX))
          else if (e.pointerType === 'mouse' && e.buttons === 0) { clearTimeout(hideT.current); setCursor(kmAt(e.clientX)) }
        }}
        onPointerLeave={e => { if (e.pointerType === 'mouse') setCursor(null) }}
        onPointerUp={e => {
          pointers.current.delete(e.pointerId)
          if (ids().length < 2) pinch.current = null
          pan.current = null
          cancel()
          if (scrub.current) { scrub.current = false; hideT.current = setTimeout(() => setCursor(null), 1500) }
        }}
        onPointerCancel={e => { pointers.current.delete(e.pointerId); pinch.current = null; pan.current = null; cancel(); scrub.current = false; setCursor(null) }}
        onContextMenu={e => e.preventDefault()}>
        <defs><clipPath id="plot"><rect x={PL} y={0} width={plotW} height={H - PB + 1} /></clipPath></defs>
        {eTicks.map(e => <g key={e}><line x1={PL} x2={W - PR} y1={Y(e)} y2={Y(e)} stroke="var(--line)" strokeWidth={1} /><text x={PL - 6} y={Y(e) + 4} textAnchor="end" fontSize={12} fill="var(--muted)">{nf0(e)} m</text></g>)}
        {kTicks.map(k => <g key={k}><line x1={X(k)} x2={X(k)} y1={H - PB} y2={H - PB + 4} stroke="var(--muted)" /><text x={X(k)} y={H - 6} textAnchor={X(k) < PL + 16 ? 'start' : 'middle'} fontSize={12} fill="var(--muted)">{kStep < 1 ? nf1(k) : nf0(k)} km</text></g>)}
        <g clipPath="url(#plot)">
          {sections.filter(s => s.b > a && s.a < b && (s.mark || s.locked || s.kind === 'montee')).map(s => <rect key={s.id} x={X(s.a)} width={Math.max(3, X(s.b) - X(s.a))} y={PT} height={H - PT - PB} fill={s.locked ? 'rgba(242,194,0,.28)' : s.kind === 'montee' ? 'rgba(255,107,90,.2)' : 'rgba(77,163,255,.2)'} />)}
          <path d={area} fill="rgba(242,194,0,.16)" />
          <path d={path} fill="none" stroke="var(--accent-fg)" strokeWidth={2.5} strokeLinejoin="round" />
        </g>
        {cursor != null && cursor >= a && cursor <= b && (() => {
          const i = Math.min(route.n - 1, Math.round((cursor * 1000) / 50)), x = X(cursor), y = Y(route.ele[i])
          const near = markers.find(m => Math.abs(m.x - x) < 12)
          const label = near
            ? `${near.p.text || POINT_TYPES[near.p.type].n} · km ${nf1(near.p.km)}`
            : `km ${nf1(cursor)} · ${nf0(route.ele[i])} m · ${slope(gradeAt(route, cursor * 1000))}`
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
      <div className="row" style={{ justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
        {zoomed && <button className="btn ghost" style={{ minHeight: 40 }} onClick={() => setView(0, L)}>Tout</button>}
        <button className="iconbtn" aria-label="Zoom arrière" disabled={!zoomed} onClick={() => zoomAt(2, (a + b) / 2)}><Icon name="minus" /></button>
        <button className="iconbtn" aria-label="Zoom avant" disabled={span <= minSpan * 1.01} onClick={() => zoomAt(0.5, (a + b) / 2)}><Icon name="plus" /></button>
      </div>
      {zoomed && (
        <svg width={W} height={MINI_H} style={{ display: 'block', touchAction: 'none', cursor: 'grab' }} aria-label="Vue d'ensemble : déplace la fenêtre"
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId)
            const km = miniKm(e)
            mini.current = { off: km >= a && km <= b ? km - a : span / 2 }
            if (!(km >= a && km <= b)) setView(km - span / 2, km + span / 2)
          }}
          onPointerMove={e => { if (mini.current) { const na = miniKm(e) - mini.current.off; setView(na, na + span) } }}
          onPointerUp={() => { mini.current = null }} onPointerCancel={() => { mini.current = null }}>
          <svg x={0} y={0} width={W} height={MINI_H} viewBox={`0 0 1000 ${MINI_H}`} preserveAspectRatio="none">
            <path d={`${miniPath}L1000,${MINI_H}L0,${MINI_H}Z`} fill="rgba(242,194,0,.2)" />
            <path d={miniPath} fill="none" stroke="var(--accent-fg)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </svg>
          <rect x={miniX(a)} y={1} width={Math.max(6, miniX(b) - miniX(a))} height={MINI_H - 2} rx={6} fill="rgba(77,163,255,.22)" stroke="var(--ink)" strokeWidth={1.5} />
        </svg>
      )}
    </div>
  )
}
