import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { nightAmount } from '../core/daynight'
import { unlockAudio } from '../ride/signal'
import { ride } from '../ride/controller'
import { useStore } from '../storage/store'
import { itemsFor, stepScreen } from '../storage/screens'
import { TAP, WIDGETS, fitSize, nextOption } from '../storage/catalog'
import { LANDSCAPE, PORTRAIT, type WidgetItem } from '../storage/defaults'
import { Device } from './Device'
import { Icon } from './icons'
import { Sheet } from './Sheet'
import { SensorsBlock } from './SensorsBlock'

const LONG_MS = 600, BAR_MS = 4000, LOUPE_MS = 6000, OVERVIEW_MS = 10000, HINT_MS = 1600

/**
 * Vue de course plein écran, dans l'orientation du téléphone. Rien n'est affiché de plus que les widgets.
 * - Appui long n'importe où (0,6 s) : barre « Capteurs », « Appli » (retour à l'appli, la sortie continue), « Quitter ».
 *   Un toucher par erreur (pluie, gant) n'ouvre plus rien.
 * - Toucher un widget : son action (Tour = nouveau tour, Rappel = Fait, Navigation = vue d'ensemble, Profil et Puissance =
 *   réglage suivant) ; sans action, il s'affiche en grand quelques secondes (loupe). Toucher le bandeau d'un rappel = Fait.
 * - Glisser à l'horizontale n'importe où : écran suivant ou précédent.
 */
