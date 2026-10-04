import { useEffect, useState } from 'react'
import { ride, type RideSource } from './ride/controller'
import { recorder } from './ride/recorder'
import type { Ride, RideSummary } from './library/types'
import { RideEnd } from './ui/RideEnd'
import { useLibrary } from './library/session'
import { useStore } from './storage/store'
import { EcranTab } from './ui/EcranTab'
import { Icon, type IconName } from './ui/icons'
import { ProfileSheet } from './ui/ProfileSheet'
import { RideView } from './ui/RideView'
import { RoadBooksTab } from './ui/RoadBooksTab'
import { SortiesTab } from './ui/SortiesTab'
import { HomeTab } from './ui/HomeTab'
import { Toaster, toast } from './ui/toast'

const TABS: { id: string; n: string; icon: IconName }[] = [
  { id: 'home', n: 'Accueil', icon: 'home' },
  { id: 'roadbooks', n: 'Road books', icon: 'route' },
  { id: 'sorties', n: 'Sorties', icon: 'history' },
  { id: 'ecran', n: 'Écrans', icon: 'screen' },
]
const TITLES: Record<string, string> = { home: 'Accueil', roadbooks: 'Road books', sorties: 'Sorties', ecran: 'Écrans de course' }

export default function App() {
  const [tab, setTab] = useState('home')
  const [riding, setRiding] = useState(false)
  const [settings, setSettings] = useState(false)
  const onboarded = useStore(s => s.onboarded)

  useEffect(() => { const a = document.querySelector('main'); a?.scrollTo({ top: 0 }) }, [tab])
  const start = async (src: RideSource) => {
    const st = useStore.getState(), sc = useLibrary.getState().current?.startScreen
    if (!ride.hasRide && !st.libre && sc && st.screens.some(x => x.id === sc)) st.set({ activeScreen: sc })
    setRiding(true); await ride.start(src)
  }
  const [end, setEnd] = useState<{ ride: Ride; summary: RideSummary } | null>(null)
  const exit = async () => {
    ride.stop(); setRiding(false)
    if (ride.src !== 'live' || !recorder.active) return
    const p = await recorder.preview(ride.remindersShown())
    if (p && p.summary.moving >= 60 && p.summary.km >= 0.1) setEnd(p)
    else { await recorder.discard(); ride.newRide() }
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>{TITLES[tab]}</h1>
        <button className="iconbtn" aria-label="Profil et réglages" onClick={() => setSettings(true)}><Icon name="settings" /></button>
      </header>
      <main>
        {tab === 'home' && <HomeTab go={setTab} onStart={start} />}
        {tab === 'roadbooks' && <RoadBooksTab onRide={() => void start('live')} />}
        {tab === 'sorties' && <SortiesTab />}
        {tab === 'ecran' && <EcranTab />}
      </main>
      <nav className="nav" aria-label="Sections">
        {TABS.map(t => <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}><Icon name={t.icon} />{t.n}</button>)}
      </nav>
      {(settings || !onboarded) && <ProfileSheet first={!onboarded} onClose={() => setSettings(false)} />}
      {riding && <RideView onExit={() => void exit()} />}
      {end && (
        <RideEnd ride={end.ride} summary={end.summary}
          onSave={async name => { await recorder.finish(name, ride.remindersShown()); ride.newRide(); setEnd(null); toast('Sortie enregistrée.') }}
          onResume={() => { setEnd(null); void start('live') }}
          onDelete={async () => { await recorder.discard(); ride.newRide(); setEnd(null) }} />
      )}
      <Toaster />
    </div>
  )
}
