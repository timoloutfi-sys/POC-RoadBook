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
type Icon = 'chevron' | 'velo' | 'cone'
const ICON = (q.get('icon') ?? 'chevron') as Icon
/** Trois propositions pour te représenter sur la carte. */
const iconSvg = (k: Icon, px: number) => ({
  // Chevron de navigation (style GPS de voiture) : bleu plein, liseré blanc, ombre.
  chevron: `<svg viewBox="0 0 48 48" width="${px}" height="${px}" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))"><path d="M24 4 L41 42 L24 33 L7 42 Z" fill="#1f6feb" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>`,
  // Pastille vélo : rond bleu, pictogramme vélo blanc, petit cap devant.
  velo: `<svg viewBox="0 0 48 48" width="${px}" height="${px}" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))"><path d="M24 1 L30 9 L18 9 Z" fill="#1f6feb"/><circle cx="24" cy="27" r="18" fill="#1f6feb" stroke="#fff" stroke-width="3.5"/><g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="16.5" cy="31" r="5"/><circle cx="31.5" cy="31" r="5"/><path d="M16.5 31 L21 23 L28 23 L31.5 31 M21 23 L24 31 L28 23 M19.5 20.5 H23 M28 23 L27 19.5 H30"/></g></svg>`,
  // Point et cône de vision (style plan de téléphone).
  cone: `<svg viewBox="0 0 48 48" width="${px}" height="${px}"><defs><linearGradient id="cg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#1f6feb" stop-opacity=".55"/><stop offset="1" stop-color="#1f6feb" stop-opacity="0"/></linearGradient></defs><path d="M24 26 L8 2 Q24 -4 40 2 Z" fill="url(#cg)"/><circle cx="24" cy="26" r="10" fill="#1f6feb" stroke="#fff" stroke-width="4"/></svg>`,
})[k]

