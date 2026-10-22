/**
 * Prototype de la navigation (dev, jamais publié) : le widget « Navigation » à plusieurs tailles,
 * sur un vrai tracé (Porte Maillot → Saint-Germain-en-Laye) et une vraie carte (OpenFreeMap).
 * Sert aux captures de l'étude (`docs/ETUDE-NAVIGATION.md`).
 */
import { createRoot } from 'react-dom/client'
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow/latin-700.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '../index.css'
import '../ui/device.css'
import gpx from './fixtures/paris-sgl.gpx?raw'
import { parseGPX } from '../route/gpx'
import { buildRoute } from '../route/route'
import { trackAt } from '../route/track'
import { bearing, findTurns, nextTurns, offRoute, type Turn } from '../route/turns'
import { previewData } from '../ride/data'
import { Device } from '../ui/Device'
import { LANDSCAPE, PORTRAIT, type WidgetItem } from '../storage/defaults'

const q = new URLSearchParams(location.search)
const view = q.get('v') ?? 'petits', night = q.get('n') === '1'
const g = parseGPX(gpx), route = buildRoute(g.name, g.pts), t = route.track
const turns = findTurns(t)
const POS = 2350
const here = trackAt(t, POS), ahead = trackAt(t, POS + 30), heading = bearing(here.lat, here.lon, ahead.lat, ahead.lon)
const [t1, t2] = nextTurns(turns, POS)
// Hors parcours : 140 m à côté du tracé, en s'éloignant.
const offAt = trackAt(t, 5200), offNext = trackAt(t, 5230), hb = bearing(offAt.lat, offAt.lon, offNext.lat, offNext.lon)
const offLat = offAt.lat + (140 / 111320) * Math.cos(((hb - 90) * Math.PI) / 180)
const offLon = offAt.lon + (140 / (111320 * Math.cos((offAt.lat * Math.PI) / 180))) * Math.sin(((hb - 90) * Math.PI) / 180)
const offHeading = (hb - 70 + 360) % 360
const off = offRoute(t, offLat, offLon, offHeading, 5200)

const fm = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`)
const NAV = '#d6249f', DONE = '#8a96a3'
const turnWord = (x: Turn) => (x.kind === 'demi' ? 'Demi-tour' : x.kind === 'serre' ? `Serré à ${x.side}` : x.kind === 'leger' ? `Légèrement à ${x.side}` : `À ${x.side}`)

/** Flèche de virage : tige verticale, courbe de l'angle du virage, pointe pleine dans l'axe de sortie. */
function TurnArrow({ turn, size = 64, color = 'currentColor' }: { turn: Turn | null; size?: number; color?: string }) {
  const a = turn ? (turn.side === 'droite' ? 1 : -1) * Math.min(turn.angle, 160) : 0
  const r = (a * Math.PI) / 180, sx = Math.sin(r), cy = Math.cos(r)
  // Coude en (50, 52) ; sortie de 26 unités dans la direction du virage ; pointe de 16.
  const ex = 50 + 26 * sx, ey = 52 - 26 * cy, tx = ex + 16 * sx, ty = ey - 16 * cy
  const px = -cy, py = -sx
  const head = `M${tx.toFixed(1)} ${ty.toFixed(1)} L${(ex + 13 * px).toFixed(1)} ${(ey + 13 * py).toFixed(1)} L${(ex - 13 * px).toFixed(1)} ${(ey - 13 * py).toFixed(1)} Z`
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <path d={`M50 96 L50 64 Q50 52 ${(50 + 12 * sx).toFixed(1)} ${(52 - 12 * cy).toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d={head} fill={color} stroke={color} strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}

/** Boussole hors parcours : la flèche montre le tracé par rapport à ta direction. */
function OffArrow({ rel, size = 64 }: { rel: number; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden style={{ transform: `rotate(${rel}deg)` }}>
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="6" />
      <path d="M50 10 L72 58 L50 48 L28 58 Z" fill="currentColor" />
    </svg>
  )
}

