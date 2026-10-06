import { useState, type CSSProperties } from 'react'
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

/**
 * Catalogue : une ligne par famille (recherche en haut). Un toucher ouvre la famille : on choisit
 * la variante, puis la taille avec son aperçu réel. `fits` restreint aux tailles qui tiennent à la place visée.
 */
function Catalog({ fits, title, onPick, onClose, src, tone }: { fits?: (k: WidgetKind) => Size[]; title: string; onPick: (p: Pick, size: Size) => void; onClose: () => void; src: 'power' | 'hr'; tone: number }) {
  const [q, setQ] = useState(''), [famId, setFamId] = useState<string | null>(null), [vi, setVi] = useState(0), [size, setSize] = useState<Size | null>(null)
  const sizesOf = (k: WidgetKind): Size[] => (fits ? fits(k) : defOf(k).sizes)
  const avail = (f: Family) => f.variants.filter(v => sizesOf(v.k).length)
  const list = FAMILIES.filter(f => avail(f).length && (!q || `${f.name} ${f.desc} ${f.variants.map(v => v.label).join(' ')}`.toLowerCase().includes(q.toLowerCase())))
  const fam = FAMILIES.find(f => f.id === famId)

  if (fam) {
    const vars = avail(fam), v = vars[Math.min(vi, vars.length - 1)], sizes = sizesOf(v.k).filter(z => z[0] * z[1] <= 8)
    const cur = size && sizes.some(z => z[0] === size[0] && z[1] === size[1]) ? size : sizes[0]
    return (
      <Sheet title={fam.name} onClose={onClose}>
        <button className="btn ghost" onClick={() => { setFamId(null); setVi(0); setSize(null) }}>‹ Tous les widgets</button>
        <p className="dim">{defOf(v.k).desc}</p>
        {vars.length > 1 && <div className="row chips" role="group" aria-label="Variante">{vars.map((x, i) => <button key={x.label} className="chip" aria-pressed={x === v} onClick={() => { setVi(i); setSize(null) }}>{x.label}</button>)}</div>}
        <div className="cat-sizes">
          {sizes.map(([w, h]) => (
            <button key={`${w}${h}`} className="cat-size" aria-pressed={cur[0] === w && cur[1] === h} aria-label={`${v.label} ${w} par ${h}`} onClick={() => setSize([w, h])}>
              <Preview k={v.k} o={v.o} w={w} h={h} src={src} tone={tone} /><small>{w} × {h}</small>
            </button>
          ))}
        </div>
        <button className="btn primary" style={{ marginTop: 16, width: '100%' }} onClick={() => onPick({ k: v.k, o: v.o }, cur)}>Ajouter · {cur[0]} × {cur[1]}</button>
      </Sheet>
    )
  }
  return (
    <Sheet title={title} onClose={onClose}>
      <input type="search" placeholder="Rechercher un widget" value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher un widget" />
      <div className="fam-list">
        {list.map(f => {
          const v0 = avail(f)[0], z0 = sizesOf(v0.k).slice().sort((a, b) => a[0] * a[1] - b[0] * b[1])[0]
          return (
            <button key={f.id} className="fam" onClick={() => { setFamId(f.id); setVi(0); setSize(null) }}>
              <span className="fam-pv"><Preview k={v0.k} o={v0.o} w={z0[0]} h={z0[1]} src={src} tone={tone} /></span>
              <span className="fam-t"><b>{f.name}</b><small>{avail(f).map(v => v.label).join(' · ')}</small></span>
              <span className="chev" aria-hidden="true">›</span>
            </button>
          )
        })}
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

  const place = (p: Pick, size: Size, cell?: { x: number; y: number } | null) => {
    const { k, o } = p
    if (cell) { commit([...items, { id: uid(), k, x: cell.x, y: cell.y, w: size[0], h: size[1], ...(o ? { o } : {}) }]); setCat(null); return }
    const n = addWidget(items, k, grid)
    if (!n) { toast('Plus de place : retire ou réduis un widget.'); return }
    // Taille choisie dans le catalogue si elle tient à la place trouvée.
    const added = n[n.length - 1]
    if (o) added.o = o
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
        <Catalog src={src} tone={tone} title={cat.replace ? 'Remplacer par' : cat.cell ? 'Ce qui tient ici' : 'Ajouter un widget'} onClose={() => setCat(null)}
          fits={cat.replace && selected ? k => sizesAt(items.filter(i => i.id !== selected.id), k, selected.x, selected.y, grid) : cat.cell ? k => sizesAt(items, k, cat.cell!.x, cat.cell!.y, grid) : undefined}
          onPick={(p, size) => {
            if (cat.replace && selected) { commit(items.map(i => (i.id === selected.id ? { id: i.id, k: p.k, x: i.x, y: i.y, w: size[0], h: size[1], ...(p.o ? { o: p.o } : {}) } : i))); setCat(null); return }
            place(p, size, cat.cell)
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
    </>
  )
}
