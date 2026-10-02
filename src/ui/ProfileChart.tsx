import { useMemo } from 'react'
import type { Route } from '../route/route'
import type { Section } from '../strategy/types'

/** Profil d'altitude en SVG, montées et sections surlignées. */
export function ProfileChart({ route, sections }: { route: Route; sections: Section[] }) {
  const W = 1000, H = 200
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
  const L = route.total / 1000
  return (
    <svg className="profile" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Profil du parcours, ${Math.round(L)} km`}>
      {sections.map(s => (
        <rect key={s.id} x={(s.a / L) * W} width={Math.max(2, ((s.b - s.a) / L) * W)} y={0} height={H}
          fill={s.kind === 'montee' ? 'rgba(255,107,90,.18)' : 'rgba(77,163,255,.16)'} />
      ))}
      <path d={area} fill="rgba(242,194,0,.14)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
