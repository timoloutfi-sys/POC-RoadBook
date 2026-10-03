import { useEffect, useState } from 'react'
import { ride, type RideSource } from './ride/controller'
import { useLibrary } from './library/session'
import { useStore } from './storage/store'
import { EcranTab } from './ui/EcranTab'
import { Icon, type IconName } from './ui/icons'
import { ProfileSheet } from './ui/ProfileSheet'
import { RideView } from './ui/RideView'
import { RoadBooksTab } from './ui/RoadBooksTab'
import { RoulerTab } from './ui/RoulerTab'
import { Toaster } from './ui/toast'

const TABS: { id: string; n: string; icon: IconName }[] = [
  { id: 'roadbooks', n: 'Road books', icon: 'route' },
  { id: 'rouler', n: 'Rouler', icon: 'ride' },
  { id: 'ecran', n: 'Écrans', icon: 'screen' },
]
const TITLES: Record<string, string> = { roadbooks: 'Road books', rouler: 'Rouler', ecran: 'Écrans de course' }

export default function App() {
  const [tab, setTab] = useState('roadbooks')
  const [riding, setRiding] = useState(false)
  const [settings, setSettings] = useState(false)
  const onboarded = useStore(s => s.onboarded)

  useEffect(() => { const a = document.querySelector('main'); a?.scrollTo({ top: 0 }) }, [tab])
  const start = async (src: RideSource) => {
    const st = useStore.getState(), sc = useLibrary.getState().current?.startScreen
    if (!ride.hasRide && !st.libre && sc && st.screens.some(x => x.id === sc)) st.set({ activeScreen: sc })
    setRiding(true); await ride.start(src)
  }
  const exit = () => { ride.stop(); setRiding(false) }

  return (
    <div className="app">
      <header className="topbar">
        <h1>{TITLES[tab]}</h1>
        <button className="iconbtn" aria-label="Profil et réglages" onClick={() => setSettings(true)}><Icon name="settings" /></button>
      </header>
      <main>
        {tab === 'roadbooks' && <RoadBooksTab onRide={() => setTab('rouler')} />}
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
