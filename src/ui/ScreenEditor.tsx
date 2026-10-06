import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { previewData } from '../ride/data'
import { FAMILIES, OPTIONS, defOf, type Family, type Size, type WidgetKind } from '../storage/catalog'
import { LANDSCAPE, PORTRAIT, type ScreenDef, type WidgetItem } from '../storage/defaults'
import { addWidget, itemsFor, portraitFrom, sizesAt } from '../storage/screens'
import { uid } from '../core/format'
import { effortUnit } from '../strategy/rider'
import { useStore } from '../storage/store'
import { Device } from './Device'
import { Field } from './fields'
import { Icon } from './icons'
import { ScaledDevice } from './ScaledDevice'
import { Sheet } from './Sheet'
import { toast } from './toast'

/** Aperçu réel d'un widget à une taille donnée (cases de 140 × 130 px réduites). */
function Preview({ k, o, w, h, src, tone }: { k: WidgetKind; o?: WidgetItem['o']; w: number; h: number; src: 'power' | 'hr'; tone: number }) {
  const s = 0.34, W = w * 140, H = h * 130
  const item: WidgetItem = { id: 'p', k, x: 0, y: 0, w, h, ...(o ? { o } : {}) }
  return (
    <div className="pv" style={{ width: W * s, height: H * s } as CSSProperties}>
      <div style={{ width: W, height: H, transform: `scale(${s})`, transformOrigin: 'top left' }}>
        <Device items={[item]} data={previewData(src)} tone={tone} grid={{ cols: w, rows: h }} className="full" />
      </div>
    </div>
  )
}

type Pick = { k: WidgetKind; o?: Record<string, string | number | boolean> }

/** Une taille du catalogue : un toucher l'ajoute, un appui long puis glisser la dépose sur l'écran. */
function SizeChip({ pick, size, label, src, tone, onTap, onDragMove, onDrop }: {
  pick: Pick; size: Size; label: string; src: 'power' | 'hr'; tone: number
  onTap: () => void; onDragMove: (x: number, y: number) => void; onDrop: (x: number, y: number) => void
}) {
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const st = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> | null; drag: boolean; id: number; type: string } | null>(null)
  const down = (e: React.PointerEvent) => {
    const s = { x: e.clientX, y: e.clientY, timer: null as ReturnType<typeof setTimeout> | null, drag: false, id: e.pointerId, type: e.pointerType }
    st.current = s
    const begin = () => { s.drag = true; setGhost({ x: s.x, y: s.y }); navigator.vibrate?.(20) }
    if (e.pointerType !== 'mouse') s.timer = setTimeout(begin, 280)
    const mv = (ev: PointerEvent) => {
      if (!s.drag) {
        const far = Math.hypot(ev.clientX - s.x, ev.clientY - s.y) > 8
        if (far && s.type === 'mouse') begin()
        else if (far) { if (s.timer) clearTimeout(s.timer); cleanup(); return }
        else return
      }
      ev.preventDefault(); setGhost({ x: ev.clientX, y: ev.clientY }); onDragMove(ev.clientX, ev.clientY)
    }
    const tm = (ev: TouchEvent) => { if (s.drag) ev.preventDefault() }
    const up = (ev: PointerEvent) => {
      if (s.timer) clearTimeout(s.timer)
      const dragged = s.drag
      cleanup()
      if (dragged) onDrop(ev.clientX, ev.clientY); else if (ev.type === 'pointerup') onTap()
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('touchmove', tm)
      setGhost(null); st.current = null
    }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    window.addEventListener('touchmove', tm, { passive: false })
  }
  return (
    <>
      <button className="cat-size" aria-label={`${label} ${size[0]} par ${size[1]} : toucher pour ajouter, appui long pour glisser`} onPointerDown={down} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } }}>
        <Preview k={pick.k} o={pick.o} w={size[0]} h={size[1]} src={src} tone={tone} /><small>{size[0]} × {size[1]}</small>
      </button>
      {ghost && <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}><Preview k={pick.k} o={pick.o} w={size[0]} h={size[1]} src={src} tone={tone} /></div>}
    </>
  )
}

