import { useMemo, useState, type CSSProperties } from 'react'
import { previewData } from '../ride/data'
import { CATALOG, GROUPS, OPTIONS, defOf, type Group, type WidgetKind } from '../storage/catalog'
import { LANDSCAPE, PORTRAIT, type ScreenDef, type WidgetItem } from '../storage/defaults'
import { addWidget, fitting, itemsFor, portraitFrom, sizesAt } from '../storage/screens'
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
function Preview({ k, w, h, src, tone }: { k: WidgetKind; w: number; h: number; src: 'power' | 'hr'; tone: number }) {
  const s = 0.34, W = w * 140, H = h * 130
  const item: WidgetItem = { id: 'p', k, x: 0, y: 0, w, h }
  return (
    <div className="pv" style={{ width: W * s, height: H * s } as CSSProperties}>
      <div style={{ width: W, height: H, transform: `scale(${s})`, transformOrigin: 'top left' }}>
        <Device items={[item]} data={previewData(src)} tone={tone} grid={{ cols: w, rows: h }} className="full" />
      </div>
    </div>
  )
}

/** Catalogue : recherche, catégories, aperçus de chaque taille autorisée. */
function Catalog({ only, onPick, onClose, src, tone }: { only?: Map<WidgetKind, [number, number]>; onPick: (k: WidgetKind, size?: [number, number]) => void; onClose: () => void; src: 'power' | 'hr'; tone: number }) {
  const [q, setQ] = useState(''), [g, setG] = useState<Group | null>(null)
  const list = CATALOG.filter(d => (!g || d.group === g) && (!q || `${d.name} ${d.desc}`.toLowerCase().includes(q.toLowerCase())) && (!only || only.has(d.k)))
  return (
    <Sheet title={only ? 'Ce qui tient ici' : 'Ajouter un widget'} onClose={onClose}>
      <input type="search" placeholder="Rechercher un widget" value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher un widget" />
      <div className="row chips" role="group" aria-label="Catégories">
        <button className="chip" aria-pressed={!g} onClick={() => setG(null)}>Tous</button>
        {GROUPS.map(x => <button key={x} className="chip" aria-pressed={g === x} onClick={() => setG(g === x ? null : x)}>{x}</button>)}
      </div>
      <div className="stack">
        {list.map(d => (
          <div className="cat-item" key={d.k}>
            <div className="cat-head"><b>{d.name}</b><small>{d.desc}</small></div>
            <div className="cat-sizes">
              {(only ? [only.get(d.k)!] : d.sizes.filter(s => s[0] * s[1] <= 6)).map(([w, h]) => (
                <button key={`${w}${h}`} className="cat-size" aria-label={`${d.name} ${w} par ${h}`} onClick={() => onPick(d.k, [w, h])}>
                  <Preview k={d.k} w={w} h={h} src={src} tone={tone} /><small>{w} × {h}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
        {!list.length && <p className="dim">Aucun widget ne correspond.</p>}
      </div>
    </Sheet>
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

  const commit = (next: WidgetItem[]) => {
    setHist(h => [...h, draft])
    setDraft(portrait ? { ...draft, portrait: next } : { ...draft, items: next })
  }
  const undo = () => { const p = hist[hist.length - 1]; if (p) { setDraft(p); setHist(hist.slice(0, -1)); setSel(null) } }

  const place = (k: WidgetKind, size?: [number, number], cell?: { x: number; y: number } | null) => {
    if (cell && size) { commit([...items, { id: uid(), k, x: cell.x, y: cell.y, w: size[0], h: size[1] }]); setCat(null); return }
    const n = addWidget(items, k, grid)
    if (!n) { toast('Plus de place : retire ou réduis un widget.'); return }
    // Taille choisie dans le catalogue si elle tient à la place trouvée.
    const added = n[n.length - 1]
    if (size && (size[0] !== added.w || size[1] !== added.h) && sizesAt(items, k, added.x, added.y, grid).some(s => s[0] === size[0] && s[1] === size[1])) { added.w = size[0]; added.h = size[1] }
    commit(n); setSel(added.id); setCat(null)
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
  const switchTo = (p: boolean) => { setPortrait(p); setSel(null) }

  const free = useMemo(() => (cat?.cell ? new Map(fitting(items, cat.cell.x, cat.cell.y, grid).map(f => [f.k, f.size] as [WidgetKind, [number, number]])) : undefined), [cat, items, grid])
  const save = () => { set({ screens: screens.map(s => (s.id === screen.id ? { ...draft } : s)) }); toast('Écran enregistré.'); onClose() }
  const regenerate = () => { commit(portraitFrom(draft.items)); toast('Portrait régénéré depuis le paysage.') }

  return (
    <>
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
      <div className={portrait ? 'edit-port' : undefined}>
        <ScaledDevice className="edit-dev" items={items} grid={grid} data={previewData(src)} tone={tone} editable selected={sel} onSelect={setSel} onChange={commit} onEmpty={(x, y) => setCat({ cell: { x, y } })} />
      </div>
      {selected ? (
        <div className="sel-bar" role="toolbar" aria-label={`Actions : ${defOf(selected.k).name}`}>
          <b>{defOf(selected.k).name} · {selected.w} × {selected.h}</b>
          <div className="row">
            <button className="btn" onClick={() => setCat({ cell: null, replace: true })}>Remplacer</button>
            <button className="btn" disabled={!OPTIONS[selected.k]} onClick={() => setOpts(true)}>Réglages</button>
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
        <Catalog only={free} src={src} tone={tone} onClose={() => setCat(null)}
          onPick={(k, size) => {
            if (cat.replace && selected) { // Remplacer : même place, taille autorisée la plus proche.
              const s = size && sizesAt(items.filter(i => i.id !== selected.id), k, selected.x, selected.y, grid, null).some(z => z[0] === size[0] && z[1] === size[1]) ? size : sizesAt(items.filter(i => i.id !== selected.id), k, selected.x, selected.y, grid).sort((a, b) => b[0] * b[1] - a[0] * a[1])[0]
              if (!s) { toast('Ce widget ne tient pas ici.'); return }
              commit(items.map(i => (i.id === selected.id ? { id: i.id, k, x: i.x, y: i.y, w: s[0], h: s[1] } : i))); setCat(null); return
            }
            place(k, size, cat.cell)
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
    </>
  )
}
