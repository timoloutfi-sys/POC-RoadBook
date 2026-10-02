import { useState } from 'react'
import { ParcoursTab } from './ui/ParcoursTab'

const TABS = [
  { id: 'parcours', n: 'Parcours' },
  { id: 'plan', n: 'Plan' },
  { id: 'ecran', n: 'Écran' },
  { id: 'rouler', n: 'Rouler' },
] as const
type TabId = (typeof TABS)[number]['id']

const SOON: Record<Exclude<TabId, 'parcours'>, string> = {
  plan: "L'assistant de stratégie arrive à l'étape 3 : une question, un plan, des ajustements par zone.",
  ecran: "L'éditeur de l'écran de course et les alertes arrivent à l'étape 2.",
  rouler: 'Capteurs, sortie et répétition simulée arrivent à l’étape 2.',
}

export default function App() {
  const [tab, setTab] = useState<TabId>('parcours')
  return (
    <div className="app">
      <main>
        {tab === 'parcours' ? <ParcoursTab /> : (
          <>
            <h1 className="title">{TABS.find(t => t.id === tab)!.n}</h1>
            <p className="muted">{SOON[tab]}</p>
          </>
        )}
      </main>
      <nav className="nav" aria-label="Sections">
        {TABS.map(t => (
          <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>{t.n}</button>
        ))}
      </nav>
    </div>
  )
}
