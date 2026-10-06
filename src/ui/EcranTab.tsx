import { useEffect, useRef, useState } from 'react'
import { TEMPLATES, type ScreenDef } from '../storage/defaults'
import { createScreen, duplicateScreen, removeScreen } from '../storage/screens'
import { useStore } from '../storage/store'
import { previewData } from '../ride/data'
import { AlertsSection } from './AlertsSection'
import { ScaledDevice } from './ScaledDevice'
import { ScreenEditor } from './ScreenEditor'
import { Icon } from './icons'
import { Sheet } from './Sheet'

type Tpl = keyof typeof TEMPLATES | 'vide'
const HOLD_MS = 450

/**
 * Liste des écrans. Un toucher ouvre l'éditeur ; un appui long passe en mode « modifier », comme l'écran
 * d'accueil d'un iPhone : ✕ supprime, ★ choisit l'écran de départ, glisser réordonne ; toucher ailleurs pour sortir.
 */
export function EcranTab() {
  const { screens, activeScreen, set } = useStore()
  const [editId, setEditId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [jiggle, setJiggle] = useState(false)
  const [undo, setUndo] = useState<{ screens: ScreenDef[]; active: string; name: string } | null>(null)
  const [drag, setDrag] = useState<{ id: string; dy: number; to: number } | null>(null)
  const press = useRef<{ id: string; y: number; t: ReturnType<typeof setTimeout> | null; moved: boolean; held: boolean; h: number; from: number } | null>(null)
  const edit = screens.find(s => s.id === editId)

  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 5000); return () => clearTimeout(t) }, [undo])
  // Toucher ailleurs que sur un écran quitte le mode modification.
  useEffect(() => {
    if (!jiggle) return
    const f = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest?.('.scr, .undo')) setJiggle(false) }
    document.addEventListener('pointerdown', f)
    return () => document.removeEventListener('pointerdown', f)
  }, [jiggle])

  if (edit) return <ScreenEditor key={edit.id} screen={edit} onClose={() => setEditId(null)} />

  const remove = (s: ScreenDef) => {
    if (screens.length < 2) return
    setUndo({ screens, active: activeScreen, name: s.name })
    const next = removeScreen(screens, s.id)
    set({ screens: next, ...(s.id === activeScreen ? { activeScreen: next[0].id } : {}) })
  }

  const down = (e: React.PointerEvent, s: ScreenDef, i: number) => {
    const el = e.currentTarget as HTMLElement
    const p = { id: s.id, y: e.clientY, t: null as ReturnType<typeof setTimeout> | null, moved: false, held: false, h: el.getBoundingClientRect().height + 12, from: i }
    p.t = setTimeout(() => { p.held = true; if (!jiggle) { setJiggle(true); navigator.vibrate?.(25) } }, HOLD_MS)
    press.current = p
    if (jiggle) el.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    const p = press.current
    if (!p) return
    const dy = e.clientY - p.y
    if (Math.abs(dy) > 8) { p.moved = true; if (p.t && !p.held) { clearTimeout(p.t); p.t = null } }
    if (jiggle && p.moved) {
      const to = Math.max(0, Math.min(screens.length - 1, p.from + Math.round(dy / p.h)))
      setDrag({ id: p.id, dy, to })
    }
  }
  const up = (s: ScreenDef) => {
    const p = press.current; press.current = null
    if (!p) return
    if (p.t) clearTimeout(p.t)
    if (drag) {
      const arr = [...screens], [it] = arr.splice(p.from, 1)
      arr.splice(drag.to, 0, it)
      set({ screens: arr }); setDrag(null); return
    }
    if (!jiggle && !p.held && !p.moved) setEditId(s.id)
  }
  /** Décalage des autres cartes pendant qu'on en glisse une. */
  const shift = (i: number) => {
    if (!drag || !press.current) return 0
    const from = press.current.from, h = press.current.h
    if (i > from && i <= drag.to) return -h
    if (i < from && i >= drag.to) return h
    return 0
  }

  return (
    <>
      <div className={`stack scr-list${jiggle ? ' jig' : ''}`}>
        {screens.map((s, i) => {
          const dragging = drag?.id === s.id
          return (
            <div key={s.id} className={`scr${dragging ? ' dragging' : ''}`} style={{ transform: dragging ? `translateY(${drag!.dy}px) scale(1.02)` : `translateY(${shift(i)}px)` }}
              onPointerDown={e => down(e, s, i)} onPointerMove={move} onPointerUp={() => up(s)} onPointerCancel={() => { press.current = null; setDrag(null) }} onContextMenu={e => e.preventDefault()}
              role="button" tabIndex={0} aria-label={`${s.name}${s.id === activeScreen ? ', écran de départ' : ''}`} onKeyDown={e => { if (e.key === 'Enter') setEditId(s.id) }}>
              <div className="thumbw"><ScaledDevice items={s.items} data={previewData()} tone={1} thumb /></div>
              <div className="t"><b>{s.name}</b><small>{s.items.length} widgets</small></div>
              {(jiggle || s.id === activeScreen) && (
                <button className={`scr-star${s.id === activeScreen ? ' on' : ''}`} aria-label={s.id === activeScreen ? 'Écran de départ' : 'Choisir comme écran de départ'} disabled={!jiggle}
                  onPointerDown={e => e.stopPropagation()} onClick={() => set({ activeScreen: s.id })}>{s.id === activeScreen ? '★' : '☆'}</button>
              )}
              {jiggle && screens.length > 1 && <button className="scr-x" aria-label={`Supprimer ${s.name}`} onPointerDown={e => e.stopPropagation()} onClick={() => remove(s)}>✕</button>}
            </div>
          )
        })}
      </div>
      {undo && (
        <div className="row undo" role="status">
          <span className="grow">« {undo.name} » supprimé</span>
          <button className="btn" onClick={() => { set({ screens: undo.screens, activeScreen: undo.active }); setUndo(null) }}>Annuler</button>
        </div>
      )}
      <button className="btn" style={{ marginTop: 16 }} onClick={() => setCreating(true)}><Icon name="plus" size={20} />Nouvel écran</button>
      <AlertsSection />
      {creating && (
        <Sheet title="Nouvel écran" onClose={() => setCreating(false)}>
          <div className="stack">
            {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map(k => <button key={k} className="btn" onClick={() => add(k)}>{TEMPLATES[k].n}</button>)}
            <button className="btn" onClick={() => add('vide')}>Écran vide</button>
          </div>
          <h3 className="h2">Copier un écran</h3>
          <div className="stack">
            {screens.map(s => <button key={s.id} className="btn" onClick={() => { const c = duplicateScreen(s); set({ screens: [...screens, c] }); setCreating(false); setEditId(c.id) }}>{s.name}</button>)}
          </div>
        </Sheet>
      )}
    </>
  )
  function add(t: Tpl) {
    const sc = createScreen(t === 'vide' ? `Écran ${screens.length + 1}` : TEMPLATES[t].n, t === 'vide' ? null : t)
    set({ screens: [...screens, sc] })
    setCreating(false)
    setEditId(sc.id)
  }
}