export function RideView({ onExit, onAway }: { onExit: () => void; onAway: () => void }) {
  const screens = useStore(s => s.screens), activeId = useStore(s => s.activeScreen), theme = useStore(s => s.rideTheme)
  const route = useStore(s => s.route), set = useStore(s => s.set)
  const [, setTick] = useState(0)
  const [barUntil, setBarUntil] = useState(0)
  const [panel, setPanel] = useState<null | 'sensors' | 'quit'>(null)
  const [dotsUntil, setDotsUntil] = useState(0)
  const [loupe, setLoupe] = useState<{ it: WidgetItem; until: number } | null>(null)
  const [hint, setHint] = useState<{ msg: string; until: number }>({ msg: 'Appui long : menu · Glisser : écran suivant', until: Date.now() + 3500 })
  // Réglages changés d'un toucher pendant la sortie (profil, puissance, vue d'ensemble) : propres à la sortie, l'écran enregistré ne change pas.
  const [over, setOver] = useState<Record<string, Record<string, string | number | boolean>>>({})
  const [portrait, setPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)'), f = () => setPortrait(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])

  useEffect(() => { unlockAudio(); const id = setInterval(() => setTick(n => n + 1), 250); return () => clearInterval(id) }, [])
  useEffect(() => {
    const v = () => { if (document.visibilityState === 'visible' && ride.running) void ride.keepAwake() }
    document.addEventListener('visibilitychange', v)
    return () => document.removeEventListener('visibilitychange', v)
  }, [])

  const screen = screens.find(s => s.id === activeId) ?? screens[0]
  const now = new Date(), t = Date.now()
  const place = useMemo(() => ({ lat: route?.lat[0] ?? 48.85, lon: route?.lon[0] ?? 2.35 }), [route])
  const tone = theme === 'day' ? 0 : theme === 'night' ? 1 : nightAmount(now, place.lat, place.lon)
  const data = ride.data(now)
  const say = (msg: string) => setHint({ msg, until: Date.now() + HINT_MS })

  const goto = (dir: 1 | -1) => { set({ activeScreen: stepScreen(screens, screen.id, dir) }); setDotsUntil(Date.now() + 1000) }

  // Gestes sur tout l'écran : appui long = menu, glisser à l'horizontale = écran suivant. Un geste fait, le « click » qui suit est ignoré.
  const G = useRef<{ x: number; y: number; moved: boolean; t: ReturnType<typeof setTimeout> | null } | null>(null)
  const consumed = useRef(false)
  const inUi = (e: { target: EventTarget }) => !!(e.target as HTMLElement).closest('.ride-bar, .sheet, .sheet-back')
  const down = (e: React.PointerEvent) => {
    if (inUi(e)) return
    consumed.current = false
    const g = { x: e.clientX, y: e.clientY, moved: false, t: null as ReturnType<typeof setTimeout> | null }
    g.t = setTimeout(() => { if (!g.moved) { consumed.current = true; navigator.vibrate?.(30); setBarUntil(b => (Date.now() < b ? 0 : Date.now() + BAR_MS)) } }, LONG_MS)
    G.current = g
  }
  const move = (e: React.PointerEvent) => { const g = G.current; if (g && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12) { g.moved = true; if (g.t) clearTimeout(g.t) } }
  const up = (e: React.PointerEvent) => {
    const g = G.current; G.current = null
    if (!g) return
    if (g.t) clearTimeout(g.t)
    const dx = e.clientX - g.x, dy = e.clientY - g.y
    if (!consumed.current && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { consumed.current = true; goto(dx < 0 ? 1 : -1) }
  }

  // Toucher un widget : son action, sinon la loupe.
  const tapWidget = (it: WidgetItem) => {
    if (consumed.current) return true
    if (Date.now() < barUntil) { setBarUntil(0); return true }
    const a = TAP[it.k]
    navigator.vibrate?.(20)
    if (!a) { setLoupe({ it, until: Date.now() + LOUPE_MS }); return true }
    if (a.kind === 'lap') { ride.newLap(); return true }
    if (a.kind === 'done') { say(ride.ack() ? 'Fait' : 'Pas de rappel en attente'); return true }
    if (a.kind === 'overview') {
      setOver(o => ({ ...o, [it.id]: { ...o[it.id], overview: Date.now() + OVERVIEW_MS } }))
      say('Vue d’ensemble 10 s')
      return true
    }
    const cur = over[it.id]?.[a.key] ?? it.o?.[a.key], nx = nextOption(it.k, a.key, cur)
    if (nx) { setOver(o => ({ ...o, [it.id]: { ...o[it.id], [a.key]: nx.v } })); say(`${a.label} : ${nx.l}`) }
    return true
  }
  // Toucher le fond : referme la barre ou la loupe ; toucher le bandeau d'un rappel : Fait.
  const tapBack = (e: React.MouseEvent) => {
    if (inUi(e) || consumed.current) return
    if ((e.target as HTMLElement).closest('.dev-ban')) { if (ride.ack()) say('Fait'); return }
    if (Date.now() < barUntil) setBarUntil(0)
  }

  const style = { '--n': tone } as CSSProperties
  const items = itemsFor(screen, portrait).map(i => (over[i.id] ? { ...i, o: { ...i.o, ...over[i.id] } } : i))
  const L = loupe && t < loupe.until ? loupe.it : null
  const lsize = L ? (fitSize(L.k, (portrait ? PORTRAIT : LANDSCAPE).cols, (portrait ? PORTRAIT : LANDSCAPE).rows) ?? [L.w, L.h]) : null
  return (
    <div className={`ride dev${portrait ? ' port' : ''}`} style={style} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={tapBack}>
      <Device items={items} data={data} tone={tone} grid={portrait ? PORTRAIT : LANDSCAPE} className="full" onTap={tapWidget} />
      {L && lsize && (
        <div className="ride-loupe" role="dialog" aria-label={`${WIDGETS[L.k]} en grand`} onClick={e => { e.stopPropagation(); if (!consumed.current) setLoupe(null) }}>
          <div className="ride-loupe-box"><Device items={[{ ...L, x: 0, y: 0, w: lsize[0], h: lsize[1] }]} data={data} tone={tone} grid={{ cols: lsize[0], rows: lsize[1] }} className="full" /></div>
        </div>
      )}
      {t < hint.until && <div className="ride-hint" role="status">{hint.msg}</div>}
      {Date.now() < dotsUntil && screens.length > 1 && (
        <div className="dots" aria-hidden="true">{screens.map(s => <i key={s.id} className={s.id === screen.id ? 'on' : ''} />)}</div>
      )}
      {(t < barUntil || panel) && (
        <div className="ride-bar" role="toolbar" aria-label="Sortie">
          <button onClick={() => { setPanel('sensors'); setBarUntil(Infinity) }}><Icon name="bluetooth" size={22} />Capteurs</button>
          <button onClick={onAway}><Icon name="home" size={22} />Appli</button>
          <button onClick={() => setPanel('quit')}><Icon name="close" size={22} />Quitter</button>
        </div>
      )}
      {panel === 'sensors' && <Sheet title="Capteurs" onClose={() => { setPanel(null); setBarUntil(Date.now() + BAR_MS) }}><SensorsBlock /></Sheet>}
      {panel === 'quit' && (
        <Sheet title="Terminer la sortie ?" onClose={() => { setPanel(null); setBarUntil(Date.now() + BAR_MS) }}>
          <div className="stack">
            <button className="btn primary big" onClick={onExit}>Terminer</button>
            <button className="btn big" onClick={() => { setPanel(null); setBarUntil(Date.now() + BAR_MS) }}>Continuer</button>
          </div>
        </Sheet>
      )}
      {ride.warning() && <div className="ride-state" role="status">{ride.warning()}</div>}
    </div>
  )
}
