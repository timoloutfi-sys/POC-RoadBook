import { useMemo, useRef } from 'react'
import { findClimbs, type Route } from '../route/route'

const H = 104, PAD = 6, GRAB = 22

/**
 * Choisir un endroit ou un tronçon sur le profil, sans connaître le kilomètre :
 * toucher une montée la prend en entier, glisser le doigt trace un passage, toucher ailleurs pose un point.
 */
export function ProfilePick({ route, a, b, point, onPick }: {
  route: Route; a: number; b: number; point?: boolean; onPick: (a: number, b: number, climb?: { name: string }) => void
}) {
  const L = route.total / 1000
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; km: number; moved: boolean; other?: number } | null>(null)
  const w = 340
  const climbs = useMemo(() => findClimbs(route), [route])
  const { lo, hi } = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < route.n; i++) { lo = Math.min(lo, route.ele[i]); hi = Math.max(hi, route.ele[i]) }
    return { lo, hi }
  }, [route])
  const span = Math.max(10, hi - lo)
  const X = (km: number) => (km / L) * w
  const Y = (e: number) => H - PAD - ((e - lo) / span) * (H - 2 * PAD)
  const st = Math.max(1, Math.floor(route.n / (w / 2)))
  let d = ''
  for (let i = 0; i < route.n; i += st) d += `${d ? 'L' : 'M'}${X((i * 50) / 1000).toFixed(1)},${Y(route.ele[i]).toFixed(1)}`
  const kmAt = (cx: number) => {
    const r = svg.current!.getBoundingClientRect()
    return Math.round(Math.min(L, Math.max(0, ((cx - r.left) / r.width) * L)) * 10) / 10
  }
  const lowKm = Math.min(a, b), highKm = Math.max(a, b)

  return (
    <svg ref={svg} className="pick" width="100%" height={H} viewBox={`0 0 ${w} ${H}`} preserveAspectRatio="none" role="img"
      aria-label={point ? 'Profil : touche pour choisir l’endroit' : 'Profil : touche une montée ou glisse pour choisir le passage'}
      style={{ touchAction: 'none', display: 'block', background: 'var(--raised)', borderRadius: 10, margin: '4px 0 12px' }}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId)
        const km = kmAt(e.clientX), r = svg.current!.getBoundingClientRect(), px = (k: number) => (k / L) * r.width
        // Tirer une extrémité du tronçon déjà choisi : plus précis que de le retracer.
        const near = (k: number) => Math.abs(px(km) - px(k)) < GRAB
        const edge = !point && highKm > lowKm && (near(lowKm) || near(highKm)) ? (near(lowKm) && (!near(highKm) || Math.abs(km - lowKm) <= Math.abs(km - highKm)) ? 'lo' : 'hi') : null
        drag.current = { x: e.clientX, km, moved: false, other: edge === 'lo' ? highKm : edge === 'hi' ? lowKm : undefined }
        if (edge) drag.current.moved = true
      }}
      onPointerMove={e => {
        const s = drag.current
        if (!s || point) return
        if (s.other != null) { const km = kmAt(e.clientX); onPick(Math.min(km, s.other), Math.max(km, s.other)); return }
        if (!s.moved && Math.abs(e.clientX - s.x) < 8) return
        s.moved = true
        const km = kmAt(e.clientX)
        onPick(Math.min(s.km, km), Math.max(s.km, km))
      }}
      onPointerUp={e => {
        const s = drag.current; drag.current = null
        if (!s || s.moved) return
        const km = kmAt(e.clientX)
        if (point) return onPick(km, km)
        const i = climbs.findIndex(c => km >= c.a && km <= c.b)
        if (i >= 0) return onPick(+climbs[i].a.toFixed(1), +climbs[i].b.toFixed(1), { name: `Montée ${i + 1}` })
        onPick(km, Math.min(L, +(km + Math.max(1, Math.min(5, highKm - lowKm || 2))).toFixed(1)))
      }}>
      {climbs.map((c, i) => <rect key={i} x={X(c.a)} y={0} width={Math.max(2, X(c.b) - X(c.a))} height={H} fill="var(--accent)" opacity=".14" />)}
      <path d={`${d} L${w},${H} L0,${H}Z`} fill="var(--accent)" opacity=".16" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      {point
        ? <line x1={X(a)} x2={X(a)} y1={0} y2={H} stroke="var(--ink)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        : <>
          <rect x={X(lowKm)} y={0} width={Math.max(2, X(highKm) - X(lowKm))} height={H} fill="var(--ink)" opacity=".22" />
          <line x1={X(lowKm)} x2={X(lowKm)} y1={0} y2={H} stroke="var(--ink)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          <line x1={X(highKm)} x2={X(highKm)} y1={0} y2={H} stroke="var(--ink)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </>}
    </svg>
  )
}
