import { useState } from 'react'
import { WIDGETS, TEMPLATES, type WidgetKind, type ScreenDef } from '../storage/defaults'
import { addWidget, createScreen, duplicateScreen, moveScreen, removeScreen } from '../storage/screens'
import { useStore } from '../storage/store'
import { previewData } from '../ride/data'
import { AlertsSection } from './AlertsSection'
import { ScaledDevice } from './ScaledDevice'
import { Field } from './fields'
import { Icon } from './icons'
import { Sheet } from './Sheet'
import { toast } from './toast'

type Tpl = keyof typeof TEMPLATES | 'vide'

export function EcranTab() {
  const { screens, activeScreen, set } = useStore()
  const [editId, setEditId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [src, setSrc] = useState<'power' | 'hr'>('power')
  const [tone, setTone] = useState(1)
  const [adding, setAdding] = useState(false)
  const edit = screens.find(s => s.id === editId)
  const upd = (id: string, p: Partial<ScreenDef>) => set({ screens: screens.map(s => (s.id === id ? { ...s, ...p } : s)) })

  if (edit) return renderEditor(edit, edit.id === activeScreen, () => setEditId(null))

  return (
    <>
      <p className="muted" style={{ marginBottom: 12 }}>Crée plusieurs écrans (plat, montée, nuit…). En course, glisse le pouce sur le bord droit pour changer d'écran.</p>
      <div className="stack">
        {screens.map(s => (
          <button key={s.id} className="card" onClick={() => setEditId(s.id)}>
            <div className="thumbw"><ScaledDevice items={s.items} data={previewData()} tone={1} thumb /></div>
            <div className="t"><b>{s.name}</b><small>{s.items.length} widgets{s.id === activeScreen ? ' · écran de départ' : ''}</small></div>
          </button>
        ))}
      </div>
      <button className="btn primary" style={{ marginTop: 16 }} onClick={() => setCreating(true)}><Icon name="plus" size={20} />Nouvel écran</button>
      <AlertsSection />
      {creating && (
        <Sheet title="Nouvel écran" onClose={() => setCreating(false)}>
          <p className="muted" style={{ marginBottom: 12 }}>Pars d'un modèle ou d'un écran vide.</p>
          <div className="stack">
            {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map(k => <button key={k} className="btn" onClick={() => add(k)}>{TEMPLATES[k].n}</button>)}
            <button className="btn" onClick={() => add('vide')}>Écran vide</button>
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
  function renderEditor(screen: ScreenDef, isStart: boolean, onBack: () => void) {
    const dup = () => { const c = duplicateScreen(screen); set({ screens: [...screens, c] }); setEditId(c.id); toast('Écran dupliqué.') }
    return (
      <>
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn ghost" onClick={onBack}>← Écrans</button>
        </div>
        <Field label="Nom de l'écran"><input value={screen.name} maxLength={30} onChange={e => upd(screen.id, { name: e.target.value })} /></Field>
        <div className="row" style={{ marginBottom: 8 }}>
          <div className="seg" role="group" aria-label="Aperçu de la mesure"><button aria-pressed={src === 'power'} onClick={() => setSrc('power')}>Watts</button><button aria-pressed={src === 'hr'} onClick={() => setSrc('hr')}>Cardio</button></div>
          <div className="seg" role="group" aria-label="Aperçu du thème"><button aria-pressed={tone === 0} onClick={() => setTone(0)}>Jour</button><button aria-pressed={tone === 1} onClick={() => setTone(1)}>Nuit</button></div>
        </div>
        <ScaledDevice className="edit-dev" items={screen.items} data={previewData(src)} tone={tone} editable onChange={items => upd(screen.id, { items })} />
        <p className="muted" style={{ margin: '8px 0 12px', fontSize: 14 }}>Glisse un widget pour le déplacer, tire son coin pour l'agrandir.</p>
        <div className="row">
          <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={20} />Ajouter un widget</button>
          {!isStart && <button className="btn" onClick={() => { set({ activeScreen: screen.id }); toast('Écran de départ défini.') }}>Écran de départ</button>}
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={dup}>Dupliquer</button>
          <button className="btn" aria-label="Monter" onClick={() => set({ screens: moveScreen(screens, screen.id, -1) })}><Icon name="up" size={20} /></button>
          <button className="btn" aria-label="Descendre" onClick={() => set({ screens: moveScreen(screens, screen.id, 1) })}><Icon name="down" size={20} /></button>
          <button className="btn danger" disabled={screens.length < 2} onClick={() => { set({ screens: removeScreen(screens, screen.id) }); if (isStart) set({ activeScreen: screens.find(s => s.id !== screen.id)!.id }); onBack() }}>Supprimer</button>
        </div>
        {adding && (
          <Sheet title="Ajouter un widget" onClose={() => setAdding(false)}>
            <div className="stack">
              {(Object.keys(WIDGETS) as WidgetKind[]).map(k => (
                <button key={k} className="btn" onClick={() => { const n = addWidget(screen.items, k); if (n) { upd(screen.id, { items: n }); setAdding(false) } else toast('Plus de place : retire ou réduis un widget.') }}>{WIDGETS[k]}</button>
              ))}
            </div>
          </Sheet>
        )}
      </>
    )
  }
}