const line = (a: number, b: number) => {
  const c: [number, number][] = []
  const pa = trackAt(t, a), pb = trackAt(t, b)
  c.push([pa.lon, pa.lat])
  for (let i = 0; i < t.n; i++) if (t.d[i] > a && t.d[i] < b) c.push([t.lon[i], t.lat[i]])
  c.push([pb.lon, pb.lat])
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: c } }
}

/** Carte tournée dans le sens de marche, tracé magenta, position en bas de la carte. */
function NavMap({ lat, lon, head, zoom = 16, pitch = 0, offLine, h }: { lat: number; lon: number; head: number; zoom?: number; pitch?: number; offLine?: [number, number][]; h: number }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const map = new maplibregl.Map({
      container: el.current!, style: `https://tiles.openfreemap.org/styles/${night ? 'dark' : 'liberty'}`, center: [lon, lat], zoom, bearing: head, pitch,
      interactive: false, attributionControl: false, canvasContextAttributes: { preserveDrawingBuffer: true },
    })
    map.setPadding({ top: h * 0.5, bottom: 0, left: 0, right: 0 })
    map.on('load', () => {
      // Carte calme : routes, eau, verdure et noms de rues ; ni commerces, ni arrêts de bus, ni bâtiments, ni numéros de route.
      for (const l of map.getStyle().layers) {
        const id = l.id
        const keepLabel = /^(highway[-_]name|road[-_]label|water[-_]name|place[-_](city|town|village|suburb))/i.test(id)
        if (/poi|building|transit|aerodrome|aeroway|housenumber|bus|rail|ferry|boundary|shield|oneway|bridge_pattern|tunnel_pattern/i.test(id) || (l.type === 'symbol' && !keepLabel)) map.setLayoutProperty(id, 'visibility', 'none')
      }
      map.addSource('done', { type: 'geojson', data: line(0, offLine ? 5200 : POS) })
      map.addSource('todo', { type: 'geojson', data: line(offLine ? 0 : POS, t.total) })
      map.addLayer({ id: 'todo-c', type: 'line', source: 'todo', paint: { 'line-color': '#fff', 'line-width': 12 }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
      map.addLayer({ id: 'todo', type: 'line', source: 'todo', paint: { 'line-color': NAV, 'line-width': 7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
      if (!offLine) map.addLayer({ id: 'done', type: 'line', source: 'done', paint: { 'line-color': DONE, 'line-width': 5, 'line-opacity': 0.8 }, layout: { 'line-cap': 'round' } })
      if (offLine) {
        map.addSource('back', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: offLine } } })
        map.addLayer({ id: 'back', type: 'line', source: 'back', paint: { 'line-color': '#e5484d', 'line-width': 4, 'line-dasharray': [1.5, 1.5] } })
      }
      const m = document.createElement('div')
      m.innerHTML = `<svg viewBox="0 0 48 48" width="44" height="44"><circle cx="24" cy="24" r="22" fill="#1f6feb" fill-opacity=".18"/><circle cx="24" cy="24" r="15" fill="#fff"/><path d="M24 11 L33 33 L24 28 L15 33 Z" fill="#1f6feb"/></svg>`
      new maplibregl.Marker({ element: m, rotation: head, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([lon, lat]).addTo(map)
    })
    return () => map.remove()
  }, [lat, lon, head, zoom, pitch, offLine, h])
  return (
    <>
      <div ref={el} style={{ position: 'absolute', inset: 0, borderRadius: 8, overflow: 'hidden' }} />
      <span style={{ position: 'absolute', right: 4, bottom: 2, font: '500 9px Barlow', color: '#555', background: 'rgba(255,255,255,.7)', padding: '0 4px', borderRadius: 3 }}>© OpenStreetMap · OpenFreeMap</span>
    </>
  )
}

const CELL_W = 844 / 6, CELL_H = 390 / 3
/** Une case de widget à la taille réelle de l'écran paysage. */
function Box({ w, h, children, label }: { w: number; h: number; children: ReactNode; label: string }) {
  return (
    <figure style={{ margin: 0 }}>
      <div className="dev" style={{ '--n': night ? 1 : 0, width: w * CELL_W, height: h * CELL_H, borderRadius: 10 } as CSSProperties}>
        <div className="wg" style={{ inset: 0 }}><div className="wi" style={{ position: 'absolute', inset: 2, padding: 0, overflow: 'hidden' }}>{children}</div></div>
      </div>
      <figcaption style={{ color: '#a3b0bc', font: '600 13px Barlow', marginTop: 6 }}>{label}</figcaption>
    </figure>
  )
}

const lab: CSSProperties = { font: '600 15px Barlow', color: 'var(--d-mut)' }
const big = (px: number): CSSProperties => ({ fontFamily: 'var(--num)', fontWeight: 700, fontSize: px, lineHeight: 1, color: 'var(--d-ink)' })

function Turn1x1() {
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 2, color: NAV }}><TurnArrow turn={t1} size={70} /><div style={big(30)}>{fm(t1!.d - POS)}</div></div>
}
function Turn2x1() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', color: NAV }}>
      <TurnArrow turn={t1} size={86} />
      <div><div style={big(44)}>{fm(t1!.d - POS)}</div><div style={{ ...lab, color: 'var(--d-ink)', fontSize: 17 }}>{turnWord(t1!)}</div>{t2 && <div style={lab}>puis {turnWord(t2).toLowerCase()} · {fm(t2.d - t1!.d)}</div>}</div>
    </div>
  )
}
function Off2x1() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', color: '#e5484d', background: 'color-mix(in srgb, #e5484d 12%, transparent)' }}>
      <OffArrow rel={off.rel} size={80} />
      <div><div style={{ font: '700 19px Barlow', color: '#e5484d' }}>Hors parcours</div><div style={big(36)}>{fm(off.off)}</div><div style={{ ...lab, color: 'var(--d-ink)', fontSize: 17 }}>tracé {off.side}</div></div>
    </div>
  )
}
function Off1x1() {
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 2, color: '#e5484d', background: 'color-mix(in srgb, #e5484d 12%, transparent)' }}><OffArrow rel={off.rel} size={62} /><div style={big(26)}>{fm(off.off)}</div></div>
}
/** Bandeau de virage, collé en haut de la carte : flèche, distance, consigne ; le virage suivant à droite en grand. */
const TurnBand = ({ compact }: { compact?: boolean }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '6px 10px' : '8px 14px', background: NAV, color: '#fff' }}>
    <TurnArrow turn={t1} size={compact ? 40 : 52} color="#fff" />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--num)', fontWeight: 700, fontSize: compact ? 28 : 34, lineHeight: 1 }}>{fm(t1!.d - POS)}</div>
      {!compact && <div style={{ font: '600 16px Barlow', opacity: 0.95 }}>{turnWord(t1!)}</div>}
    </div>
    {!compact && t2 && <div style={{ display: 'flex', alignItems: 'center', gap: 4, font: '600 15px Barlow', opacity: 0.85 }}>puis <TurnArrow turn={t2} size={26} color="#fff" /> {fm(t2.d - t1!.d)}</div>}
  </div>
)
const OffBand = ({ compact }: { compact?: boolean }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '6px 10px' : '8px 14px', background: '#e5484d', color: '#fff' }}>
    <OffArrow rel={off.rel} size={compact ? 38 : 48} />
    <div><div style={{ font: '700 18px Barlow' }}>Hors parcours</div><div style={{ font: '600 15px Barlow' }}>tracé {off.side} · {fm(off.off)}</div></div>
  </div>
)

