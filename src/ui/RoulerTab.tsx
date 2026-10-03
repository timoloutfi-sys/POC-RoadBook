import { useEffect, useState } from 'react'
import { nf1 } from '../core/format'
import { ride, type RideSource } from '../ride/controller'
import { SENSORS, bluetoothAvailable, type SensorKind } from '../sensors/ble'
import { exportPlan, importPlan } from '../storage/transfer'
import { pickConfig, useStore } from '../storage/store'
import { Field, Num } from './fields'
import { Icon } from './icons'
import { Sheet } from './Sheet'
import { toast } from './toast'

const Check = ({ s, t, sm }: { s: 'ok' | 'ko' | 'wa'; t: string; sm?: string }) => (
  <div className={`check ${s}`}><b aria-hidden="true">{s === 'ok' ? '✓' : s === 'ko' ? '✕' : '!'}</b><span>{t}{sm && <small>{sm}</small>}</span></div>
)

export function RoulerTab({ onStart }: { onStart: (src: RideSource) => void }) {
  const { route, points, sections, wheel, set } = useStore()
  const [, bump] = useState(0)
  const [opts, setOpts] = useState(ride.simOpts)
  const [xfer, setXfer] = useState('')
  useEffect(() => {
    ride.hub.onChange = () => bump(n => n + 1)
    const id = setInterval(() => bump(n => n + 1), 1000)
    return () => { ride.hub.onChange = () => {}; clearInterval(id) }
  }, [])
  const bt = bluetoothAvailable(), geo = 'geolocation' in navigator, wl = 'wakeLock' in navigator
  const upd = (p: Partial<typeof opts>) => { const o = { ...opts, ...p }; ride.simOpts = o; setOpts(o) }
  const [lost, setLost] = useState(false)
  const connect = async (k: SensorKind, all = false) => {
    try { await ride.hub.connect(k, all) } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') { if (e.message.includes('Services')) toast(`Cet appareil n'envoie pas la ${SENSORS[k].n.toLowerCase()} en Bluetooth.`); return }
      toast(e instanceof DOMException && e.name === 'SecurityError' ? 'Bluetooth bloqué dans cette page : ouvre-la en HTTPS.' : `Connexion impossible : ${e instanceof Error ? e.message : e}`)
    }
  }
  const resume = ride.hasRide && ride.src === 'live'
  return (
    <>
      <div>
        {route ? <Check s="ok" t={`Parcours : ${route.name}`} sm={`${nf1(route.total / 1000)} km, ${points.length} points, ${sections.length} sections`} /> : <Check s="wa" t="Aucun parcours chargé" />}
        {bt ? <Check s="ok" t="Bluetooth disponible" /> : <Check s="ko" t="Bluetooth indisponible" sm="Chrome sur Android, en HTTPS" />}
        {geo ? <Check s="ok" t="Position GPS disponible" /> : <Check s="ko" t="Position indisponible" />}
        {wl ? <Check s="ok" t="Écran maintenu allumé pendant la sortie" /> : <Check s="wa" t="Maintien de l'écran non pris en charge" sm="Désactive la mise en veille du téléphone" />}
      </div>

      <h2 className="h2">Capteurs</h2>
      <div className="stack">
        {(Object.keys(SENSORS) as SensorKind[]).map(k => {
          const s = ride.hub.sensors[k], v = ride.hub.vals[k]
          return s ? (
            <div className="check ok" key={k} style={{ alignItems: 'center' }}>
              <b><Icon name="bluetooth" size={20} /></b>
              <span className="grow">{SENSORS[k].n} · {s.name}<small>{s.state}</small></span>
              <b style={{ width: 'auto', fontSize: 20 }}>{v == null ? '--' : k === 'spd' ? nf1(v * 3.6) : Math.round(v)}</b>
              <button className="btn ghost" onClick={() => ride.hub.disconnect(k)}>Retirer</button>
            </div>
          ) : <button key={k} className="btn" disabled={!bt} onClick={() => void connect(k)}><Icon name="plus" size={20} />Capteur de {SENSORS[k].n.toLowerCase()}</button>
        })}
      </div>
      <button className="btn ghost" style={{ marginTop: 4 }} onClick={() => setLost(true)} disabled={!bt}>Capteur introuvable ?</button>
      <Field label="Circonférence de roue (mm)" hint="2146 mm = pneu 700 × 30"><Num value={wheel} min={1000} max={3000} onChange={v => v && set({ wheel: v })} /></Field>

      {lost && (
        <Sheet title="Capteur introuvable" onClose={() => setLost(false)}>
          <ul className="why" style={{ marginBottom: 16 }}>
            <li>Le téléphone lit le <b>Bluetooth</b>, pas l'ANT+. Il faut un capteur double (ANT+ et Bluetooth).</li>
            <li>Réveille-le : pédale, ou mouille la ceinture.</li>
            <li>Libère-le : un capteur est souvent limité à une connexion Bluetooth. Passe ton Bryton en ANT+ pour ce capteur.</li>
          </ul>
          <div className="stack">
            {(Object.keys(SENSORS) as SensorKind[]).map(k => <button key={k} className="btn" onClick={() => { setLost(false); void connect(k, true) }}>Chercher tous les appareils : {SENSORS[k].n.toLowerCase()}</button>)}
          </div>
        </Sheet>
      )}

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
