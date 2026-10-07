/**
 * Galerie de développement (jamais publiée) : rend les écrans prêts à l'emploi et chaque widget à chaque taille
 * autorisée, avec les données d'aperçu. Sert aux captures automatiques (`npm run shots`).
 * Paramètres : ?v=screens|widgets &t=<modèle> &p=1 (portrait) &n=0|1 (jour/nuit) &src=power|hr
 */
import { createRoot } from 'react-dom/client'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow/latin-700.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '../index.css'
import '../ui/device.css'
import { previewData } from '../ride/data'
import { CATALOG } from '../storage/catalog'
import { LANDSCAPE, PORTRAIT, TEMPLATES, mkLayout, type WidgetItem } from '../storage/defaults'
import { portraitFrom } from '../storage/screens'
import { Device } from '../ui/Device'

const q = new URLSearchParams(location.search)
const view = q.get('v') ?? 'screens', night = q.get('n') !== '0', portrait = q.get('p') === '1'
const src = (q.get('src') ?? 'power') as 'power' | 'hr'
const data = previewData(src)

function Screens() {
  const t = (q.get('t') ?? 'course') as keyof typeof TEMPLATES, land = mkLayout(t)
  return (
    <div style={{ width: portrait ? 390 : 844, height: portrait ? 844 : 390 }}>
      <Device items={portrait ? portraitFrom(land) : land} grid={portrait ? PORTRAIT : LANDSCAPE} data={data} tone={night ? 1 : 0} className="full" />
    </div>
  )
}

function Widgets() {
  const kinds = q.get('k')?.split(',')
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {CATALOG.filter(d => !kinds || kinds.includes(d.k)).map(d => (
        <section key={d.k} data-k={d.k}>
          <div style={{ color: '#a3b0bc', font: '600 13px Barlow', margin: '0 0 6px' }}>{d.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
            {d.sizes.map(([w, h]) => {
              const it: WidgetItem = { id: 'g', k: d.k, x: 0, y: 0, w, h }
              return (
                <div key={`${w}${h}`} style={{ width: w * 140, height: h * 130 }}>
                  <Device items={[it]} data={data} tone={night ? 1 : 0} grid={{ cols: w, rows: h }} className="full" />
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(view === 'widgets' ? <Widgets /> : <Screens />)
