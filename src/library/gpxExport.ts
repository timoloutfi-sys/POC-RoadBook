import { columns } from './summary'
import type { Ride, RideChunk } from './types'

const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)
const MAX_POINTS = 30000

/**
 * Sortie au format GPX (positions, altitude, FC, cadence, puissance), lisible par Strava et TrainingPeaks.
 * Renvoie null s'il n'y a aucune position (sortie sans GPS).
 */
export function rideToGpx(ride: Ride, chunks: RideChunk[]): string | null {
  const c = columns(chunks)
  const idx: number[] = []
  for (let i = 0; i < c.n; i++) if (Number.isFinite(c.lat[i]) && Number.isFinite(c.lon[i])) idx.push(i)
  if (!idx.length) return null
  const step = Math.ceil(idx.length / MAX_POINTS)
  const pts = idx.filter((_, k) => k % step === 0).map(i => {
    const ext = [
      Number.isFinite(c.hr[i]) ? `<gpxtpx:hr>${Math.round(c.hr[i])}</gpxtpx:hr>` : '',
      Number.isFinite(c.cad[i]) ? `<gpxtpx:cad>${Math.round(c.cad[i])}</gpxtpx:cad>` : '',
    ].join('')
    const pw = Number.isFinite(c.power[i]) ? `<power>${Math.round(c.power[i])}</power>` : ''
    return `<trkpt lat="${c.lat[i].toFixed(6)}" lon="${c.lon[i].toFixed(6)}">${Number.isFinite(c.ele[i]) ? `<ele>${c.ele[i].toFixed(1)}</ele>` : ''}<time>${new Date(c.t[i]).toISOString()}</time><extensions>${pw}${ext ? `<gpxtpx:TrackPointExtension>${ext}</gpxtpx:TrackPointExtension>` : ''}</extensions></trkpt>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Road book" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">\n<metadata><name>${esc(ride.name)}</name><time>${new Date(ride.start).toISOString()}</time></metadata>\n<trk><name>${esc(ride.name)}</name><type>cycling</type><trkseg>\n${pts.join('\n')}\n</trkseg></trk>\n</gpx>\n`
}
