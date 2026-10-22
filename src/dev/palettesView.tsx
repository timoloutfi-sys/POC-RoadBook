/** Planche d'une palette Wada (dev, jamais publiée) : nuancier nommé, écran de course jour et nuit. ?p=<id> */
import { createRoot } from 'react-dom/client'
import type { CSSProperties } from 'react'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow/latin-700.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '../index.css'
import '../ui/device.css'
import { previewData } from '../ride/data'
import { LANDSCAPE, mkLayout } from '../storage/defaults'
import { HR_ZONES, POWER_ZONES } from '../strategy/zones'
import { Device } from '../ui/Device'
import { PALETTES, deviceCss, rootCss, type C } from './palettes'

const p = PALETTES.find(x => x.id === new URLSearchParams(location.search).get('p')) ?? PALETTES[0]
p.zones.forEach((z, i) => { POWER_ZONES[i].c = z.hex; if (i < 5) HR_ZONES[i].c = z.hex })
const st = document.createElement('style')
st.textContent = `:root { ${rootCss(p)} } .pal .dev { ${deviceCss(p)} }`
document.head.appendChild(st)
document.body.style.background = p.night.bg.hex

const Chip = ({ c, role }: { c: C; role: string }) => (
  <div style={{ width: 118 }}>
    <div style={{ height: 44, borderRadius: 8, background: c.hex, border: '1px solid rgba(255,255,255,.18)' }} />
    <div style={{ font: '700 12px Barlow', color: p.night.ink.hex, marginTop: 4 }}>{role}</div>
    <div style={{ font: '400 11px Barlow', color: p.night.mut.hex }}>{c.n} · {c.hex}</div>
  </div>
)
const Row = ({ title, items }: { title: string; items: [string, C][] }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ font: '600 13px Barlow', color: p.night.mut.hex, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{title}</div>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{items.map(([r, c]) => <Chip key={r} c={c} role={r} />)}</div>
  </div>
)

function View() {
  const items = mkLayout('course'), d = previewData()
  return (
    <div className="pal" style={{ padding: 20, width: 1760 }}>
      <div style={{ font: '700 28px Barlow', color: p.night.ink.hex }}>{p.name} <span style={{ font: '600 16px Barlow', color: p.night.mut.hex }}>· Wada, combinaisons n° {p.combos.join(' et ')}</span></div>
      <div style={{ font: '400 16px Barlow', color: p.night.mut.hex, margin: '4px 0 16px', maxWidth: 1100 }}>{p.idea}</div>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <Row title="Nuit" items={[['Fond', p.night.bg], ['Case', p.night.cell], ['Trait', p.night.line], ['Texte', p.night.ink], ['Texte discret', p.night.mut]]} />
          <Row title="Jour" items={[['Fond', p.day.bg], ['Case', p.day.cell], ['Trait', p.day.line], ['Texte', p.day.ink], ['Texte discret', p.day.mut]]} />
          <Row title="Rôles" items={[['Accent (jour)', p.accent], ['Accent (nuit)', p.accentNight], ['Navigation', p.nav], ['Dans la cible', p.ok], ['Au-dessus (début)', p.warn], ['Au-dessus (fort)', p.hi], ['En dessous (début)', p.lo], ['En dessous (fort)', p.loDeep]]} />
          <Row title="Zones Z1 à Z7" items={p.zones.map((z, i) => [`Z${i + 1}`, z] as [string, C])} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[0, 1].map(n => (
            <div key={n} style={{ width: 844, height: 390, borderRadius: 12, overflow: 'hidden' } as CSSProperties}>
              <Device items={items} data={d} tone={n} grid={LANDSCAPE} className="full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<View />)
