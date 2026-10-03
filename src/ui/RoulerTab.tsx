import { useEffect, useState } from 'react'
import { nf1 } from '../core/format'
import { ride, type RideSource } from '../ride/controller'
import { bluetoothAvailable, bluetoothOn } from '../sensors/ble'
import { exportPlan, importPlan } from '../storage/transfer'
import { pickConfig, useStore } from '../storage/store'
import { Field, Num } from './fields'
import { SensorsBlock } from './SensorsBlock'
import { toast } from './toast'

const Check = ({ s, t, sm }: { s: 'ok' | 'ko' | 'wa'; t: string; sm?: string }) => (
  <div className={`check ${s}`}><b aria-hidden="true">{s === 'ok' ? '✓' : s === 'ko' ? '✕' : '!'}</b><span>{t}{sm && <small>{sm}</small>}</span></div>
)

export function RoulerTab({ onStart }: { onStart: (src: RideSource) => void }) {
  const { route, points, sections } = useStore()
  const [, bump] = useState(0)
  const [opts, setOpts] = useState(ride.simOpts)
  const [xfer, setXfer] = useState('')
  useEffect(() => { const id = setInterval(() => bump(n => n + 1), 1000); return () => clearInterval(id) }, [])
  const bt = bluetoothAvailable(), geo = 'geolocation' in navigator, wl = 'wakeLock' in navigator
  const upd = (p: Partial<typeof opts>) => { const o = { ...opts, ...p }; ride.simOpts = o; setOpts(o) }
  const [btOn, setBtOn] = useState<boolean | null>(null)
  useEffect(() => { void bluetoothOn().then(setBtOn) }, [])
  const resume = ride.hasRide && ride.src === 'live'
  return (
    <>
      <div>
        {route ? <Check s="ok" t={`Parcours : ${route.name}`} sm={`${nf1(route.total / 1000)} km, ${points.length} points, ${sections.length} sections`} /> : <Check s="wa" t="Aucun parcours chargé" />}
        {bt && btOn === false ? <Check s="ko" t="Bluetooth éteint" sm="Allume-le, ainsi que la position, dans les réglages du téléphone" /> : bt ? <Check s="ok" t="Bluetooth disponible" /> : <Check s="ko" t="Bluetooth indisponible" sm="Chrome sur Android, en HTTPS" />}
        {geo ? <Check s="ok" t="Position GPS disponible" /> : <Check s="ko" t="Position indisponible" />}
        {wl ? <Check s="ok" t="Écran maintenu allumé pendant la sortie" /> : <Check s="wa" t="Maintien de l'écran non pris en charge" sm="Désactive la mise en veille du téléphone" />}
      </div>

      <h2 className="h2">Capteurs</h2>
      <SensorsBlock />

      <h2 className="h2">Sortie</h2>
      <div className="stack">
        <button className="btn primary big" onClick={() => onStart('live')}>{resume ? 'Reprendre la sortie' : 'Démarrer la sortie'}</button>
        {resume && <button className="btn" onClick={() => { ride.newRide(); bump(n => n + 1); toast('Nouvelle sortie prête.') }}>Nouvelle sortie</button>}
      </div>
      <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>Bord droit : appui long = Fait, glisser = écran suivant. Bord gauche : maintenir = quitter.</p>

      <details className="fold">
        <summary>Répéter la sortie (simulation)</summary>
        <div>
          <div className="cols2">
            <Field label="Vitesse"><select value={opts.speed} onChange={e => upd({ speed: +e.target.value })}><option value={10}>× 10</option><option value={30}>× 30</option><option value={60}>× 60</option><option value={120}>× 120</option></select></Field>
            <Field label="Coureur"><select value={opts.behavior} onChange={e => upd({ behavior: +e.target.value })}><option value={0.1}>Discipliné</option><option value={0.3}>Normal</option><option value={0.8}>Fougueux</option></select></Field>
            <Field label="Départ au km"><Num value={opts.startKm} min={0} onChange={v => upd({ startKm: v ?? 0 })} /></Field>
            <Field label="Capteurs"><select value={opts.noPower ? 'hr' : 'power'} onChange={e => upd({ noPower: e.target.value === 'hr' })}><option value="power">Avec puissance</option><option value="hr">Cardio seul</option></select></Field>
          </div>
          <button className="btn" disabled={!route} onClick={() => onStart('sim')}>{route ? 'Lancer la répétition' : 'Charge un parcours pour répéter'}</button>
        </div>
      </details>

      <details className="fold">
        <summary>Transférer le plan</summary>
        <div>
          <Field label="Plan"><textarea value={xfer} onChange={e => setXfer(e.target.value)} placeholder="Le texte du plan apparaît ici" spellCheck={false} /></Field>
          <div className="row">
            <button className="btn" onClick={() => { const c = useStore.getState(); setXfer(exportPlan(pickConfig(c), c.route)); toast('Plan généré : copie le texte.') }}>Exporter</button>
            <button className="btn" onClick={() => { try { const { cfg, route: r } = importPlan(xfer); useStore.getState().replaceAll(cfg, r); toast('Plan chargé.') } catch (e) { toast(e instanceof Error && e.message.includes('illisible') ? e.message : 'Texte illisible : colle un plan exporté par Road book.') } }}>Importer</button>
          </div>
        </div>
      </details>
    </>
  )
}
