import { useRef, useState } from 'react'
import { nf0 } from '../core/format'
import { useLibrary } from '../library/session'
import { parseGPX } from '../route/gpx'
import { buildRoute } from '../route/route'
import type { Terrain } from '../route/synthetic'
import { Field, Num } from './fields'
import { Icon } from './icons'
import { toast } from './toast'

const TERRAINS: [Terrain, string][] = [['plat', 'Plat'], ['vallonne', 'Vallonné'], ['montagne', 'Montagne']]

/** Parcours d'une course dont le GPX n'est pas encore publié : valeurs saisies, notes, et ajout du GPX. */
export function NoGpx() {
  const { current, patch, attachRoute, setSub } = useLibrary()
  const file = useRef<HTMLInputElement>(null)
  const [notes, setNotes] = useState(current?.notes ?? '')
  if (!current?.est) return null
  const est = current.est

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const g = parseGPX(await f.text())
      const route = buildRoute(g.name, g.pts)
      await attachRoute(route)
      const km = route.total / 1000
      toast(`GPX ajouté : ${nf0(km)} km${Math.abs(km - est.km) > 1 ? ` (saisie : ${nf0(est.km)} km)` : ''}.`)
    } catch (e) { toast(e instanceof Error ? e.message : 'Import impossible.') }
  }

  return (
    <>
      <div className="dashbox" style={{ textAlign: 'center' }}>
        <b style={{ fontSize: 18 }}>GPX pas encore publié</b>
        <span className="muted" style={{ fontSize: 14 }}>L’estimation vient de ces valeurs. Elle sera remplacée par le GPX.</span>
        <div className="cols2" style={{ textAlign: 'left' }}>
          <Field label="Distance (km)"><Num value={est.km} min={5} step={10} onChange={v => v && void patch({ est: { ...est, km: v } })} /></Field>
          <Field label="Dénivelé (m D+)"><Num value={est.dplus} min={0} step={100} onChange={v => void patch({ est: { ...est, dplus: v ?? 0 } })} /></Field>
        </div>
        <div className="seg" role="group" style={{ display: 'flex' }}>
          {TERRAINS.map(([k, n]) => <button key={k} type="button" style={{ flex: 1 }} aria-pressed={est.terrain === k} onClick={() => void patch({ est: { ...est, terrain: k } })}>{n}</button>)}
        </div>
        <button className="btn" onClick={() => file.current?.click()}><Icon name="upload" size={20} />Ajouter le GPX</button>
        <input ref={file} type="file" accept=".gpx,application/gpx+xml" hidden onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>

      <h2 className="h2">Déjà possible sans GPX</h2>
      <ul className="list">
        <li><button className="item" onClick={() => setSub('cibles')}><span className="t">Cibles<small>Plat, montée, descente : à toi ou suggérées</small></span><Icon name="chevron" size={18} /></button></li>
        <li><button className="item" onClick={() => setSub('reglages')}><span className="t">Rappels et alertes<small>Nutrition, hydratation, seuils</small></span><Icon name="chevron" size={18} /></button></li>
      </ul>

      <Field label="Notes" hint="Ravitos annoncés, règlement, matériel">
        <textarea value={notes} rows={5} onChange={e => setNotes(e.target.value)} onBlur={() => { if (notes !== (current.notes ?? '')) void patch({ notes }) }} />
      </Field>
      <p className="muted" style={{ fontSize: 14 }}>Quand le GPX arrive, le tracé est ajouté et rien n’est perdu. Tu pourras placer les points sur le profil.</p>
    </>
  )
}
