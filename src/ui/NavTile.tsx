import { lazy, Suspense, type CSSProperties } from 'react'
import { nf1 } from '../core/format'
import type { NavView } from '../ride/nav'
import type { Turn } from '../route/turns'

/** Couleurs de la navigation : carmin (Wada n° 221) pour le tracé et les consignes, ocre pour « hors parcours ». */
export const NAV = '#a62c37', OFF = '#e2b540', OFF_INK = '#1c1b18'

const NavMap = lazy(() => import('./NavMap'))

export const fm = (m: number) => (m < 1000 ? `${Math.max(0, Math.round(m / 10) * 10)} m` : `${nf1(m / 1000)} km`)
export const turnWord = (x: Turn) => (x.kind === 'demi' ? 'Demi-tour' : x.kind === 'serre' ? `Serré à ${x.side}` : x.kind === 'leger' ? `Légèrement à ${x.side}` : `À ${x.side}`)

/** Flèche de virage : tige verticale, coude de l'angle du virage, pointe dans l'axe de sortie. Sans virage : tout droit. */
export function TurnArrow({ turn, size = 64, color = 'currentColor' }: { turn: Turn | null; size?: number; color?: string }) {
  const a = turn ? (turn.side === 'droite' ? 1 : -1) * Math.min(turn.angle, 160) : 0
  const r = (a * Math.PI) / 180, sx = Math.sin(r), cy = Math.cos(r)
  const ex = 50 + 26 * sx, ey = 52 - 26 * cy, tx = ex + 16 * sx, ty = ey - 16 * cy, px = -cy, py = -sx
  const head = `M${tx.toFixed(1)} ${ty.toFixed(1)} L${(ex + 13 * px).toFixed(1)} ${(ey + 13 * py).toFixed(1)} L${(ex - 13 * px).toFixed(1)} ${(ey - 13 * py).toFixed(1)} Z`
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden style={{ flex: 'none' }}>
      <path d={`M50 96 L50 64 Q50 52 ${(50 + 12 * sx).toFixed(1)} ${(52 - 12 * cy).toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d={head} fill={color} stroke={color} strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}

/** Boussole hors parcours : la flèche montre où est le tracé par rapport à ta marche. */
export function OffArrow({ rel, size = 64 }: { rel: number; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden style={{ flex: 'none', transform: `rotate(${rel}deg)` }}>
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="6" />
      <path d="M50 10 L72 58 L50 48 L28 58 Z" fill="currentColor" />
    </svg>
  )
}

/** Fond de l'aperçu (éditeur, vignettes) : un bout de carte dessiné, sans réseau ni WebGL. */
function PreviewMap() {
  return (
    <svg className="nav-prev" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="200" height="120" fill="var(--nav-land)" />
      <path d="M-10 30 Q60 40 120 20 T210 30 M30 -10 L60 130 M150 -10 Q140 60 170 130" stroke="var(--nav-road)" strokeWidth="5" fill="none" />
      <path d="M100 130 L100 70 Q100 52 120 50 L210 44" stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M100 130 L100 70 Q100 52 120 50 L210 44" stroke={NAV} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const Map = ({ nav, small, pitch, side, overview }: { nav: NavView; small: boolean; pitch: number; side: number; overview: boolean }) =>
  nav.preview ? <PreviewMap /> : <Suspense fallback={null}><NavMap nav={nav} small={small} pitch={pitch} side={side} overview={overview} /></Suspense>

const big = (px: number): CSSProperties => ({ fontFamily: 'var(--num)', fontWeight: 650, fontSize: px, lineHeight: 1, letterSpacing: '-.03em' })

/** Widget Navigation : prochain virage sur un mini fond de carte en petit, carte en perspective en grand ; hors parcours, plaque ocre. */
/** `overview` : vue d'ensemble (carte vue de haut, dézoomée), après un toucher pendant la sortie. */
export function NavW({ nav, w, h, overview = false }: { nav: NavView | null; w: number; h: number; overview?: boolean }) {
  if (!nav) return <><div className="lab">Navigation</div><div className="val dim">--</div><div className="sub dim">Parcours requis</div></>
  const off = nav.off, small = h === 1
  const plate: CSSProperties = { background: off ? OFF : NAV, color: off ? OFF_INK : '#fff' }
  // Sans virage d'ici l'arrivée : « Tout droit », et la distance qui reste.
  const t = nav.turn, label = off ? 'Hors parcours' : t ? turnWord(t) : nav.left > 50 ? 'Tout droit' : 'Arrivée'
  const dist = off ? fm(off.m) : nav.inM != null ? fm(nav.inM) : fm(nav.left)
  const icon = (px: number) => off ? <OffArrow rel={off.rel} size={px} /> : <TurnArrow turn={t} size={px} color="#fff" />
  return (
    <div className={`nav-w${small ? ' sm' : ''}`} aria-label={`${label}${dist ? `, ${dist}` : ''}${off ? `, tracé ${off.side}` : ''}`}>
      <Map nav={nav} small={small} pitch={small ? 0 : 50} side={small && w > 1 ? 0.55 : 0} overview={overview} />
      {small ? (
        <div className={`nav-plate${w === 1 ? ' one' : ''}`} style={plate}>
          {icon(w === 1 ? 32 : 44)}
          <div className="nav-txt">
            <div style={big(w === 1 ? 22 : 26)}>{dist || label}</div>
            {w > 1 && <div className="nav-l">{off ? `tracé ${off.side}` : label}</div>}
            {w > 1 && !off && nav.then && nav.thenM != null && <div className="nav-then">puis {fm(nav.thenM)}</div>}
          </div>
        </div>
      ) : (
        <div className="nav-band" style={plate}>
          {icon(w * h <= 4 ? 40 : 50)}
          <div className="nav-txt" style={{ flex: 1 }}>
            <div style={big(w * h <= 4 ? 28 : 34)}>{off ? 'Hors parcours' : dist || label}</div>
            <div className="nav-l">{off ? `${w <= 2 ? '' : 'tracé '}${off.side} · ${dist}` : dist ? label : ''}</div>
          </div>
          {!off && w >= 3 && nav.then && nav.thenM != null && <div className="nav-then row-then">puis <TurnArrow turn={nav.then} size={26} color="#fff" /> {fm(nav.thenM)}</div>}
        </div>
      )}
      {!small && !nav.preview && <span className="nav-attr">© OpenStreetMap · OpenFreeMap</span>}
    </div>
  )
}
