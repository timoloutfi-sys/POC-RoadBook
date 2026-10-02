import type { RawPoint } from './route'

export interface ParsedGpx { name: string; pts: RawPoint[]; noEle: boolean }

/** Lit un GPX (trkpt, sinon rtept). Le tracé n'est jamais modifié, seulement lu. */
export function parseGPX(text: string): ParsedGpx {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error("Ce fichier n'est pas un GPX lisible.")
  let nodes = [...doc.getElementsByTagName('trkpt')]
  if (!nodes.length) nodes = [...doc.getElementsByTagName('rtept')]
  if (nodes.length < 2) throw new Error('Aucun tracé trouvé dans ce GPX (ni trkpt ni rtept).')
  const pts = nodes
    .map(nd => {
      const e = nd.getElementsByTagName('ele')[0]
      return {
        lat: parseFloat(nd.getAttribute('lat') ?? ''),
        lon: parseFloat(nd.getAttribute('lon') ?? ''),
        ele: e ? parseFloat(e.textContent ?? '') || 0 : 0,
      }
    })
    .filter(p => isFinite(p.lat) && isFinite(p.lon))
  const nm = doc.getElementsByTagName('name')[0]
  return { name: nm?.textContent?.trim() || 'Parcours importé', pts, noEle: pts.every(p => !p.ele) }
}
