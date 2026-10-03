import { useEffect, useState } from 'react'
import { nf1 } from '../core/format'
import { ride } from '../ride/controller'
import { SENSORS, bluetoothAvailable, bluetoothOn, inspectDevice, type Inspection, type SensorKind } from '../sensors/ble'
import { useStore } from '../storage/store'
import { Icon, type IconName } from './icons'
import { Sheet } from './Sheet'
import { toast } from './toast'

const KINDS: SensorKind[] = ['hr', 'power', 'cad', 'spd']
const ICON: Record<SensorKind, IconName> = { power: 'bolt', hr: 'heart', cad: 'cadence', spd: 'speed' }
const LABEL: Record<SensorKind, string> = { power: 'Puissance', hr: 'Cardio', cad: 'Cadence', spd: 'Vitesse' }
type Status = 'off' | 'on' | 'wait' | 'bad'

/** Gris : pas connecté · vert : connecté · orange : en cours · rouge : problème. */
function statusOf(k: SensorKind): Status {
  const s = ride.hub.sensors[k]?.state
  return s === 'connecté' ? 'on' : s === 'connexion…' || s === 'reconnexion…' ? 'wait' : s === 'perdu' || s === 'échec de connexion' ? 'bad' : 'off'
}
const STATE_TEXT: Record<Status, string> = { off: 'Non connecté', on: 'Connecté', wait: 'Connexion…', bad: 'Problème de connexion' }
const valueOf = (k: SensorKind) => { const v = ride.hub.vals[k]; return v == null ? '--' : k === 'spd' ? `${nf1(v * 3.6)} km/h` : `${Math.round(v)} ${k === 'power' ? 'W' : k === 'hr' ? 'bpm' : 'rpm'}` }