function MapWidget({ w, h, pitch = 0, offMode }: { w: number; h: number; pitch?: number; offMode?: boolean }) {
  const pxH = h * CELL_H, o = offMode ? trackAt(t, off.dist) : null
  return (
    <>
      {offMode
        ? <NavMap lat={offLat} lon={offLon} head={offHeading} zoom={15} h={pxH} offLine={[[offLon, offLat], [o!.lon, o!.lat]]} />
        : <NavMap lat={here.lat} lon={here.lon} head={heading} zoom={w * h >= 6 ? 15 : 14.6} pitch={pitch} h={pxH} />}
      {offMode ? <OffBand compact={w * h <= 4} /> : <TurnBand compact={w * h <= 4} />}
    </>
  )
}

function Petits() {
  return (
    <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
      <Box w={1} h={1} label="1×1 · prochain virage"><Turn1x1 /></Box>
      <Box w={2} h={1} label="2×1 · prochain virage et le suivant"><Turn2x1 /></Box>
      <Box w={1} h={1} label="1×1 · hors parcours"><Off1x1 /></Box>
      <Box w={2} h={1} label="2×1 · hors parcours"><Off2x1 /></Box>
    </div>
  )
}
function Cartes() {
  return (
    <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
      <Box w={2} h={2} label="2×2 · carte et virage"><MapWidget w={2} h={2} /></Box>
      <Box w={3} h={2} label="3×2 · carte et virage"><MapWidget w={3} h={2} /></Box>
      <Box w={3} h={2} label="3×2 · hors parcours"><MapWidget w={3} h={2} offMode /></Box>
    </div>
  )
}

