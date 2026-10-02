import { useMemo, useRef } from 'react'
import type { Route } from '../route/route'
import type { Section } from '../strategy/types'

/** Profil d'altitude. Un appui long place un point ou une section à cet endroit. */
export function ProfileChart({ route, sections, onLongPress }: { route: Route; sections: Section[]; onLongPress?: (km: number) => void }) {
  const W = 1000, H = 200, L = route.total / 1000
  const { path, area } = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < route.n; i++) { lo = Math.min(lo, route.ele[i]); hi = Math.max(hi, route.ele[i]) }
    if (hi - lo < 60) { const m = (hi + lo) / 2; lo = m - 30; hi = m + 30 }
    const stride = Math.max(1, Math.floor(route.n / 600))
    let p = ''
    for (let i = 0; i < route.n; i += stride) {
      const x = (i / (route.n - 1)) * W, y = 8 + (1 - (route.ele[i] - lo) / (hi - lo)) * (H - 16)
      p += `${p ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    }
    return { path: p, area: `${p}L${W},${H}L0,${H}Z` }
  }, [route])
  const press = useRef<{ x: number; t: ReturnType<typeof setTimeout> } | null>(null)
  const cancel = () => { if (press.current) clearTimeout(press.current.t); press.current = null }
  return (
    <svg className="profile" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Profil du parcours, ${Math.round(L)} km. Appui long pour ajouter un point.`}
      onPointerDown={e => {
        if (!onLongPress) return
        const r = e.currentTarget.getBoundingClientRect(), x = e.clientX
        press.current = { x, t: setTimeout(() => { navigator.vibrate?.(40); onLongPress(Math.max(0, Math.min(L, ((x - r.left) / r.width) * L))); press.current = null }, 500) }
      }}
      onPointerMove={e => { if (press.current && Math.abs(e.clientX - press.current.x) > 10) cancel() }}
      onPointerUp={cancel} onPointerCancel={cancel} onContextMenu={e => e.preventDefault()}>
      {sections.map(s => <rect key={s.id} x={(s.a / L) * W} width={Math.max(2, ((s.b - s.a) / L) * W)} y={0} height={H} fill={s.kind === 'montee' ? 'rgba(255,107,90,.2)' : 'rgba(77,163,255,.18)'} />)}
      <path d={area} fill="rgba(242,194,0,.14)" />
      <path d={path} fill="none" stroke="var(--accent-fg)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
