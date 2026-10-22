import maplibregl from 'maplibre-gl'
import { resolve } from './offline'

let done = false
/** Branche `rbk://` sur la carte enregistrée (tuiles, polices, icônes), une fois pour toute l'appli. */
export function registerMapProtocol() {
  if (done) return
  done = true
  maplibregl.addProtocol('rbk', async (params, abort) => ({ data: await resolve(params.url, abort.signal) }))
}