function NavMap({ lat, lon, head, zoom = 16, pitch = 0, offLine, h, icon = ICON, small, padLeft = 0 }: { lat: number; lon: number; head: number; zoom?: number; pitch?: number; offLine?: [number, number][]; h: number; icon?: Icon; small?: boolean; padLeft?: number }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const map = new maplibregl.Map({
      container: el.current!, style: `https://tiles.openfreemap.org/styles/${night ? 'dark' : 'liberty'}`, center: [lon, lat], zoom, bearing: head, pitch,
      interactive: false, attributionControl: false, canvasContextAttributes: { preserveDrawingBuffer: true },
    })
    map.setPadding({ top: h * (small ? 0.35 : 0.5), bottom: 0, left: padLeft, right: 0 })
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
      m.innerHTML = iconSvg(icon, small ? 30 : 46)
      new maplibregl.Marker({ element: m, rotation: head, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([lon, lat]).addTo(map)
    })
    return () => map.remove()
  }, [lat, lon, head, zoom, pitch, offLine, h, icon, small, padLeft])
  return (
    <>
      <div ref={el} style={{ position: 'absolute', inset: 0, borderRadius: 8, overflow: 'hidden' }} />
      {!small && <span style={{ position: 'absolute', right: 4, bottom: 2, font: '500 9px Barlow', color: '#555', background: 'rgba(255,255,255,.7)', padding: '0 4px', borderRadius: 3 }}>© OpenStreetMap · OpenFreeMap</span>}
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

const big = (px: number): CSSProperties => ({ fontFamily: 'var(--num)', fontWeight: 700, fontSize: px, lineHeight: 1, color: 'var(--d-ink)' })

/** Mini fond de carte des petites tailles : vue de dessus, zoom serré, sans noms ; le texte passe sur une plaque. */
const Mini = ({ offMode, h, padLeft = 0 }: { offMode?: boolean; h: number; padLeft?: number }) => {
  const o = trackAt(t, off.dist)
  return offMode
    ? <NavMap lat={offLat} lon={offLon} head={offHeading} zoom={15.6} h={h} small padLeft={padLeft} offLine={[[offLon, offLat], [o.lon, o.lat]]} />
    : <NavMap lat={here.lat} lon={here.lon} head={heading} zoom={15.6} h={h} small padLeft={padLeft} />
}
const plate = (red?: boolean): CSSProperties => ({ background: red ? 'rgba(229,72,77,.94)' : 'rgba(214,36,159,.94)', color: '#fff', borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,.25)' })

function Turn1x1() {
  return (
    <>
      <Mini h={CELL_H} />
      <div style={{ ...plate(), position: 'absolute', left: 6, right: 6, top: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '2px 4px' }}><TurnArrow turn={t1} size={34} color="#fff" /><span style={{ ...big(24), color: '#fff' }}>{fm(t1!.d - POS)}</span></div>
    </>
  )
}
function Turn2x1() {
  return (
    <>
      <Mini h={CELL_H} padLeft={CELL_W * 1.2} />
      <div style={{ ...plate(), position: 'absolute', left: 6, top: 6, bottom: 6, width: '58%', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
        <TurnArrow turn={t1} size={46} color="#fff" />
        <div><div style={{ ...big(28), color: '#fff' }}>{fm(t1!.d - POS)}</div><div style={{ font: '600 14px Barlow' }}>{turnWord(t1!)}</div>{t2 && <div style={{ font: '600 12px Barlow', opacity: 0.85 }}>puis {fm(t2.d - t1!.d)}</div>}</div>
      </div>
    </>
  )
}
function Off2x1() {
  return (
    <>
      <Mini offMode h={CELL_H} padLeft={CELL_W * 1.2} />
      <div style={{ ...plate(true), position: 'absolute', left: 6, top: 6, bottom: 6, width: '58%', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
        <OffArrow rel={off.rel} size={42} />
        <div><div style={{ font: '700 14px Barlow' }}>Hors parcours</div><div style={{ ...big(26), color: '#fff' }}>{fm(off.off)}</div><div style={{ font: '600 13px Barlow' }}>tracé {off.side}</div></div>
      </div>
    </>
  )
}
function Off1x1() {
  return (
    <>
      <Mini offMode h={CELL_H} />
      <div style={{ ...plate(true), position: 'absolute', left: 6, right: 6, top: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '2px 4px' }}><OffArrow rel={off.rel} size={30} /><span style={{ ...big(22), color: '#fff' }}>{fm(off.off)}</span></div>
    </>
  )
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

function MapWidget({ w, h, pitch = 50, offMode }: { w: number; h: number; pitch?: number; offMode?: boolean }) {
  const pxH = h * CELL_H, o = offMode ? trackAt(t, off.dist) : null
  return (
    <>
      {offMode
        ? <NavMap lat={offLat} lon={offLon} head={offHeading} zoom={14.9} pitch={pitch} h={pxH} offLine={[[offLon, offLat], [o!.lon, o!.lat]]} />
        : <NavMap lat={here.lat} lon={here.lon} head={heading} zoom={w * h >= 6 ? 15.6 : 15.2} pitch={pitch} h={pxH} />}
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
function Ecran({ portrait, pitch = 50 }: { portrait?: boolean; pitch?: number }) {
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

function Icones() {
  const one = (k: Icon, l: string) => (
    <Box w={2} h={2} label={l}><NavMap lat={here.lat} lon={here.lon} head={heading} zoom={15.8} pitch={50} h={2 * CELL_H} icon={k} /></Box>
  )
  return <div style={{ padding: 16, display: 'flex', gap: 18 }}>{one('chevron', 'A · chevron de navigation')}{one('velo', 'B · pastille vélo')}{one('cone', 'C · point et cône')}</div>
}

const V: Record<string, () => ReactNode> = {
  icones: () => <Icones />,
  petits: () => <Petits />, cartes: () => <Cartes />,
  ecran: () => <Ecran />, ecran3d: () => <Ecran pitch={50} />, portrait: () => <Ecran portrait />,
}
document.body.style.background = night ? '#0e141a' : '#0e141a'
createRoot(document.getElementById('root')!).render(<>{V[view]()}</>)
