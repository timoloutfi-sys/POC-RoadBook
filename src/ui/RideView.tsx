import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { nightAmount } from '../core/daynight'
import { unlockAudio } from '../ride/signal'
import { ride } from '../ride/controller'
import { useStore } from '../storage/store'
import { stepScreen } from '../storage/screens'
import { Device } from './Device'

const HOLD_QUIT_MS = 1500, HOLD_ACK_MS = 500

/** Vue de course plein écran. Gestes sur les bandes : appui long droite = Fait, glisser = écran suivant, appui long gauche = quitter. */
export function RideView({ onExit }: { onExit: () => void }) {
  const screens = useStore(s => s.screens), activeId = useStore(s => s.activeScreen), theme = useStore(s => s.rideTheme)
  const route = useStore(s => s.route), set = useStore(s => s.set)
  const [, setTick] = useState(0)
  const [quitP, setQuitP] = useState(0)
  const [dotsUntil, setDotsUntil] = useState(0)

  useEffect(() => { unlockAudio(); const id = setInterval(() => setTick(n => n + 1), 250); return () => clearInterval(id) }, [])
  useEffect(() => {
    const v = () => { if (document.visibilityState === 'visible' && ride.running) void ride.keepAwake() }
    document.addEventListener('visibilitychange', v)
    return () => document.removeEventListener('visibilitychange', v)
  }, [])

  const screen = screens.find(s => s.id === activeId) ?? screens[0]
  const now = new Date()
  const place = useMemo(() => ({ lat: route?.lat[0] ?? 48.85, lon: route?.lon[0] ?? 2.35 }), [route])
  const tone = theme === 'day' ? 0 : theme === 'night' ? 1 : nightAmount(now, place.lat, place.lon)
  const data = ride.data(now)

  const goto = (dir: 1 | -1) => { set({ activeScreen: stepScreen(screens, screen.id, dir) }); setDotsUntil(Date.now() + 1000) }

  // Bande droite : appui long = Fait, glissement vertical = changer d'écran.
  const R = useRef<{ y: number; moved: boolean; t: ReturnType<typeof setTimeout> | null; fired: boolean } | null>(null)
  const rDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const s = { y: e.clientY, moved: false, fired: false, t: null as ReturnType<typeof setTimeout> | null }
    s.t = setTimeout(() => { if (!s.moved) { s.fired = true; ride.ack(); navigator.vibrate?.(60) } }, HOLD_ACK_MS)
    R.current = s
  }
  const rMove = (e: React.PointerEvent) => { const s = R.current; if (s && Math.abs(e.clientY - s.y) > 30) s.moved = true }
  const rUp = (e: React.PointerEvent) => {
    const s = R.current; R.current = null
    if (!s) return
    if (s.t) clearTimeout(s.t)
    const dy = e.clientY - s.y
    if (!s.fired && Math.abs(dy) > 50) goto(dy < 0 ? 1 : -1)
  }

  // Bande gauche : maintenir 1,5 s pour quitter, la jauge se remplit.
  const L = useRef<number>(0)
  const lStart = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const t0 = performance.now()
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / HOLD_QUIT_MS)
      setQuitP(p)
      if (p >= 1) { L.current = 0; setQuitP(0); onExit(); return }
      L.current = requestAnimationFrame(step)
    }
    L.current = requestAnimationFrame(step)
  }
  const lEnd = () => { cancelAnimationFrame(L.current); setQuitP(0) }

  const style = { '--n': tone } as CSSProperties
  return (
    <div className="ride dev" style={style}>
      <div className="strip left" onPointerDown={lStart} onPointerUp={lEnd} onPointerCancel={lEnd} aria-label="Maintenir pour quitter"><div className="gauge" style={{ height: `${quitP * 100}%` }} /></div>
      <Device items={screen.items} data={data} tone={tone} />
      <div className="strip right" onPointerDown={rDown} onPointerMove={rMove} onPointerUp={rUp} onPointerCancel={rUp} aria-label="Appui long : fait. Glisser : écran suivant" />
      {Date.now() < dotsUntil && screens.length > 1 && (
        <div className="dots" aria-hidden="true">{screens.map(s => <i key={s.id} className={s.id === screen.id ? 'on' : ''} />)}</div>
      )}
      {ride.warning() && <div className="ride-state" role="status">{ride.warning()}</div>}
    </div>
  )
}
