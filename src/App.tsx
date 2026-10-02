import { useEffect, useState } from 'react'
import { ride, type RideSource } from './ride/controller'
import { useStore } from './storage/store'
import { EcranTab } from './ui/EcranTab'
import { Icon, type IconName } from './ui/icons'
import { ParcoursTab } from './ui/ParcoursTab'
import { PlanTab } from './ui/PlanTab'
import { ProfileSheet } from './ui/ProfileSheet'
import { RideView } from './ui/RideView'
import { RoulerTab } from './ui/RoulerTab'
import { Toaster } from './ui/toast'

const TABS: { id: string; n: string; icon: IconName }[] = [
  { id: 'parcours', n: 'Road book', icon: 'route' },
  { id: 'plan', n: 'Cibles', icon: 'plan' },
  { id: 'ecran', n: 'Écran', icon: 'screen' },
  { id: 'rouler', n: 'Rouler', icon: 'ride' },
]
const TITLES: Record<string, string> = { parcours: 'Road book', plan: 'Cibles', ecran: 'Écrans de course', rouler: 'Rouler' }

export default function App() {
  const [tab, setTab] = useState('parcours')
  const [riding, setRiding] = useState(false)
  const [settings, setSettings] = useState(false)
  const onboarded = useStore(s => s.onboarded)

  useEffect(() => { const a = document.querySelector('main'); a?.scrollTo({ top: 0 }) }, [tab])
  const start = async (src: RideSource) => { setRiding(true); await ride.start(src) }
  const exit = () => { ride.stop(); setRiding(false) }

  return (
    <div className="app">
      <header className="topbar">
        <h1>{TITLES[tab]}</h1>
        <button className="iconbtn" aria-label="Profil et réglages" onClick={() => setSettings(true)}><Icon name="settings" /></button>
      </header>
      <main>
        {tab === 'parcours' && <ParcoursTab />}
        {tab === 'plan' && <PlanTab />}
        {tab === 'ecran' && <EcranTab />}
        {tab === 'rouler' && <RoulerTab onStart={start} />}
      </main>
      <nav className="nav" aria-label="Sections">
        {TABS.map(t => <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}><Icon name={t.icon} />{t.n}</button>)}
      </nav>
      {(settings || !onboarded) && <ProfileSheet first={!onboarded} onClose={() => setSettings(false)} />}
      {riding && <RideView onExit={exit} />}
      <Toaster />
    </div>
  )
}
