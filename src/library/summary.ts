import type { RideChunk, RideSummary } from './types'

const finite = (x: number) => Number.isFinite(x)

/** Concatène les morceaux d'une sortie en colonnes continues. */
export function columns(chunks: RideChunk[]) {
  const n = chunks.reduce((a, c) => a + c.t.length, 0)
  const out = { n, t: new Float64Array(n), km: new Float32Array(n), speed: new Float32Array(n), power: new Float32Array(n), hr: new Float32Array(n), cad: new Float32Array(n), ele: new Float32Array(n), moving: new Uint8Array(n), tgt: new Uint8Array(n) }
  let o = 0
  for (const c of chunks) {
    for (const k of ['t', 'km', 'speed', 'power', 'hr', 'cad', 'ele', 'moving', 'tgt'] as const) (out[k] as Float32Array).set(c[k] as Float32Array, o)
    o += c.t.length
  }
  return out
}

/** Temps prévu au km donné, par interpolation entre les lignes du road book. */
export function plannedAt(etas: { km: number; t: number }[], km: number): number | null {
  if (!etas.length) return null
  if (km <= etas[0].km) return etas[0].t
  for (let i = 1; i < etas.length; i++) {
    if (km <= etas[i].km) {
      const a = etas[i - 1], b = etas[i], f = b.km > a.km ? (km - a.km) / (b.km - a.km) : 1
      return a.t + f * (b.t - a.t)
    }
  }
  return etas[etas.length - 1].t
}

/** Chiffres clés d'une sortie, calculés une fois à l'enregistrement. */
export function summarize(chunks: RideChunk[], extra: { etas?: { km: number; t: number }[]; remindersDone?: number; remindersTotal?: number } = {}): RideSummary {
  const c = columns(chunks)
  let km = 0, moving = 0, sumP = 0, nP = 0, sumH = 0, nH = 0, inT = 0, nT = 0, kj = 0, p4 = 0, n4 = 0
  const win: number[] = []
  for (let i = 0; i < c.n; i++) {
    if (c.km[i] > km) km = c.km[i]
    if (!c.moving[i]) continue
    moving++
    if (finite(c.power[i])) {
      sumP += c.power[i]; nP++; kj += c.power[i] / 1000
      win.push(c.power[i]); if (win.length > 30) win.shift()
      if (win.length === 30) { p4 += (win.reduce((a, b) => a + b, 0) / 30) ** 4; n4++ }
    }
    if (finite(c.hr[i])) { sumH += c.hr[i]; nH++ }
    if (c.tgt[i]) { nT++; if (c.tgt[i] === 1) inT++ }
  }
  // Dénivelé positif sur une altitude lissée (fenêtre de 10 mesures) pour ne pas compter le bruit.
  let dplus = 0, prev: number | null = null
  for (let i = 0; i < c.n; i += 10) {
    let s = 0, k = 0
    for (let j = i; j < Math.min(c.n, i + 10); j++) if (finite(c.ele[j])) { s += c.ele[j]; k++ }
    if (!k) continue
    const e = s / k
    if (prev != null && e > prev) dplus += e - prev
    prev = e
  }
  const total = c.n ? (c.t[c.n - 1] - c.t[0]) / 1000 + 1 : 0
  const planned = extra.etas ? plannedAt(extra.etas, km) : null
  return {
    km, moving, total, dplus: Math.round(dplus),
    np: n4 ? (p4 / n4) ** 0.25 : null, avgP: nP ? sumP / nP : null, avgHr: nH ? sumH / nH : null,
    kcal: nP ? Math.round(kj) : null,
    inTarget: nT ? (inT / nT) * 100 : null,
    deltaArrival: planned == null ? null : total - planned,
    remindersDone: extra.remindersDone ?? 0, remindersTotal: extra.remindersTotal ?? 0,
  }
}
