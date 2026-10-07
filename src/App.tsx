import { useEffect, useState } from 'react'
import { ride, type RideSource } from './ride/controller'
import { recorder } from './ride/recorder'
import type { Ride, RideSummary } from './library/types'
import { RideEnd } from './ui/RideEnd'
import { useLibrary } from './library/session'
import { pickScreen } from './storage/screens'
import { useStore } from './storage/store'
import { EcranTab } from './ui/EcranTab'
import { RoulerTab } from './ui/RoulerTab'
import { Sheet } from './ui/Sheet'
import type { RoadBookMeta } from './library/types'
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
  const [prep, setPrep] = useState(false)
  const onboarded = useStore(s => s.onboarded)

  useEffect(() => { const a = document.querySelector('main'); a?.scrollTo({ top: 0 }) }, [tab])
  const start = async (src: RideSource) => {
    const st = useStore.getState()
    if (!ride.hasRide) st.set({ activeScreen: pickScreen(st.screens, { rbScreen: useLibrary.getState().current?.startScreen, libre: st.libre, libreScreen: st.libreScreen, activeScreen: st.activeScreen }) })
    setRiding(true); await ride.start(src)
  }
  // Toute sortie passe par « Avant de partir » : road book, écran, capteurs, puis « Démarrer la sortie ».
  const prepare = async (m: RoadBookMeta | null) => {
    const st = useStore.getState()
    if (m && m.hasRoute) { await useLibrary.getState().open(m.id, false); st.set({ libre: false }) } else st.set({ libre: true })
    setPrep(true)
  }
  const prepareCurrent = () => { const lib = useLibrary.getState(); void prepare(lib.list.find(x => x.id === lib.current?.id) ?? null) }
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
        {tab === 'home' && <HomeTab go={setTab} onStart={start} onRide={m => void prepare(m)} onPrep={() => setPrep(true)} />}
        {tab === 'roadbooks' && <RoadBooksTab onRide={prepareCurrent} />}
        {tab === 'sorties' && <SortiesTab />}
        {tab === 'ecran' && <EcranTab />}
      </main>
      <nav className="nav" aria-label="Sections">
        {TABS.map(t => <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}><Icon name={t.icon} />{t.n}</button>)}
      </nav>
      {prep && <Sheet title="Avant de partir" onClose={() => setPrep(false)}><RoulerTab onStart={s => { setPrep(false); void start(s) }} /></Sheet>}
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
