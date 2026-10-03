import { useState } from 'react'
import { cdaFromFlat } from '../physics/physics'
import { effectiveFtp, effectiveLthr, ftpIsEstimated, type Rider } from '../strategy/rider'
import { useStore } from '../storage/store'
import type { RideTheme } from '../storage/defaults'
import { Field, Num } from './fields'
import { Sheet } from './Sheet'

const POS = [
  { n: 'Cocottes (0,32)', v: 0.32 },
  { n: 'Bas du cintre (0,28)', v: 0.28 },
  { n: 'Prolongateurs (0,25)', v: 0.25 },
  { n: 'Ultra avec sacoches (0,35)', v: 0.35 },
  { n: 'Position relevée (0,38)', v: 0.38 },
]
const ROAD = [
  { n: 'Route lisse, bons pneus', v: 0.004 },
  { n: 'Route normale', v: 0.005 },
  { n: 'Route dégradée', v: 0.007 },
  { n: 'Gravel', v: 0.01 },
]

/** Profil coureur : demandé au premier lancement, puis accessible par l'icône réglages. */
export function ProfileSheet({ first, onClose }: { first: boolean; onClose: () => void }) {
  const { rider, rideTheme, maxPerHour, wheel, set } = useStore()
  const [r, setR] = useState<Rider>(rider)
  const [theme, setTheme] = useState<RideTheme>(rideTheme)
  const [cap, setCap] = useState<number | null>(maxPerHour)
  const [wh, setWh] = useState<number | null>(wheel)
  const [calW, setCalW] = useState<number | null>(null)
  const [calV, setCalV] = useState<number | null>(null)
  const est = ftpIsEstimated(r), ftp = effectiveFtp(r), lthr = effectiveLthr(r)
  const save = () => { set({ rider: r, rideTheme: theme, maxPerHour: Math.max(1, cap ?? 10), wheel: wh && wh >= 1000 ? wh : wheel, onboarded: true }); onClose() }
  const dismiss = () => { set({ onboarded: true }); onClose() }
  return (
    <Sheet title={first ? 'Ton profil' : 'Réglages'} onClose={first ? dismiss : onClose}>
      <Field label="Je règle mes cibles en">
        <div className="seg" role="group" aria-label="Unité des cibles">
          <button type="button" aria-pressed={r.hasPower !== false} onClick={() => setR({ ...r, hasPower: true })}>Watts</button>
          <button type="button" aria-pressed={r.hasPower === false} onClick={() => setR({ ...r, hasPower: false })}>Cardio (bpm)</button>
        </div>
      </Field>
      {r.hasPower === false && !r.lthr && !r.hrMax && <p className="notice" style={{ marginBottom: 12 }}>Renseigne ta FC seuil ou ta FC max.</p>}
      <div className="cols2">
        <Field label="Masse, vélo compris (kg)"><Num value={r.mass} min={40} max={200} step={0.5} onChange={v => v && setR({ ...r, mass: v })} /></Field>
        <Field label={r.hasPower === false ? 'FTP (W), facultative' : 'FTP (W)'} hint={est ? `Estimée : ${ftp} W` : undefined}><Num value={r.ftp} min={80} max={600} placeholder="Je ne la connais pas" onChange={v => setR({ ...r, ftp: v })} /></Field>
        {est && <Field label="Vitesse sur le plat (km/h)" hint="Moyenne sur 2 h, sans vent"><Num value={r.flatSpeed} min={15} max={50} step={0.5} onChange={v => setR({ ...r, flatSpeed: v })} /></Field>}
        <Field label="FC au seuil (bpm)" hint={r.lthr ? undefined : lthr ? `Estimée : ${lthr} bpm` : undefined}><Num value={r.lthr} min={100} max={220} placeholder="Facultatif" onChange={v => setR({ ...r, lthr: v })} /></Field>
        <Field label="FC max (bpm)"><Num value={r.hrMax} min={120} max={230} placeholder="Facultatif" onChange={v => setR({ ...r, hrMax: v })} /></Field>
        <Field label="Position">
          <select value={POS.find(p => Math.abs(p.v - r.cda) < 0.001)?.v ?? ''} onChange={e => e.target.value && setR({ ...r, cda: +e.target.value })}>
            <option value="">CdA {r.cda.toFixed(2).replace('.', ',')}</option>
            {POS.map(p => <option key={p.v} value={p.v}>{p.n}</option>)}
          </select>
        </Field>
        <Field label="Route et pneus">
          <select value={r.crr ?? 0.005} onChange={e => setR({ ...r, crr: +e.target.value })}>
            {ROAD.map(p => <option key={p.v} value={p.v}>{p.n}</option>)}
          </select>
        </Field>
      </div>
      <details className="fold" style={{ marginTop: 0, marginBottom: 12 }}>
        <summary>Calibrer avec une sortie réelle</summary>
        <div>
          <div className="cols2">
            <Field label="Puissance sur le plat (W)"><Num value={calW} min={80} max={500} onChange={setCalW} /></Field>
            <Field label="Vitesse obtenue (km/h)"><Num value={calV} min={15} max={50} step={0.5} onChange={setCalV} /></Field>
          </div>
          <button type="button" className="btn" disabled={!calW || !calV} onClick={() => calW && calV && setR({ ...r, cda: +cdaFromFlat(r.mass, r.crr ?? 0.005, calW, calV).toFixed(3) })}>Calculer mon CdA</button>
          <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>CdA actuel : {r.cda.toFixed(3).replace('.', ',')} m²</p>
        </div>
      </details>
      {!first && (
        <>
          <Field label="Thème de la vue de course">
            <select value={theme} onChange={e => setTheme(e.target.value as RideTheme)}><option value="auto">Auto selon le soleil</option><option value="day">Toujours clair</option><option value="night">Toujours sombre</option></select>
          </Field>
          <Field label="Circonférence de roue (mm)" hint="2146 mm = pneu 700 × 30"><Num value={wh} min={1000} max={3000} onChange={setWh} /></Field>
          <Field label="Alertes de seuil par heure au plus"><Num value={cap} min={1} max={60} onChange={setCap} /></Field>
        </>
      )}
      <div className="row"><button className="btn primary grow" onClick={save}>Enregistrer</button><button className="btn" onClick={first ? dismiss : onClose}>{first ? 'Plus tard' : 'Annuler'}</button></div>
    </Sheet>
  )
}