/** Un seul bloc : une icône par type de capteur, colorée selon son état. Il ouvre la gestion des capteurs. */
export function SensorsBlock() {
  const { sensors, set } = useStore()
  const [, bump] = useState(0)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'list' | 'add' | 'help'>('list')
  const [diag, setDiag] = useState<Inspection | 'wait' | 'none' | null>(null)
  const [btOn, setBtOn] = useState<boolean | null>(null)
  const bt = bluetoothAvailable()

  useEffect(() => {
    ride.hub.onChange = () => bump(n => n + 1)
    const id = setInterval(() => bump(n => n + 1), 1000)
    return () => { ride.hub.onChange = () => {}; clearInterval(id) }
  }, [])
  useEffect(() => { if (open) void bluetoothOn().then(setBtOn) }, [open])

  const connected = KINDS.filter(k => statusOf(k) === 'on').length
  const known = KINDS.filter(k => sensors[k] || ride.hub.sensors[k])
  const close = () => { setOpen(false); setStep('list'); setDiag(null) }

  const remember = (k: SensorKind) => { const d = ride.hub.sensors[k]?.dev; if (d) set({ sensors: { ...sensors, [k]: { id: d.id, name: d.name || LABEL[k] } } }) }
  const run = async (k: SensorKind, f: () => Promise<void>) => {
    try { await f(); remember(k); setStep('list') } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') { if (e.message.includes('Services')) toast(`Cet appareil n'envoie pas la ${LABEL[k].toLowerCase()} en Bluetooth.`); return }
      toast(e instanceof DOMException && e.name === 'SecurityError' ? 'Bluetooth bloqué dans cette page : ouvre-la en HTTPS.' : `Connexion impossible : ${e instanceof Error ? e.message : e}`)
    }
  }
  const forget = (k: SensorKind) => { ride.hub.disconnect(k); const next = { ...sensors }; delete next[k]; set({ sensors: next }) }
  const runDiag = async () => {
    setDiag('wait')
    try { setDiag(await inspectDevice()) }
    catch (e) { if (e instanceof DOMException && e.name === 'NotFoundError') setDiag('none'); else { setDiag(null); toast(`Diagnostic impossible : ${e instanceof Error ? e.message : e}`) } }
  }

  return (
    <>
      <button className="sensors-block" onClick={() => setOpen(true)} aria-label={`Capteurs : ${connected} sur 4 connectés`}>
        <span className="sicons">{KINDS.map(k => <span key={k} className={`st-${statusOf(k)}`} title={`${LABEL[k]} : ${STATE_TEXT[statusOf(k)]}`}><Icon name={ICON[k]} size={26} /></span>)}</span>
        <span className="grow"><b>Capteurs</b><small>{connected ? `${connected} connecté${connected > 1 ? 's' : ''}` : 'Aucun connecté'}</small></span>
        <Icon name="chevron" />
      </button>

      {open && (
        <Sheet title={step === 'list' ? 'Capteurs' : step === 'add' ? 'Nouveau capteur' : 'Capteur introuvable'} onClose={close}>
          {step !== 'list' && <button className="btn ghost" style={{ marginBottom: 8 }} onClick={() => setStep(step === 'help' ? 'add' : 'list')}>← Retour</button>}

          {step === 'list' && (
            <>
              {bt && btOn === false && <p className="notice">Bluetooth éteint : allume-le, ainsi que la position, dans les réglages du téléphone.</p>}
              <ul className="list">
                {known.map(k => {
                  const st = statusOf(k), saved = ride.hub.sensors[k]?.name ?? sensors[k]?.name
                  return (
                    <li key={k} className="srow">
                      <span className={`st-${st}`}><Icon name={ICON[k]} size={28} /></span>
                      <span className="grow"><b>{LABEL[k]}</b><small>{saved} · {STATE_TEXT[st]}{st === 'on' ? ` · ${valueOf(k)}` : ''}</small></span>
                      {st !== 'on' && st !== 'wait' && <button className="btn" disabled={!bt} onClick={() => void run(k, () => ride.hub.reconnect1(k, sensors[k] ?? { id: ride.hub.sensors[k]!.dev.id, name: saved ?? '' }))}>Connecter</button>}
                      <button className="btn ghost" aria-label={`Oublier ${LABEL[k]}`} onClick={() => forget(k)}>Retirer</button>
                    </li>
                  )
                })}
                {!known.length && <li className="muted" style={{ padding: '12px 0' }}>Aucun capteur enregistré.</li>}
              </ul>
              <button className="btn primary big" style={{ marginTop: 16 }} disabled={!bt} onClick={() => setStep('add')}><Icon name="plus" size={20} />Connecter un nouveau capteur</button>
            </>
          )}

          {step === 'add' && (
            <>
              <div className="stack">
                {KINDS.map(k => <button key={k} className="btn" disabled={!bt} onClick={() => void run(k, () => ride.hub.connect(k))}><Icon name={ICON[k]} size={22} />{LABEL[k]}</button>)}
              </div>
              <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setStep('help')}>Capteur introuvable ?</button>
            </>
          )}

          {step === 'help' && (
            <>
              <button className="btn primary big" onClick={() => void runDiag()} disabled={diag === 'wait'}>{diag === 'wait' ? 'Connexion…' : 'Tester un capteur'}</button>
              {diag && diag !== 'wait' && (
                <div style={{ margin: '12px 0' }}>
                  {diag === 'none' ? (
                    <p className="notice">Aucun appareil trouvé. Éteins ton compteur Bryton, réveille le capteur (pédale, ceinture mouillée), puis réessaie. Toujours rien : le capteur est en ANT+ seulement.</p>
                  ) : diag.usable.length ? (
                    <p><b style={{ color: 'var(--ok)' }}>✓ {diag.name}</b> envoie : {diag.usable.join(', ').toLowerCase()}. Il est utilisable : connecte-le depuis « Nouveau capteur ».</p>
                  ) : (
                    <p className="notice"><b>{diag.name}</b> ne donne aucune mesure en Bluetooth{diag.services.length ? ` (il n'envoie que : ${diag.services.join(', ').toLowerCase()})` : ''}. Il ne servira pas au téléphone.</p>
                  )}
                </div>
              )}
              <p className="muted" style={{ margin: '12px 0', fontSize: 14 }}>Le téléphone lit le Bluetooth, pas l'ANT+. Allume aussi la position du téléphone (Android en a besoin pour chercher).</p>
              <div className="stack">
                {KINDS.map(k => <button key={k} className="btn" onClick={() => void run(k, () => ride.hub.connect(k, true))}>Chercher tous les appareils : {LABEL[k].toLowerCase()}</button>)}
              </div>
            </>
          )}
        </Sheet>
      )}
    </>
  )
}

export { SENSORS }
