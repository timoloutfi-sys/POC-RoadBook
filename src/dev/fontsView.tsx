/** Planche de polices (dev, jamais publiée) : la même vue de course et les mêmes textes dans chaque police candidate. */
import { createRoot } from 'react-dom/client'
import type { CSSProperties } from 'react'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow/latin-700.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/inter-tight'
import '@fontsource-variable/geist'
import '@fontsource-variable/manrope'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/figtree'
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource-variable/roboto-flex'
import '../index.css'
import '../ui/device.css'
import './ios.css'
import { previewData } from '../ride/data'
import { LANDSCAPE, type WidgetItem } from '../storage/defaults'
import { HR_ZONES, POWER_ZONES } from '../strategy/zones'
import { Device } from '../ui/Device'

'a1a39a,5a82b3,489b6e,e2b540,f37420,cb2f43,59256a'.split(',').forEach((c, i) => { POWER_ZONES[i].c = `#${c}`; if (HR_ZONES[i]) HR_ZONES[i].c = `#${c}` })

const FONTS: { n: string; f: string; num: string; why: string; numCss?: CSSProperties }[] = [
  { n: 'Inter', f: 'Inter Variable', num: 'Inter Tight Variable', why: 'La plus proche de SF Pro (iOS). Neutre, très lisible.' },
  { n: 'Geist', f: 'Geist Variable', num: 'Geist Variable', why: 'Suisse et nette, un peu plus géométrique ; chiffres très propres.' },
  { n: 'Figtree', f: 'Figtree Variable', num: 'Figtree Variable', why: 'Géométrique et chaleureuse, arrondie sans être enfantine.' },
  { n: 'Manrope', f: 'Manrope Variable', num: 'Manrope Variable', why: 'Moderne, un peu technique, chiffres larges et ouverts.' },
  { n: 'DM Sans', f: 'DM Sans Variable', num: 'DM Sans Variable', why: 'Douce et compacte, très « appli ».' },
  { n: 'IBM Plex Sans', f: 'IBM Plex Sans Variable', num: 'IBM Plex Sans Variable', why: 'Caractère d’instrument, plus mécanique.' },
  { n: 'Roboto Flex (étroite pour les chiffres)', f: 'Roboto Flex Variable', num: 'Roboto Flex Variable', why: 'Celle d’Android, réglable en largeur : chiffres resserrés comme un compteur.', numCss: { fontStretch: '75%' } },
  { n: 'Barlow (actuelle)', f: 'Barlow', num: 'Barlow Condensed', why: 'Police actuelle de l’appli, chiffres très condensés.' },
]
const items: WidgetItem[] = [{ id: 'a', k: 'effort', x: 0, y: 0, w: 2, h: 2 }, { id: 'b', k: 'target', x: 2, y: 0, w: 2, h: 1 }, { id: 'c', k: 'arrival', x: 2, y: 1, w: 2, h: 1 }, { id: 'd', k: 'hr', x: 0, y: 2, w: 1, h: 1 }, { id: 'e', k: 'gap', x: 1, y: 2, w: 2, h: 1 }, { id: 'f', k: 'speed', x: 3, y: 2, w: 1, h: 1 }]
const grid = { ...LANDSCAPE, cols: 4 }
const d = previewData()

function Row({ x }: { x: (typeof FONTS)[number] }) {
  const v = { '--font': `'${x.f}', system-ui, sans-serif`, '--num': `'${x.num}', system-ui, sans-serif`, fontFamily: `'${x.f}'` } as CSSProperties
  return (
    <section style={{ ...v, display: 'flex', gap: 24, alignItems: 'center', padding: '18px 0', borderBottom: '1px solid #2c2c2e' }}>
      <div style={{ width: 420, color: '#fff' }}>
        <div style={{ font: `700 34px '${x.f}'`, letterSpacing: '-.02em' }}>Road books</div>
        <div style={{ font: `600 13px '${x.f}'`, color: '#8e8e93', marginTop: 4 }}>{x.n.toUpperCase()}</div>
        <div style={{ font: `400 17px '${x.f}'`, marginTop: 10 }}>Plat · Z2 · Endurance</div>
        <div style={{ font: `400 15px '${x.f}'`, color: 'rgba(235,235,245,.6)' }}>{x.why}</div>
        <div style={{ font: `600 44px '${x.num}'`, letterSpacing: '-.03em', marginTop: 8, fontVariantNumeric: 'tabular-nums', ...x.numCss }}>5 h 19 · 13:40 · 28,7</div>
      </div>
      <div className="fv" style={{ width: 560, height: 280, borderRadius: 14, overflow: 'hidden' }}>
        <Device items={items} data={d} tone={0} grid={grid} className="full" />
      </div>
      <style>{x.numCss ? `.fv .val { font-stretch: 75%; }` : ''}</style>
    </section>
  )
}
document.body.style.background = '#000'
const lin = '.dev { --day-bg: #ebe9e3; --day-cell: #fbfaf7; --day-ink: #1c1b18; --day-mut: #77736b; --day-shadow: 0 1px 2px rgba(60, 50, 30, .08); }'
createRoot(document.getElementById('root')!).render(<div style={{ padding: '8px 24px' }}><style>{lin}</style>{FONTS.map(x => <Row key={x.n} x={x} />)}</div>)