/**
 * Catalogue : fenêtre basse au-dessus de l'éditeur (l'écran reste visible pour y glisser un widget).
 * D'abord la liste des familles ; une famille ouvre sa page (toutes ses variantes et tailles), « ‹ » revient.
 * Toucher en dehors ferme. `fits` restreint aux tailles qui tiennent à la place visée.
 */
function Catalog({ fits, title, onPick, onClose, onDragMove, onDrop, src, tone }: {
  fits?: (k: WidgetKind) => Size[]; title: string; onPick: (p: Pick, size: Size) => void; onClose: () => void
  onDragMove: (x: number, y: number, p: Pick, size: Size) => void; onDrop: (x: number, y: number, p: Pick, size: Size) => void; src: 'power' | 'hr'; tone: number
}) {
  const [q, setQ] = useState(''), [famId, setFamId] = useState<string | null>(null), [dragging, setDragging] = useState(false)
  const sizesOf = (k: WidgetKind): Size[] => (fits ? fits(k) : defOf(k).sizes).filter(z => z[0] * z[1] <= 8)
  const avail = (f: Family) => f.variants.filter(v => sizesOf(v.k).length)
  const list = FAMILIES.filter(f => avail(f).length && (!q || `${f.name} ${f.desc} ${f.variants.map(v => v.label).join(' ')}`.toLowerCase().includes(q.toLowerCase())))
  const fam = FAMILIES.find(f => f.id === famId)
  return (
    <>
      <div className={`cat-back${dragging ? ' clear' : ''}`} onClick={onClose} />
      <div className={`cat-sheet${dragging ? ' dragging' : ''}`} role="dialog" aria-label={fam ? fam.name : title}>
        <div className="cat-head">
          {fam ? <button className="cat-backbtn" aria-label="Retour" onClick={() => setFamId(null)}>‹</button> : null}
          <b>{fam ? fam.name : title}</b>
        </div>
        {!fam ? (
          <>
            <input type="search" placeholder="Rechercher" value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher un widget" />
            <div className="fam-list">
              {list.map(f => (
                <button key={f.id} className="fam" onClick={() => setFamId(f.id)}>
                  <span className="fam-t"><b>{f.name}</b><small>{avail(f).map(v => v.label).join(' · ')}</small></span>
                  <span className="chev" aria-hidden="true">›</span>
                </button>
              ))}
              {!list.length && <p className="dim">Aucun widget ne correspond.</p>}
            </div>
          </>
        ) : (
          <div className="fam-page">
            {avail(fam).map(v => (
              <section key={v.label}>
                {avail(fam).length > 1 && <h3>{v.label}</h3>}
                <div className="cat-sizes">
                  {sizesOf(v.k).map(z => (
                    <SizeChip key={`${z[0]}${z[1]}`} pick={{ k: v.k, o: v.o }} size={z} label={v.label} src={src} tone={tone}
                      onTap={() => onPick({ k: v.k, o: v.o }, z)}
                      onDragMove={(x, y) => { setDragging(true); onDragMove(x, y, { k: v.k, o: v.o }, z) }}
                      onDrop={(x, y) => { setDragging(false); onDrop(x, y, { k: v.k, o: v.o }, z) }} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

interface Props { screen: ScreenDef; onClose: () => void }

/**
 * Éditeur d'un écran de course, en paysage ou en portrait. Rien n'est enregistré avant « Terminé ».
 * Un toucher sélectionne, glisser déplace, le coin agrandit (tailles autorisées), une case vide propose ce qui tient.
 */
export function ScreenEditor({ screen, onClose }: Props) {
  const { screens, rider, set } = useStore()
  const [draft, setDraft] = useState<ScreenDef>(screen)
  const [portrait, setPortrait] = useState(false)
  const [hist, setHist] = useState<ScreenDef[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [cat, setCat] = useState<{ cell: { x: number; y: number } | null; replace?: boolean } | null>(null)
  const [opts, setOpts] = useState(false)
  const [src, setSrc] = useState<'power' | 'hr'>(effortUnit(rider))
  const [tone, setTone] = useState(1)
  const grid = portrait ? PORTRAIT : LANDSCAPE
  const items = itemsFor(draft, portrait)
  const selected = items.find(i => i.id === sel) ?? null
  const dirty = hist.length > 0 || draft.name !== screen.name

  // Un glisser compte pour un seul changement dans l'historique (annulable d'un coup).
  const lastGesture = useRef(0)
  const commit = (next: WidgetItem[], gesture = false) => {
    const now = Date.now(), continuing = gesture && now - lastGesture.current < 700
    if (gesture) lastGesture.current = now
    if (!continuing) setHist(h => [...h, draft])
    setDraft(d => (portrait ? { ...d, portrait: next } : { ...d, items: next }))
  }
  const devRef = useRef<HTMLDivElement>(null)
  const catOpen = !!cat
  useEffect(() => { if (catOpen) devRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, [catOpen])
  const [hint, setHint] = useState<{ x: number; y: number; w: number; h: number; ok: boolean } | null>(null)
  /** Case de l'écran sous un point de l'écran du téléphone, ou null en dehors. */
  const cellAt = (cx: number, cy: number) => {
    const el = devRef.current?.querySelector('.dev'); if (!el) return null
    const r = el.getBoundingClientRect()
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null
    return { x: Math.min(grid.cols - 1, Math.floor(((cx - r.left) / r.width) * grid.cols)), y: Math.min(grid.rows - 1, Math.floor(((cy - r.top) / r.height) * grid.rows)) }
  }
  const target = (cx: number, cy: number, p: Pick, size: Size) => {
    const c = cellAt(cx, cy); if (!c) return null
    const x = Math.min(c.x, grid.cols - size[0]), y = Math.min(c.y, grid.rows - size[1])
    return { x, y, w: size[0], h: size[1], ok: sizesAt(items, p.k, x, y, grid).some(z => z[0] === size[0] && z[1] === size[1]) }
  }
  const dragMove = (cx: number, cy: number, p: Pick, size: Size) => setHint(target(cx, cy, p, size))
  const drop = (cx: number, cy: number, p: Pick, size: Size) => {
    const t = target(cx, cy, p, size); setHint(null)
    if (!t) return
    if (!t.ok) { toast('Pas la place ici.'); return }
    const id = uid()
    commit([...items, { id, k: p.k, x: t.x, y: t.y, w: t.w, h: t.h, ...(p.o ? { o: p.o } : {}) }]); setSel(id)
  }
  const undo = () => { const p = hist[hist.length - 1]; if (p) { setDraft(p); setHist(hist.slice(0, -1)); setSel(null) } }

  const place = (p: Pick, size: Size, cell?: { x: number; y: number } | null) => {
    const { k, o } = p
    if (cell) { commit([...items, { id: uid(), k, x: cell.x, y: cell.y, w: size[0], h: size[1], ...(o ? { o } : {}) }]); return }
    const n = addWidget(items, k, grid)
    if (!n) { toast('Plus de place : retire ou réduis un widget.'); return }
    // Taille choisie dans le catalogue si elle tient à la place trouvée.
    const added = n[n.length - 1]
    if (o) added.o = o
    if (size && (size[0] !== added.w || size[1] !== added.h) && sizesAt(items, k, added.x, added.y, grid).some(s => s[0] === size[0] && s[1] === size[1])) { added.w = size[0]; added.h = size[1] }
    commit(n); setSel(added.id)
  }
  const remove = () => { if (selected) { commit(items.filter(i => i.id !== selected.id)); setSel(null) } }
  const setOpt = (key: string, v: string | number | boolean) => selected && commit(items.map(i => (i.id === selected.id ? { ...i, o: { ...i.o, [key]: v } } : i)))
  const switchTo = (p: boolean) => { setPortrait(p); setSel(null) }

  const save = () => { set({ screens: screens.map(s => (s.id === screen.id ? { ...draft } : s)) }); toast('Écran enregistré.'); onClose() }
  const regenerate = () => { commit(portraitFrom(draft.items)); toast('Portrait régénéré depuis le paysage.') }

  // Toucher ailleurs que sur un widget ou sa barre désélectionne.
  useEffect(() => {
    if (!sel) return
    const f = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest?.('.wg, .ed-fl, .sheet, .cat-sheet')) setSel(null) }
    document.addEventListener('pointerdown', f)
    return () => document.removeEventListener('pointerdown', f)
  }, [sel])
  const hasOpts = !!(selected && OPTIONS[selected.k])

  return (
    <div className={`ed${cat ? ' ed-pad' : ''}`}>
      <div className="ed-bar">
        <button className="btn ghost sm" onClick={() => { if (!dirty || window.confirm('Abandonner les changements ?')) onClose() }}>Annuler</button>
        <input className="ed-name" value={draft.name} maxLength={30} aria-label="Nom de l'écran" onChange={e => setDraft({ ...draft, name: e.target.value })} />
        <button className="btn primary sm" onClick={save}>OK</button>
      </div>
      <div className="ed-tools">
        <div className="seg sm" role="group" aria-label="Disposition"><button aria-pressed={!portrait} onClick={() => switchTo(false)}>Paysage</button><button aria-pressed={portrait} onClick={() => switchTo(true)}>Portrait</button></div>
        <div className="seg sm" role="group" aria-label="Mesure"><button aria-pressed={src === 'power'} onClick={() => setSrc('power')}>W</button><button aria-pressed={src === 'hr'} onClick={() => setSrc('hr')}>bpm</button></div>
        <div className="seg sm" role="group" aria-label="Thème"><button aria-pressed={tone === 0} aria-label="Jour" onClick={() => setTone(0)}>☀</button><button aria-pressed={tone === 1} aria-label="Nuit" onClick={() => setTone(1)}>☾</button></div>
        <button className="ed-icon" aria-label="Annuler le dernier changement" disabled={!hist.length} onClick={undo}>↶</button>
      </div>
      <div ref={devRef} className={`ed-dev${portrait ? ' edit-port' : ''}`}>
        <ScaledDevice hint={hint} className="edit-dev" items={items} grid={grid} data={previewData(src)} tone={tone} editable selected={sel} onSelect={setSel} onChange={commit} onEmpty={(x, y) => setCat({ cell: { x, y } })} />
        {selected && (
          <div className="ed-fl" role="toolbar" aria-label={defOf(selected.k).name}
            style={{ left: `${Math.min(100 - 62, (selected.x / grid.cols) * 100)}%`, top: `calc(${((selected.y + selected.h) / grid.rows) * 100}% + 6px)` }}>
            <button onClick={() => setCat({ cell: null, replace: true })}>Remplacer</button>
            {hasOpts && <button onClick={() => setOpts(true)}>Réglages</button>}
            <button className="red" onClick={remove}>Retirer</button>
          </div>
        )}
      </div>
      <div className="ed-actions">
        <button className="btn primary sm" onClick={() => { setSel(null); setCat({ cell: null }) }}><Icon name="plus" size={18} />Widget</button>
        {portrait && <button className="btn sm" onClick={regenerate}>Refaire depuis le paysage</button>}
      </div>
      {cat && (
        <Catalog src={src} tone={tone} title={cat.replace ? 'Remplacer par' : 'Ajouter un widget'} onClose={() => { setCat(null); setHint(null) }}
          fits={cat.replace && selected ? k => sizesAt(items.filter(i => i.id !== selected.id), k, selected.x, selected.y, grid) : cat.cell ? k => sizesAt(items, k, cat.cell!.x, cat.cell!.y, grid) : undefined}
          onDragMove={dragMove} onDrop={(x, y, p, z) => { drop(x, y, p, z); setCat(null) }}
          onPick={(p, size) => {
            if (cat.replace && selected) commit(items.map(i => (i.id === selected.id ? { id: i.id, k: p.k, x: i.x, y: i.y, w: size[0], h: size[1], ...(p.o ? { o: p.o } : {}) } : i)))
            else place(p, size, cat.cell)
            setCat(null)
          }} />
      )}
      {opts && selected && OPTIONS[selected.k] && (
        <Sheet title={`Réglages · ${defOf(selected.k).name}`} onClose={() => setOpts(false)}>
          {OPTIONS[selected.k]!.map(o => (
            <Field key={o.key} label={o.label}>
              <div className="seg" role="group" aria-label={o.label}>
                {o.choices.map(c => <button key={String(c.v)} aria-pressed={(selected.o?.[o.key] ?? o.choices[0].v) === c.v} onClick={() => setOpt(o.key, c.v)}>{c.l}</button>)}
              </div>
            </Field>
          ))}
        </Sheet>
      )}
    </div>
  )
}
