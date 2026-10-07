import { useMemo } from 'react'
import type { Route } from '../route/route'
import { HR_ZONES, POWER_ZONES, hrZoneOfPowerZone, powerZoneOf, type Unit } from '../strategy/zones'

/** Profil d'altitude coloré par zone d'effort : on voit où le plan demande de pousser. */
export function ZoneProfile({ route, ratio, unit, urban = [] }: { route: Route; ratio: Float32Array; unit: Unit; urban?: [number, number][] }) {
  const W = 1000, H = 150
  const g = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < route.n; i++) { lo = Math.min(lo, route.ele[i]); hi = Math.max(hi, route.ele[i]) }
    if (hi - lo < 60) { const m = (hi + lo) / 2; lo = m - 30; hi = m + 30 }
    const Y = (e: number) => 6 + (1 - (e - lo) / (hi - lo)) * (H - 12)
    const zoneAt = (i: number) => { const z = powerZoneOf(ratio[i]); return unit === 'power' ? z : hrZoneOfPowerZone(z) }
    const zones = unit === 'power' ? POWER_ZONES : HR_ZONES
    const runs: { d: string; c: string }[] = []
    let i0 = 0
    const X = (i: number) => (i / (route.n - 1)) * W
    for (let i = 1; i <= route.n; i++) {
      if (i < route.n && zoneAt(i) === zoneAt(i0)) continue
      const end = Math.min(i, route.n - 1)
      let d = `M${X(i0).toFixed(1)},${H}`
      for (let k = i0; k <= end; k += Math.max(1, Math.floor((end - i0) / 60))) d += `L${X(k).toFixed(1)},${Y(route.ele[k]).toFixed(1)}`
      d += `L${X(end).toFixed(1)},${Y(route.ele[end]).toFixed(1)}L${X(end).toFixed(1)},${H}Z`
      runs.push({ d, c: zones[zoneAt(i0)].c })
      i0 = i
    }
    let line = ''
    const st = Math.max(1, Math.floor(route.n / 500))
    for (let i = 0; i < route.n; i += st) line += `${line ? 'L' : 'M'}${X(i).toFixed(1)},${Y(route.ele[i]).toFixed(1)}`
    return { runs, line }
  }, [route, ratio, unit])
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 130, display: 'block' }} role="img" aria-label="Profil coloré par zone d'effort">
      {g.runs.map((r, k) => <path key={k} d={r.d} fill={r.c} opacity={0.85} />)}
      <path d={g.line} fill="none" stroke="var(--ink)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {urban.length > 0 && <defs><pattern id="urb" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="14" fill="var(--ink)" opacity=".55" /></pattern></defs>}
      {urban.map(([a, b], k) => <rect key={k} x={(a / (route.total / 1000)) * 1000} width={Math.max(4, ((b - a) / (route.total / 1000)) * 1000)} y={0} height={150} fill="url(#urb)" />)}
    </svg>
  )
}
