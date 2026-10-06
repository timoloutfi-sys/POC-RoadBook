import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { previewData } from '../ride/data'
import { FAMILIES, OPTIONS, defOf, familyOf, type Family, type Size, type WidgetKind } from '../storage/catalog'
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
      {ghost && <div className="ghost" style={{ left: ghost.x, top: ghost.y }}><Preview k={pick.k} o={pick.o} w={size[0]} h={size[1]} src={src} tone={tone} /></div>}
    </>
  )
}

/**
 * Catalogue : panneau de hauteur standard en bas de l'éditeur (l'écran reste visible au-dessus pour y glisser les widgets).
 * Une ligne par famille ; un toucher la déroule sur place avec ses variantes et ses tailles.
 * `fits` restreint aux tailles qui tiennent à la place visée.
 */
function Catalog({ fits, title, onPick, onClose, onDragMove, onDrop, src, tone }: {
  fits?: (k: WidgetKind) => Size[]; title: string; onPick: (p: Pick, size: Size) => void; onClose: () => void
  onDragMove: (x: number, y: number, p: Pick, size: Size) => void; onDrop: (x: number, y: number, p: Pick, size: Size) => void; src: 'power' | 'hr'; tone: number
}) {
  const [q, setQ] = useState(''), [open, setOpen] = useState<string | null>(null), [vi, setVi] = useState<Record<string, number>>({})
  const sizesOf = (k: WidgetKind): Size[] => (fits ? fits(k) : defOf(k).sizes).filter(z => z[0] * z[1] <= 8)
  const avail = (f: Family) => f.variants.filter(v => sizesOf(v.k).length)
  const list = FAMILIES.filter(f => avail(f).length && (!q || `${f.name} ${f.desc} ${f.variants.map(v => v.label).join(' ')}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="cat-panel" role="dialog" aria-label={title}>
      <div className="cat-top"><b>{title}</b><button className="btn ghost" onClick={onClose} aria-label="Fermer le catalogue"><Icon name="close" size={20} /></button></div>
      <input type="search" placeholder="Rechercher un widget" value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher un widget" />
      <p className="dim cat-help">Touche une taille pour l'ajouter, ou glisse-la sur l'écran.</p>
      <div className="fam-list">
        {list.map(f => {
          const vars = avail(f), isOpen = open === f.id || (!!q && list.length === 1), v = vars[Math.min(vi[f.id] ?? 0, vars.length - 1)]
          const v0 = vars[0], z0 = sizesOf(v0.k).slice().sort((a, b) => a[0] * a[1] - b[0] * b[1])[0]
          return (
            <div key={f.id} className={`fam-wrap${isOpen ? ' open' : ''}`}>
              <button className="fam" aria-expanded={isOpen} onClick={e => { const w = e.currentTarget.parentElement; setOpen(isOpen ? null : f.id); if (!isOpen) setTimeout(() => w?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 30) }}>
                <span className="fam-pv"><Preview k={v0.k} o={v0.o} w={z0[0]} h={z0[1]} src={src} tone={tone} /></span>
                <span className="fam-t"><b>{f.name}</b><small>{vars.map(x => x.label).join(' · ')}</small></span>
                <span className="chev" aria-hidden="true">{isOpen ? '⌃' : '⌄'}</span>
              </button>
              {isOpen && (
                <div className="fam-body">
                  <p className="dim">{defOf(v.k).desc}</p>
                  {vars.length > 1 && <div className="row chips" role="group" aria-label="Variante">{vars.map((x, i) => <button key={x.label} className="chip" aria-pressed={x === v} onClick={() => setVi({ ...vi, [f.id]: i })}>{x.label}</button>)}</div>}
                  <div className="cat-sizes">
                    {sizesOf(v.k).map(z => (
                      <SizeChip key={`${v.label}${z[0]}${z[1]}`} pick={{ k: v.k, o: v.o }} size={z} label={v.label} src={src} tone={tone}
                        onTap={() => onPick({ k: v.k, o: v.o }, z)} onDragMove={(x, y) => onDragMove(x, y, { k: v.k, o: v.o }, z)} onDrop={(x, y) => onDrop(x, y, { k: v.k, o: v.o }, z)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!list.length && <p className="dim">Aucun widget ne correspond.</p>}
      </div>
    </div>
  )
}

interface Props { screen: ScreenDef; isStart: boolean; onClose: () => void; onNew: () => void }

/**
 * Éditeur d'un écran de course, en paysage ou en portrait. Rien n'est enregistré avant « Terminé ».
 * Un toucher sélectionne, glisser déplace, le coin agrandit (tailles autorisées), une case vide propose ce qui tient.
 */
export function ScreenEditor({ screen, isStart, onClose, onNew }: Props) {
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
  const duplicate = () => {
    if (!selected) return
    const n = addWidget(items, selected.k, grid)
    if (!n) { toast('Plus de place.'); return }
    const c = n[n.length - 1]; c.o = selected.o
    const same = sizesAt(items, selected.k, c.x, c.y, grid).some(s => s[0] === selected.w && s[1] === selected.h)
    if (same) { c.w = selected.w; c.h = selected.h }
    commit(n); setSel(c.id)
  }
  const remove = () => { if (selected) { commit(items.filter(i => i.id !== selected.id)); setSel(null) } }
  const setOpt = (key: string, v: string | number | boolean) => selected && commit(items.map(i => (i.id === selected.id ? { ...i, o: { ...i.o, [key]: v } } : i)))
  // Change de variante dans la famille : même place, taille conservée si elle existe, sinon la plus proche qui tient.
  const switchVariant = (v: { k: WidgetKind; o?: WidgetItem['o'] }) => {
    if (!selected) return
    const ok = sizesAt(items.filter(i => i.id !== selected.id), v.k, selected.x, selected.y, grid)
    const s = ok.find(z => z[0] === selected.w && z[1] === selected.h) ?? ok.sort((a, b) => Math.abs(a[0] * a[1] - selected.w * selected.h) - Math.abs(b[0] * b[1] - selected.w * selected.h))[0]
    if (!s) { toast('Cette variante ne tient pas ici.'); return }
    commit(items.map(i => (i.id === selected.id ? { id: i.id, k: v.k, x: i.x, y: i.y, w: s[0], h: s[1], ...(v.o ? { o: v.o } : {}) } : i)))
  }
  const switchTo = (p: boolean) => { setPortrait(p); setSel(null) }

  const save = () => { set({ screens: screens.map(s => (s.id === screen.id ? { ...draft } : s)) }); toast('Écran enregistré.'); onClose() }
  const regenerate = () => { commit(portraitFrom(draft.items)); toast('Portrait régénéré depuis le paysage.') }

  return (
    <div className={cat ? 'ed-pad' : undefined}>
      <div className="ed-bar">
        <button className="btn ghost" onClick={() => { if (!dirty || window.confirm('Abandonner les changements ?')) onClose() }}>Annuler</button>
        <b>{draft.name}</b>
        <button className="btn primary" onClick={save}>Terminé</button>
      </div>
      <Field label="Nom de l'écran"><input value={draft.name} maxLength={30} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="seg" role="group" aria-label="Disposition"><button aria-pressed={!portrait} onClick={() => switchTo(false)}>Paysage</button><button aria-pressed={portrait} onClick={() => switchTo(true)}>Portrait</button></div>
        <div className="seg" role="group" aria-label="Aperçu de la mesure"><button aria-pressed={src === 'power'} onClick={() => setSrc('power')}>Watts</button><button aria-pressed={src === 'hr'} onClick={() => setSrc('hr')}>Cardio</button></div>
        <div className="seg" role="group" aria-label="Aperçu du thème"><button aria-pressed={tone === 0} onClick={() => setTone(0)}>Jour</button><button aria-pressed={tone === 1} onClick={() => setTone(1)}>Nuit</button></div>
      </div>
      <div ref={devRef} className={portrait ? 'edit-port' : undefined}>
        <ScaledDevice hint={hint} className="edit-dev" items={items} grid={grid} data={previewData(src)} tone={tone} editable selected={sel} onSelect={setSel} onChange={commit} onEmpty={(x, y) => setCat({ cell: { x, y } })} />
      </div>
      {selected ? (
        <div className="sel-bar" role="toolbar" aria-label={`Actions : ${defOf(selected.k).name}`}>
          <b>{defOf(selected.k).name} · {selected.w} × {selected.h}</b>
          <div className="row">
            <button className="btn" onClick={() => setCat({ cell: null, replace: true })}>Remplacer</button>
            <button className="btn" onClick={() => setOpts(true)}>Réglages</button>
            <button className="btn" onClick={duplicate}>Dupliquer</button>
            <button className="btn danger" onClick={remove}>Retirer</button>
          </div>
        </div>
      ) : <p className="dim">Touche un widget pour le modifier, une case vide pour en ajouter.</p>}
      <div className="row">
        <button className="btn primary" onClick={() => setCat({ cell: null })}><Icon name="plus" size={20} />Widget</button>
        <button className="btn" disabled={!hist.length} onClick={undo}>Annuler le dernier changement</button>
        {portrait && <button className="btn" onClick={regenerate}>Régénérer depuis le paysage</button>}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        {!isStart && <button className="btn" onClick={() => { set({ activeScreen: screen.id }); toast('Écran de départ défini.') }}>Écran de départ</button>}
        <button className="btn" onClick={() => { if (!dirty || window.confirm('Abandonner les changements ?')) onNew() }}><Icon name="plus" size={20} />Nouvel écran</button>
      </div>
      {cat && (
        <Catalog src={src} tone={tone} title={cat.replace ? 'Remplacer par' : cat.cell ? 'Ce qui tient ici' : 'Ajouter un widget'} onClose={() => { setCat(null); setHint(null) }}
          fits={cat.replace && selected ? k => sizesAt(items.filter(i => i.id !== selected.id), k, selected.x, selected.y, grid) : cat.cell ? k => sizesAt(items, k, cat.cell!.x, cat.cell!.y, grid) : undefined}
          onDragMove={dragMove} onDrop={drop}
          onPick={(p, size) => {
            if (cat.replace && selected) { commit(items.map(i => (i.id === selected.id ? { id: i.id, k: p.k, x: i.x, y: i.y, w: size[0], h: size[1], ...(p.o ? { o: p.o } : {}) } : i))); setCat(null); return }
            place(p, size, cat.cell)
            if (cat.cell) setCat(null)
          }} />
      )}
      {opts && selected && (
        <Sheet title={`Réglages · ${defOf(selected.k).name}`} onClose={() => setOpts(false)}>
          {(() => {
            const { family, variant } = familyOf(selected.k, selected.o)
            return family.variants.length > 1 && (
              <Field label="Variante">
                <div className="row chips" role="group" aria-label="Variante">
                  {family.variants.map(v => <button key={v.label} className="chip" aria-pressed={v === variant} onClick={() => switchVariant(v)}>{v.label}</button>)}
                </div>
              </Field>
            )
          })()}
          {(OPTIONS[selected.k] ?? []).map(o => (
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
