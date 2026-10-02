import { useState } from 'react'
import { effectiveFtp, effectiveLthr, ftpIsEstimated, type Rider } from '../strategy/rider'
import { useStore } from '../storage/store'
import type { RideTheme } from '../storage/defaults'
import { Field, Num } from './fields'
import { Sheet } from './Sheet'

/** Profil coureur : demandé au premier lancement, puis accessible par l'icône réglages. */
export function ProfileSheet({ first, onClose }: { first: boolean; onClose: () => void }) {
  const { rider, rideTheme, maxPerHour, set } = useStore()
  const [r, setR] = useState<Rider>(rider)
  const [theme, setTheme] = useState<RideTheme>(rideTheme)
  const [cap, setCap] = useState<number | null>(maxPerHour)
  const est = ftpIsEstimated(r), ftp = effectiveFtp(r), lthr = effectiveLthr(r)
  const save = () => { set({ rider: r, rideTheme: theme, maxPerHour: Math.max(1, cap ?? 10), onboarded: true }); onClose() }
  const dismiss = () => { set({ onboarded: true }); onClose() }
  return (
    <Sheet title={first ? 'Ton profil' : 'Réglages'} onClose={first ? dismiss : onClose}>
      {first && <p className="muted" style={{ marginBottom: 12 }}>Quelques chiffres pour calculer tes cibles. Tout est modifiable plus tard.</p>}
      <Field label="Je règle mes cibles en" hint={r.hasPower === false ? "Sans capteur de puissance, les sections et les cibles s'affichent en bpm. Ta FTP, si tu la connais, sert à estimer les temps." : 'Avec un capteur de puissance, les cibles sont en watts. Sans capteur connecté en course, elles passent en bpm.'}>
        <div className="seg" role="group" aria-label="Unité des cibles">
          <button type="button" aria-pressed={r.hasPower !== false} onClick={() => setR({ ...r, hasPower: true })}>Watts</button>
          <button type="button" aria-pressed={r.hasPower === false} onClick={() => setR({ ...r, hasPower: false })}>Cardio (bpm)</button>
        </div>
      </Field>
      {r.hasPower === false && !r.lthr && !r.hrMax && <p className="notice" style={{ marginBottom: 12 }}>Renseigne ta FC seuil ou ta FC max pour avoir des cibles en bpm.</p>}
      <div className="cols2">
        <Field label="Masse, vélo compris (kg)"><Num value={r.mass} min={40} max={200} step={0.5} onChange={v => v && setR({ ...r, mass: v })} /></Field>
        <Field label={r.hasPower === false ? 'FTP (W), facultative' : 'FTP (W)'} hint={est ? `Estimée : ${ftp} W` : undefined}><Num value={r.ftp} min={80} max={600} placeholder="Je ne la connais pas" onChange={v => setR({ ...r, ftp: v })} /></Field>
        {est && <Field label="Vitesse sur le plat (km/h)" hint="Ta vitesse habituelle sur 2 h, sans vent."><Num value={r.flatSpeed} min={15} max={50} step={0.5} onChange={v => setR({ ...r, flatSpeed: v })} /></Field>}
        <Field label="FC au seuil (bpm)" hint={r.lthr ? undefined : lthr ? `Estimée : ${lthr} bpm` : undefined}><Num value={r.lthr} min={100} max={220} placeholder="Facultatif" onChange={v => setR({ ...r, lthr: v })} /></Field>
        <Field label="FC max (bpm)"><Num value={r.hrMax} min={120} max={230} placeholder="Facultatif" onChange={v => setR({ ...r, hrMax: v })} /></Field>
        <Field label="CdA (m²)"><Num value={r.cda} min={0.15} max={0.6} step={0.01} onChange={v => v && setR({ ...r, cda: v })} /></Field>
      </div>
      {!first && (
        <>
          <Field label="Thème de la vue de course" hint="Auto : clair en journée, sombre à partir du coucher du soleil.">
            <select value={theme} onChange={e => setTheme(e.target.value as RideTheme)}><option value="auto">Auto selon le soleil</option><option value="day">Toujours clair</option><option value="night">Toujours sombre</option></select>
          </Field>
          <Field label="Alertes de seuil par heure au plus"><Num value={cap} min={1} max={60} onChange={setCap} /></Field>
        </>
      )}
      <div className="row"><button className="btn primary grow" onClick={save}>Enregistrer</button><button className="btn" onClick={first ? dismiss : onClose}>{first ? 'Plus tard' : 'Annuler'}</button></div>
    </Sheet>
  )
}
