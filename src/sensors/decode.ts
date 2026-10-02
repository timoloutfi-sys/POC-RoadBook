/**
 * Décodage des trames Bluetooth (GATT) :
 * Heart Rate 0x180D, Cycling Power 0x1818, Cycling Speed and Cadence 0x1816.
 * Les temps d'événement sont en 1/1024 s et les compteurs reviennent à zéro.
 */

export interface RevSample { revs: number; time: number }

/** Heart Rate Measurement : FC sur 8 ou 16 bits selon le bit 0 des drapeaux. */
export function parseHeartRate(dv: DataView): number {
  const f = dv.getUint8(0)
  return f & 1 ? dv.getUint16(1, true) : dv.getUint8(1)
}

/** Cycling Power Measurement : puissance instantanée et, si présents, tours de pédalier. */
export function parsePower(dv: DataView): { power: number; crank: RevSample | null } {
  const f = dv.getUint16(0, true)
  const power = Math.max(0, dv.getInt16(2, true))
  let o = 4
  if (f & 0x01) o += 1 // équilibre des pédales
  if (f & 0x04) o += 2 // couple accumulé
  if (f & 0x10) o += 6 // tours de roue (uint32 + uint16)
  const crank = f & 0x20 && dv.byteLength >= o + 4 ? { revs: dv.getUint16(o, true), time: dv.getUint16(o + 2, true) } : null
  return { power, crank }
}

/** CSC Measurement : tours de roue (uint32) et de pédalier (uint16), chacun avec son temps. */
export function parseCsc(dv: DataView): { wheel: RevSample | null; crank: RevSample | null } {
  const f = dv.getUint8(0)
  let o = 1, wheel: RevSample | null = null, crank: RevSample | null = null
  if (f & 1 && dv.byteLength >= 7) { wheel = { revs: dv.getUint32(1, true), time: dv.getUint16(5, true) }; o += 6 }
  if (f & 2 && dv.byteLength >= o + 4) crank = { revs: dv.getUint16(o, true), time: dv.getUint16(o + 2, true) }
  return { wheel, crank }
}

const dtSec = (a: number, b: number) => ((b - a + 65536) % 65536) / 1024

/** Cadence (rpm) entre deux échantillons de pédalier, ou null si incohérent. */
export function cadenceFrom(prev: RevSample, cur: RevSample): number | null {
  const dr = (cur.revs - prev.revs + 65536) % 65536, dt = dtSec(prev.time, cur.time)
  if (dt <= 0 || dr === 0 || dr >= 20) return null
  const c = (dr / dt) * 60
  return c < 220 ? c : null
}

/** Vitesse (m/s) entre deux échantillons de roue, circonférence en mm. */
export function speedFrom(prev: RevSample, cur: RevSample, circMm: number): number | null {
  const dr = (cur.revs - prev.revs) >>> 0, dt = dtSec(prev.time, cur.time)
  if (dt <= 0 || dr === 0 || dr >= 60) return null
  const v = (dr * circMm) / 1000 / dt
  return v < 30 ? v : null
}
