import { type Route } from '../route/route'
import { hrZoneOfPowerZone, HR_ZONES, POWER_ZONES, powerZoneOf, type Unit } from '../strategy/zones'
import { targetAt } from '../strategy/target'
import { columns, plannedAt } from './summary'
import type { Ride, RideChunk } from './types'

export interface RealizedRow {
  id: string
  label: string
  type: string
  km: number
  /** Heure prévue et réelle, en s depuis le départ ; null si le point n'a pas été atteint. */
  planned: number | null
  actual: number | null
  /** Arrêt réellement fait à ce point, en s. */
  stopS: number
}

export interface SeriesPoint { km: number; value: number | null; lo: number | null; hi: number | null; ele: number | null }

export interface Analysis {
  unit: Unit
  rows: RealizedRow[]
  /** Secondes par zone, réel et prévu (null sans parcours ni plan). */
  zones: { real: number[]; plan: number[] | null }
  /** Dérive cardiaque : hausse du rapport FC/puissance entre la 1re et la 2e moitié, en %. */
  drift: number | null
  cad: number | null
  series: SeriesPoint[]
}

const finite = Number.isFinite

export function analyze(ride: Ride, chunks: RideChunk[], route: Route | null): Analysis {
  const c = columns(chunks), snap = ride.planSnapshot, R = ride.riderSnapshot
  const unit = R.unit, ftp = R.ftp ?? 200, lthr = R.lthr
  const t0 = c.n ? c.t[0] : ride.start
  const val = (i: number) => (unit === 'power' ? c.power[i] : c.hr[i])

  // Road book réalisé
  const rows: RealizedRow[] = []
  if (snap) {
    const items = [
      ...snap.points.filter(p => !p.gen).map(p => ({ id: p.id, label: p.text, type: p.type as string, km: p.km })),
      ...snap.sections.filter(s => s.mark).map(s => ({ id: s.id, label: s.name, type: 'mark', km: s.a })),
    ].sort((a, b) => a.km - b.km)
    // Segments d'arrêt : de « stop » à « resume » (ou à la fin)
    const stops: { km: number; s: number }[] = []
    let open: { t: number; km: number } | null = null
    for (const e of ride.events) {
      if (e.type === 'stop') open = { t: e.t, km: e.km }
      else if (e.type === 'resume' && open) { stops.push({ km: open.km, s: (e.t - open.t) / 1000 }); open = null }
    }
    if (open && c.n) stops.push({ km: open.km, s: (c.t[c.n - 1] - open.t) / 1000 })
    let j = 0
    for (const it of items) {
      while (j < c.n && c.km[j] < it.km) j++
      rows.push({
        ...it, planned: plannedAt(snap.etas, it.km), actual: j < c.n ? (c.t[j] - t0) / 1000 : null,
        stopS: stops.filter(s => Math.abs(s.km - it.km) <= 0.5).reduce((a, s) => a + s.s, 0),
      })
    }
  }

  // Zones, réel contre prévu
  const nz = unit === 'power' ? POWER_ZONES.length : HR_ZONES.length
  const real = new Array(nz).fill(0)
  const plan: number[] | null = snap && route ? new Array(nz).fill(0) : null
  let hrs = 0, ps = 0, n1 = 0, hrs2 = 0, ps2 = 0, n2 = 0, cadS = 0, cadN = 0
  let moved = 0
  for (let i = 0; i < c.n; i++) if (c.moving[i]) moved++
  let seen = 0
  for (let i = 0; i < c.n; i++) {
    if (!c.moving[i]) continue
    seen++
    const v = val(i)
    if (finite(v)) {
      if (unit === 'power') real[powerZoneOf(v / ftp)]++
      else if (lthr) { const r = v / lthr; let z = 0; while (z < 4 && r >= HR_ZONES[z].hi) z++; real[z]++ }
    }
    if (plan && snap) {
      const tg = targetAt(route, snap.sections, snap.base, ftp, lthr, c.km[i] * 1000, (c.t[i] - t0) / 3.6e6)
      plan[unit === 'power' ? tg.zone : hrZoneOfPowerZone(tg.zone)]++
    }
    if (finite(c.power[i]) && finite(c.hr[i]) && c.power[i] > 50) {
      if (seen <= moved / 2) { hrs += c.hr[i]; ps += c.power[i]; n1++ } else { hrs2 += c.hr[i]; ps2 += c.power[i]; n2++ }
    }
    if (finite(c.cad[i]) && c.cad[i] > 0) { cadS += c.cad[i]; cadN++ }
  }
  const drift = n1 > 60 && n2 > 60 ? ((hrs2 / ps2) / (hrs / ps) - 1) * 100 : null

  // Courbe : une moyenne par tranche de distance (≈ 300 points)
  const series: SeriesPoint[] = []
  if (c.n) {
    const kmMax = c.km[c.n - 1], B = 300, w = Math.max(kmMax / B, 0.05)
    let i = 0
    for (let b = 0; b * w < kmMax; b++) {
      const a = b * w, z = a + w
      let s = 0, k = 0, e = 0, ek = 0
      while (i < c.n && c.km[i] < z) {
        if (c.moving[i] && finite(val(i))) { s += val(i); k++ }
        if (finite(c.ele[i])) { e += c.ele[i]; ek++ }
        i++
      }
      const mid = a + w / 2
      let lo: number | null = null, hi: number | null = null
      if (snap && route) {
        const tg = targetAt(route, snap.sections, snap.base, ftp, lthr, mid * 1000, 0)
        const band = unit === 'power' ? tg.power : tg.hr
        if (band) { lo = band.min; hi = band.max }
      }
      series.push({ km: mid, value: k ? s / k : null, lo, hi, ele: ek ? e / ek : route ? route.ele[Math.min(route.n - 1, Math.round((mid * 1000) / 50))] : null })
    }
  }
  return { unit, rows, zones: { real, plan }, drift, cad: cadN ? cadS / cadN : null, series }
}

/** Pastille de conformité au plan : la plus mauvaise de « temps dans la cible » et « écart d'arrivée ». */
export function conformity(s: { inTarget: number | null; deltaArrival: number | null }): 'ok' | 'wa' | 'ko' | null {
  const a = s.inTarget == null ? null : s.inTarget >= 70 ? 0 : s.inTarget >= 50 ? 1 : 2
  const d = s.deltaArrival == null ? null : Math.abs(s.deltaArrival) < 300 ? 0 : Math.abs(s.deltaArrival) < 900 ? 1 : 2
  const w = Math.max(a ?? -1, d ?? -1)
  return w < 0 ? null : (['ok', 'wa', 'ko'] as const)[w]
}
