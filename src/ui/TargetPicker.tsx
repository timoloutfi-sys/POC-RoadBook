import { pctToValue, unitLabel, valueToPct } from '../strategy/units'
import { HR_ZONES, POWER_ZONES, zoneBandPct, type Unit } from '../strategy/zones'
import { Field, Num } from './fields'

/**
 * Choix d'une cible, en % de FTP en interne : une zone (marche sans aucun chiffre),
 * ou une fourchette dans l'unité du coureur. Un seul composant pour tout le Plan.
 */
export function TargetPicker({ unit, ftp, lthr, min, max, onChange }: {
  unit: Unit; ftp: number; lthr: number | null; min: number; max: number; onChange: (min: number, max: number) => void
}) {
  const zones = unit === 'power' ? POWER_ZONES : HR_ZONES
  const k = zones.findIndex((_, i) => { const [lo, hi] = zoneBandPct(i, unit); return Math.abs(lo - min) < 0.6 && Math.abs(hi - max) < 0.6 })
  const u = unitLabel(unit), noBpm = unit === 'hr' && !lthr
  const set = (which: 'min' | 'max', v: number | null) => {
    const pct = v == null ? null : valueToPct(v, unit, ftp, lthr)
    if (pct != null) onChange(which === 'min' ? pct : min, which === 'max' ? pct : max)
  }
  return (
    <>
      <Field label="Cible">
        <select value={k >= 0 ? k : 'perso'} onChange={e => { if (e.target.value !== 'perso') { const [lo, hi] = zoneBandPct(+e.target.value, unit); onChange(lo, hi) } }}>
          <option value="perso">Personnalisée</option>
          {zones.map((z, i) => <option key={z.n} value={i}>{z.n} · {z.l}</option>)}
        </select>
      </Field>
      {noBpm ? (
        <p className="notice">FC seuil à renseigner dans les réglages pour saisir des bpm.</p>
      ) : (
        <div className="cols2">
          <Field label={`Min (${u})`}><Num value={pctToValue(Math.min(min, max), unit, ftp, lthr)} step={unit === 'hr' ? 1 : 5} onChange={v => set('min', v)} /></Field>
          <Field label={`Max (${u})`}><Num value={pctToValue(Math.max(min, max), unit, ftp, lthr)} step={unit === 'hr' ? 1 : 5} onChange={v => set('max', v)} /></Field>
        </div>
      )}
    </>
  )
}
