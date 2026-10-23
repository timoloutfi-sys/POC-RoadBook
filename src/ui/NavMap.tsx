import { useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { mapStyle, type MapTone } from '../map/offline'
import { registerMapProtocol } from '../map/protocol'
import type { NavView } from '../ride/nav'
import type { Route } from '../route/route'
import { trackAt } from '../route/track'
import { useStore } from '../storage/store'
import { NAV, OFF } from './NavTile'

type Line = { type: 'Feature'; properties: Record<string, never>; geometry: { type: 'LineString'; coordinates: [number, number][] } }
const lineOf = (coords: [number, number][]): Line => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } })

/** Tracé entre a et b (m). */
function part(r: Route, a: number, b: number): Line {
  const t = r.track, c: [number, number][] = []
  const pa = trackAt(t, a), pb = trackAt(t, b)
  c.push([pa.lon, pa.lat])
  for (let i = 0; i < t.n; i++) if (t.d[i] > a && t.d[i] < b) c.push([t.lon[i], t.lat[i]])
  c.push([pb.lon, pb.lat])
  return lineOf(c)
}

/** Vue de dessus : marge en haut (toi plus bas que le centre) et à gauche (place de la plaque). */
const TOP = 0.35
const padOf = (e: HTMLElement | null, pitch: number, side: number) =>
  ({ top: pitch || !e ? 0 : e.clientHeight * TOP, bottom: 0, left: e ? e.clientWidth * side : 0, right: 0 })

/**
 * Chevron de position (choix A) : encre, liseré blanc. La carte tourne avec toi, il pointe donc toujours vers le haut ;
 * posé par-dessus la carte au point où elle te place (plus fiable que les marqueurs de MapLibre en vue de dessus).
 */
