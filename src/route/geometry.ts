import { cornerSpeed } from '../physics/kinematics'
import { STEP, type Route } from './route'
import { trackAt } from './track'

const RAD = Math.PI / 180

/** Cap (radians, 0 = nord, sens horaire) de chaque échantillon, mesuré sur ±1 pas. */
export function bearings(r: Route): Float32Array {
  const out = new Float32Array(r.n)
  for (let i = 0; i < r.n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(r.n - 1, i + 1)
    const y = Math.sin((r.lon[b] - r.lon[a]) * RAD) * Math.cos(r.lat[b] * RAD)
    const x = Math.cos(r.lat[a] * RAD) * Math.sin(r.lat[b] * RAD) - Math.sin(r.lat[a] * RAD) * Math.cos(r.lat[b] * RAD) * Math.cos((r.lon[b] - r.lon[a]) * RAD)
    out[i] = Math.atan2(y, x)
  }
  return out
}

/** Vitesse maximale (m/s) d'un parcours fictif : pas de virages connus, on plafonne à 45 km/h. */
export const SYNTHETIC_CAP = 45 / 3.6

/**
 * Vitesse maximale (m/s) imposée par les virages, lue sur le tracé fin : rayon du cercle passant par trois
 * points à ±15 m, relevé tous les 10 m, puis v = √(a·r) avec a l'accélération latérale tolérée
 * (3 m/s² pour un amateur prudent). Le minimum de chaque cellule de la grille est gardé.
 * Une ligne droite ou une courbe large ne limite rien.
 */
export function cornerCaps(r: Route, aLat = 3): Float32Array {
  if (r.synthetic) return new Float32Array(r.n).fill(SYNTHETIC_CAP)
  const out = new Float32Array(r.n).fill(99), k = 111320, H = 15, S = 10
  const t = r.track, cl = Math.cos(t.lat[0] * RAD)
  const xy = (d: number) => { const p = trackAt(t, d); return [p.lon * cl * k, p.lat * k] }
  for (let d = H; d <= t.total - H; d += S) {
    const [ax, ay] = xy(d - H), [bx, by] = xy(d), [cx, cy] = xy(d + H)
    const ab = Math.hypot(bx - ax, by - ay), bc = Math.hypot(cx - bx, cy - by), ca = Math.hypot(ax - cx, ay - cy)
    const area2 = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax))
    if (area2 < 1e-6) continue
    const v = cornerSpeed(Math.max(8, (ab * bc * ca) / (2 * area2)), aLat)
    const i = Math.min(r.n - 1, Math.round(d / STEP))
    if (v < out[i]) out[i] = v
  }
  return out
}

/**
 * Composante de vent de face (m/s) le long de la route. `fromDeg` = direction d'où vient le vent (0 = nord).
 * Le vent annoncé (à 10 m) est réduit de 30 % à hauteur de cycliste.
 */
export function headwind(r: Route, kmh: number, fromDeg: number): Float32Array {
  const out = new Float32Array(r.n)
  if (!kmh) return out
  const br = bearings(r), w = (kmh / 3.6) * 0.7, from = fromDeg * RAD
  for (let i = 0; i < r.n; i++) out[i] = w * Math.cos(br[i] - from)
  return out
}