/** Écran complet : la navigation à côté des widgets d'effort, comme dans l'appli. */
function Ecran({ portrait, pitch }: { portrait?: boolean; pitch?: number }) {
  const grid = portrait ? PORTRAIT : LANDSCAPE, d = previewData()
  const items: WidgetItem[] = portrait
    ? [{ id: 'a', k: 'effort', x: 0, y: 3, w: 2, h: 2 }, { id: 'b', k: 'hr', x: 2, y: 3, w: 1, h: 1 }, { id: 'c', k: 'speed', x: 2, y: 4, w: 1, h: 1 }, { id: 'd', k: 'dist', x: 0, y: 5, w: 2, h: 1 }, { id: 'e', k: 'clock', x: 2, y: 5, w: 1, h: 1 }]
    : [{ id: 'a', k: 'effort', x: 0, y: 0, w: 2, h: 2 }, { id: 'b', k: 'hr', x: 0, y: 2, w: 1, h: 1 }, { id: 'c', k: 'speed', x: 1, y: 2, w: 1, h: 1 }]
  const W = portrait ? 390 : 844, H = portrait ? 844 : 390, cw = W / grid.cols, ch = H / grid.rows
  const nav = portrait ? { x: 0, y: 0, w: 3, h: 3 } : { x: 2, y: 0, w: 4, h: 3 }
  return (
    <div style={{ width: W, height: H, position: 'relative' }}>
      <Device items={items} data={d} tone={night ? 1 : 0} grid={grid} className="full" />
      <div className="wg" style={{ left: nav.x * cw, top: nav.y * ch, width: nav.w * cw, height: nav.h * ch, position: 'absolute' }}>
        <div className="wi" style={{ position: 'absolute', inset: 2, padding: 0, overflow: 'hidden' }}>
          <NavMap lat={here.lat} lon={here.lon} head={heading} zoom={pitch ? 15.6 : 15} pitch={pitch ?? 0} h={nav.h * ch} />
          <TurnBand />
        </div>
      </div>
    </div>
  )
}

const V: Record<string, () => ReactNode> = {
  petits: () => <Petits />, cartes: () => <Cartes />,
  ecran: () => <Ecran />, ecran3d: () => <Ecran pitch={50} />, portrait: () => <Ecran portrait />,
}
document.body.style.background = night ? '#0e141a' : '#0e141a'
createRoot(document.getElementById('root')!).render(<>{V[view]()}</>)