function Chevron({ small, pitch, side }: { small: boolean; pitch: number; side: number }) {
  const px = small ? 28 : 42
  const left = `${(side + (1 - side) / 2) * 100}%`, top = pitch ? '80%' : `${(TOP + (1 - TOP) / 2) * 100}%`
  return (
    <svg className="nav-me" viewBox="0 0 48 48" width={px} height={px} aria-hidden style={{ left, top, transform: `translate(-50%, -50%)${pitch ? ` perspective(200px) rotateX(${pitch * 0.8}deg)` : ''}` }}>
      <path d="M24 4 L41 42 L24 33 L7 42 Z" fill="#1c1b18" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}

const toneOf = (el: Element | null): MapTone => {
  const n = el ? parseFloat(getComputedStyle(el).getPropertyValue('--n')) : 0
  return n > 0.5 ? 'night' : 'day'
}

/**
 * `side` : part de la largeur cachée à gauche par la plaque (petites tailles), pour que ta position reste visible à côté.
 * Carte de la navigation : tournée dans ton sens de marche, toi en bas, le tracé en carmin, ce qui est fait en gris.
 * Lit la carte enregistrée (protocole `rbk://`), ou le réseau à défaut ; suit le jour et la nuit de l'écran.
 */
export default function NavMap({ nav, small, pitch, side = 0 }: { nav: NavView; small: boolean; pitch: number; side?: number }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const state = useRef<{ tone: MapTone | null; doneAt: number; route: Route | null; at: number; lat: number; lon: number; head: number }>({ tone: null, doneAt: -1, route: null, at: 0, lat: 0, lon: 0, head: 0 })
  const route = useStore(s => s.route)
  const last = useRef(nav)
  last.current = nav

  // Couches du parcours, à remettre à chaque changement de style (jour, nuit).
  const addLayers = (m: maplibregl.Map) => {
    const r = state.current.route, n = last.current
    if (!r) return
    m.addSource('todo', { type: 'geojson', data: part(r, 0, r.track.total) })
    m.addSource('done', { type: 'geojson', data: part(r, 0, n.d) })
    m.addSource('back', { type: 'geojson', data: lineOf([]) })
    m.addLayer({ id: 'todo-c', type: 'line', source: 'todo', paint: { 'line-color': '#fff', 'line-width': small ? 9 : 12 }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
    m.addLayer({ id: 'todo', type: 'line', source: 'todo', paint: { 'line-color': NAV, 'line-width': small ? 5 : 7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
    m.addLayer({ id: 'done', type: 'line', source: 'done', paint: { 'line-color': '#8e8a82', 'line-width': small ? 4 : 5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
    m.addLayer({ id: 'back-c', type: 'line', source: 'back', paint: { 'line-color': '#1c1b18', 'line-width': 7 } })
    m.addLayer({ id: 'back', type: 'line', source: 'back', paint: { 'line-color': OFF, 'line-width': 4, 'line-dasharray': [1.5, 1.2] } })
    state.current.doneAt = n.d
  }

  useEffect(() => {
    if (!el.current || !route) return
    let gone = false
    state.current.route = route
    registerMapProtocol()
    const tone = toneOf(el.current)
    void mapStyle(tone).then(style => {
      if (gone || !el.current) return
      const n = last.current
      const m = new maplibregl.Map({
        container: el.current, style: style as unknown as StyleSpecification, center: [n.lon, n.lat], zoom: small ? 15.6 : 15.4, bearing: n.heading, pitch,
        interactive: false, attributionControl: false, fadeDuration: 0, refreshExpiredTiles: false, maxTileCacheSize: 400,
        // Chrome sur Android affichait par moments une image vide de la carte quand le reste de l'écran se redessinait
        // (4 fois par seconde) : la carte garde sa dernière image.
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
      })
      // Toi en bas de la case : marge en haut pour la vue de dessus ; pour la vue inclinée, la carte déborde sous la case (`.tilt`),
      // car une marge avec inclinaison laisse le bas de la carte vide (tuiles non chargées).
      const pad = () => m.setPadding(padOf(el.current, pitch, side))
      pad()
      // La case peut changer de taille (rotation, aperçu qui se pose) : la carte suit, toi toujours en bas.
      const ro = new ResizeObserver(() => { if (!el.current) return; m.resize(); pad() })
      ro.observe(el.current)
      m.once('remove', () => ro.disconnect())
      m.on('style.load', () => addLayers(m))
      map.current = m
      Object.assign(state.current, { tone, at: performance.now(), lat: n.lat, lon: n.lon, head: n.heading })
    }).catch(() => { /* pas de style (hors ligne, carte pas enregistrée) : la consigne reste lisible sans fond */ })
    return () => { gone = true; map.current?.remove(); map.current = null }
    // La carte se crée une fois par parcours et par taille ; la position suit dans l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, small, pitch, side])

  useEffect(() => {
    const m = map.current
    if (!m) return
    // L'écran se redessine 4 fois par seconde : la carte, elle, ne bouge qu'une fois par seconde et seulement si on a avancé
    // ou tourné (moins de tuiles demandées puis annulées, pas de saccades).
    const st = state.current, now = performance.now()
    const moved = Math.abs(nav.lat - st.lat) + Math.abs(nav.lon - st.lon) > 1e-5 || Math.abs(((nav.heading - st.head + 540) % 360) - 180) > 2
    if (moved && now - st.at > 950) {
      st.at = now; st.lat = nav.lat; st.lon = nav.lon; st.head = nav.heading
      m.easeTo({ center: [nav.lon, nav.lat], bearing: nav.heading, duration: 1000, easing: x => x, padding: padOf(el.current, pitch, side) })
    }
    if (!m.isStyleLoaded()) return
    const r = state.current.route
    if (r && Math.abs(nav.d - state.current.doneAt) > 30) { (m.getSource('done') as GeoJSONSource | undefined)?.setData(part(r, 0, nav.d)); state.current.doneAt = nav.d }
    ;(m.getSource('back') as GeoJSONSource | undefined)?.setData(lineOf(nav.off ? [[nav.lon, nav.lat], [nav.off.lon, nav.off.lat]] : []))
    // Jour et nuit : on change de style quand l'écran bascule, les couches du parcours sont remises par « style.load ».
    const tone = toneOf(el.current)
    if (tone !== state.current.tone) {
      state.current.tone = tone
      void mapStyle(tone).then(s => map.current?.setStyle(s as unknown as StyleSpecification)).catch(() => {})
    }
  }, [nav])

  return <><div ref={el} className={`nav-map${pitch ? ' tilt' : ''}`} /><Chevron small={small} pitch={pitch} side={side} /></>
}
