/** Lever et coucher du soleil (algorithme NOAA simplifié). Null en jour ou nuit polaire. */
export function sunTimes(date: Date, lat: number, lng: number): { rise: Date | null; set: Date | null } {
  const rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397
  const fromJ = (j: number) => new Date((j + 0.5 - J1970) * dayMs)
  const lw = rad * -lng, phi = rad * lat, d = date.valueOf() / dayMs - 0.5 + J1970 - J2000
  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI)), ds = 0.0009 + lw / (2 * Math.PI) + n
  const M = rad * (357.5291 + 0.98560028 * ds)
  const L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI
  const dec = Math.asin(Math.sin(e) * Math.sin(L))
  const Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
  const cw = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  if (cw < -1 || cw > 1) return { rise: null, set: null }
  const a = 0.0009 + (Math.acos(cw) + lw) / (2 * Math.PI) + n
  const Jset = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
  return { rise: fromJ(Jnoon - (Jset - Jnoon)), set: fromJ(Jset) }
}
