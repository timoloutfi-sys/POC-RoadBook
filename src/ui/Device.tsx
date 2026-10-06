import { useRef, type CSSProperties } from 'react'
import { clamp } from '../core/format'
import type { WidgetData } from '../ride/data'
import { nearestSize } from '../storage/catalog'
import { LANDSCAPE, WIDGETS, type Grid, type WidgetItem } from '../storage/defaults'
import { moveOrSwap } from '../storage/screens'
import { Icon } from './icons'
import { Widget, sizeOf } from './widgets'

const sevColor = (k: number, a = 1, dir: 'hi' | 'lo' = 'hi') =>
  dir === 'lo' ? `rgba(${Math.round(135 - 70 * k)},${Math.round(200 - 75 * k)},${Math.round(255 - 15 * k)},${a})` : `rgba(${Math.round(255 - 15 * k)},${Math.round(190 - 115 * k)},${Math.round(70 - 10 * k)},${a})`

interface Props {
  items: WidgetItem[]
  data: WidgetData
  /** 0 = jour, 1 = nuit. */
  tone: number
  /** Mode éditeur : glisser pour déplacer, coin pour redimensionner, croix pour retirer. */
  editable?: boolean
  /** `gesture` : le changement vient d'un glisser en cours (l'historique n'en garde qu'un). */
  onChange?: (items: WidgetItem[], gesture?: boolean) => void
  /** Emplacement visé pendant un glisser depuis le catalogue. */
  hint?: { x: number; y: number; w: number; h: number; ok: boolean } | null
  /** Grille : 6 × 3 (paysage) par défaut, 3 × 6 en portrait. */
  grid?: Grid
  /** Widget sélectionné dans l'éditeur, et rappels de sélection ou de case vide touchée. */
  selected?: string | null
  onSelect?: (id: string | null) => void
  onEmpty?: (x: number, y: number) => void
  /** Vignette : textes minuscules, aucune interaction. */
  thumb?: boolean
  className?: string
}

