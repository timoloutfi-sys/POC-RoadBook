import { useRef, useState } from 'react'
import { nf0, nf1 } from '../core/format'
import { parseGPX } from '../route/gpx'
import { buildRoute } from '../route/route'
import { POINT_TYPES } from '../strategy/types'
import { useStore } from '../storage/store'
import { ProfileChart } from './ProfileChart'

export function ParcoursTab() {
  const { route, points, sections, setRoute, loadDemo, detectClimbs } = useStore()
  const file = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState('')

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const g = parseGPX(await f.text())
      setRoute(buildRoute(g.name, g.pts))
      if (!g.noEle) detectClimbs()
      setErr(g.noEle ? 'Parcours chargé, mais sans altitude : pas de pentes ni de montées.' : '')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Import impossible.') }
  }

  return (
    <>
      <h1 className="title">{route ? route.name : 'Aucun parcours'}</h1>
      <div className="row">
        <button className="btn primary" onClick={() => file.current?.click()}>Importer un GPX</button>
        <button className="btn" onClick={loadDemo}>Boucle démo</button>
        <input ref={file} type="file" accept=".gpx,application/gpx+xml" hidden onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {err && <p className="notice" role="status">{err}</p>}
      {route ? (
        <>
          <div className="facts">
            <div><b>{nf1(route.total / 1000)} km</b><span>distance</span></div>
            <div><b>{nf0(route.dplus)} m</b><span>D+</span></div>
            <div><b>{sections.filter(s => s.kind === 'montee').length}</b><span>montées</span></div>
          </div>
          <ProfileChart route={route} sections={sections} />
          <ul className="list">
            {[...points].sort((a, b) => a.km - b.km).map(p => (
              <li key={p.id}><span className="km">km {nf1(p.km)}</span><span>{POINT_TYPES[p.type].i} {p.text || POINT_TYPES[p.type].n}</span></li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted">Importe le GPX de ta course (Komoot, Ride with GPS, Strava) ou charge la boucle démo. Le tracé n'est jamais modifié : tu l'annotes.</p>
      )}
    </>
  )
}
