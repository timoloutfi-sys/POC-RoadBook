import { useEffect, useState } from 'react'
import { nf1 } from '../core/format'
import { ride, type RideSource } from '../ride/controller'
import { SENSORS, bluetoothAvailable, type SensorKind } from '../sensors/ble'
import { exportPlan, importPlan } from '../storage/transfer'
import { useStore } from '../storage/store'
import { Field, Num } from './fields'
import { Icon } from './icons'
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
  const connect = async (k: SensorKind) => {
    try { await ride.hub.connect(k) } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') return
      toast(e instanceof DOMException && e.name === 'SecurityError' ? 'Bluetooth bloqué dans cette page : ouvre-la en HTTPS.' : `Connexion impossible : ${e instanceof Error ? e.message : e}`)
    }
  }
  const resume = ride.hasRide && ride.src === 'live'
  return (
    <>
      <div>
        {route ? <Check s="ok" t={`Parcours : ${route.name}`} sm={`${nf1(route.total / 1000)} km, ${points.length} points, ${sections.length} sections`} /> : <Check s="wa" t="Aucun parcours chargé" sm="Les mesures et rappels marchent, pas les annonces du parcours." />}
        {bt ? <Check s="ok" t="Bluetooth disponible" /> : <Check s="ko" t="Bluetooth indisponible" sm="Utilise Chrome sur Android, en HTTPS." />}
        {geo ? <Check s="ok" t="Position GPS disponible" sm="Le suivi démarre avec la sortie." /> : <Check s="ko" t="Position indisponible" />}
        {wl ? <Check s="ok" t="Écran maintenu allumé pendant la sortie" /> : <Check s="wa" t="Maintien de l'écran non pris en charge" sm="Désactive la mise en veille du téléphone avant de partir." />}
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
      <p className="muted" style={{ margin: '8px 0 12px', fontSize: 14 }}>Sans capteur de puissance, la cible passe en battements par minute dès que la ceinture cardio est connectée.</p>
      <Field label="Circonférence de roue (mm)" hint="2146 mm pour un pneu 700 × 30. Pour plus de précision, mesure un tour de roue au sol, en charge."><Num value={wheel} min={1000} max={3000} onChange={v => v && set({ wheel: v })} /></Field>

      <h2 className="h2">Sortie</h2>
      <div className="stack">
        <button className="btn primary big" onClick={() => onStart('live')}>{resume ? 'Reprendre la sortie' : 'Démarrer la sortie'}</button>
        {resume && <button className="btn" onClick={() => { ride.newRide(); bump(n => n + 1); toast('Nouvelle sortie prête.') }}>Nouvelle sortie</button>}
      </div>
      <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>Pendant la sortie : appui long sur le bord droit = « Fait » (valide le rappel), glisser sur ce bord = écran suivant, appui long de 1,5 s sur le bord gauche = quitter. Garde ton GPS pour la navigation, ce téléphone dit comment courir.</p>

      <details className="fold">
        <summary>Répéter la sortie (simulation)</summary>
        <div>
          <p className="muted" style={{ marginBottom: 12 }}>Un coureur virtuel suit ton parcours dans la vraie vue de course, pour juger la lisibilité chez toi.</p>
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
          <p className="muted" style={{ marginBottom: 12 }}>Copie le plan ici pour le coller dans une autre page ou sur un autre téléphone.</p>
          <Field label="Plan"><textarea value={xfer} onChange={e => setXfer(e.target.value)} placeholder="Le texte du plan apparaît ici" spellCheck={false} /></Field>
          <div className="row">
            <button className="btn" onClick={() => { const c = useStore.getState(); const { route: r, set: _s, setRoute: _r, loadDemo: _l, detectClimbs: _d, replaceAll: _a, ...cfg } = c; setXfer(exportPlan(cfg, r)); toast('Plan généré : copie le texte.') }}>Exporter</button>
            <button className="btn" onClick={() => { try { const { cfg, route: r } = importPlan(xfer); useStore.getState().replaceAll(cfg, r); toast('Plan chargé.') } catch (e) { toast(e instanceof Error && e.message.includes('illisible') ? e.message : 'Texte illisible : colle un plan exporté par Road book.') } }}>Importer</button>
          </div>
        </div>
      </details>
    </>
  )
}