/** La grille 6 × 3 d'un écran de course, avec la lueur d'alerte sur les bords et le bandeau d'annonce. */
export function Device({ items, data, tone, editable, onChange, thumb, className, grid = LANDSCAPE, selected, onSelect, onEmpty, hint }: Props) {
  const COLS = grid.cols, ROWS = grid.rows
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; sx: number; sy: number; o: WidgetItem; cw: number; ch: number; items0: WidgetItem[] } | null>(null)

  let mk = 0, mdir: 'hi' | 'lo' = 'hi', crit = false
  for (const m of Object.values(data.sev)) {
    if (m.k > mk || (m.k === mk && m.dir === 'hi')) { mk = m.k; mdir = m.dir }
    crit = crit || m.crit
  }
  const edge = { '--ec': sevColor(mk, mk > 0 ? 0.5 + 0.35 * mk : 0, mdir), '--ew': `${mk > 0 ? 1.5 + 5 * mk : 0}px`, '--eg': `${mk > 0 ? 6 + 20 * mk : 0}px` } as CSSProperties

  const down = (e: React.PointerEvent, it: WidgetItem, mode: 'move' | 'resize') => {
    if (!editable || !root.current) return
    const r = root.current.getBoundingClientRect()
    drag.current = { id: it.id, mode, sx: e.clientX, sy: e.clientY, o: { ...it }, cw: r.width / COLS, ch: r.height / ROWS, items0: items }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault(); e.stopPropagation()
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !onChange) return
    const dx = Math.round((e.clientX - d.sx) / d.cw), dy = Math.round((e.clientY - d.sy) / d.ch), o = d.o
    const r = d.mode === 'move'
      ? { x: clamp(o.x + dx, 0, COLS - o.w), y: clamp(o.y + dy, 0, ROWS - o.h), w: o.w, h: o.h }
      : (([w, h]) => ({ x: o.x, y: o.y, w, h }))(nearestSize(o.k, clamp(o.w + dx, 1, COLS - o.x), clamp(o.h + dy, 1, ROWS - o.y)))
    const cur = items.find(i => i.id === d.id)
    if (!cur) return
    const next = moveOrSwap(d.items0, d.id, r, grid)
    if (!next) return
    const same = next.every(n => { const c = items.find(i => i.id === n.id); return c && c.x === n.x && c.y === n.y && c.w === n.w && c.h === n.h })
    if (!same || next.length !== items.length) onChange(next, true)
  }
  const up = () => { drag.current = null }
  const taken = (x: number, y: number) => items.some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)

  const style = { '--n': tone } as CSSProperties
  return (
    <div ref={root} className={`dev${thumb ? ' thumb' : ''}${editable ? ' editing' : ''}${COLS < ROWS ? ' portrait' : ''} ${className ?? ''}`} style={style} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {editable && Array.from({ length: COLS * ROWS }, (_, i) => ({ x: i % COLS, y: Math.floor(i / COLS) })).filter(c => !taken(c.x, c.y)).map(c => (
        <button key={`${c.x}-${c.y}`} className="cell-empty" style={{ left: `${(c.x / COLS) * 100}%`, top: `${(c.y / ROWS) * 100}%`, width: `${100 / COLS}%`, height: `${100 / ROWS}%` }} aria-label="Ajouter un widget ici" onClick={() => onEmpty?.(c.x, c.y)}>+</button>
      ))}
      {items.map(it => {
        const sev = data.sev[it.k === 'effort' ? (data.source === 'power' ? 'power' : 'hr') : it.k === 'hr' ? 'hr' : it.k === 'cad' ? 'cad' : it.k === 'speed' ? 'speed' : 'power']
        const sty = {
          left: `${(it.x / COLS) * 100}%`, top: `${(it.y / ROWS) * 100}%`, width: `${(it.w / COLS) * 100}%`, height: `${(it.h / ROWS) * 100}%`,
          ...(sev && (it.k === 'effort' || it.k === 'hr' || it.k === 'cad' || it.k === 'speed') ? { '--valc': sevColor(sev.k, 1, sev.dir), '--wbg': sevColor(sev.k, 0.06 + 0.14 * sev.k, sev.dir), '--wbd': sevColor(sev.k, 0.4 + 0.4 * sev.k, sev.dir) } : {}),
        } as CSSProperties
        return (
          <div key={it.id} className={`wg s-${sizeOf(it)}${sev && it.k !== 'target' ? ' alert' : ''}${selected === it.id ? ' sel' : ''}`} style={sty} onPointerDown={e => down(e, it, 'move')} onClick={() => editable && onSelect?.(it.id)} aria-label={WIDGETS[it.k]}>
            <div className="wi"><Widget it={it} d={data} /></div>
            {editable && (
              <>
                <button className="wg-del" aria-label={`Retirer ${WIDGETS[it.k]}`} onPointerDown={e => e.stopPropagation()} onClick={() => onChange?.(items.filter(x => x.id !== it.id))}><Icon name="close" size={16} /></button>
                <span className="wg-rs" onPointerDown={e => down(e, it, 'resize')} />
              </>
            )}
          </div>
        )
      })}
      {hint && <div className={`dev-hint${hint.ok ? '' : ' bad'}`} style={{ left: `${(hint.x / COLS) * 100}%`, top: `${(hint.y / ROWS) * 100}%`, width: `${(hint.w / COLS) * 100}%`, height: `${(hint.h / ROWS) * 100}%` }} />}
      <div className={`dev-edge${crit && mk > 0 ? ' crit' : ''}`} style={edge} />
      {data.banner && !thumb && !editable && <div className="dev-ban" key={`${data.banner.msg}${data.banner.until}`}><div className={`banner b-${data.banner.prio}`}>{data.banner.msg}</div></div>}
    </div>
  )
}
