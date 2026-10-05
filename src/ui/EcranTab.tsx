import { useState } from 'react'
import { TEMPLATES, type ScreenDef } from '../storage/defaults'
import { createScreen, duplicateScreen, moveScreen, removeScreen } from '../storage/screens'
import { useStore } from '../storage/store'
import { previewData } from '../ride/data'
import { AlertsSection } from './AlertsSection'
import { ScaledDevice } from './ScaledDevice'
import { ScreenEditor } from './ScreenEditor'
import { Icon } from './icons'
import { Sheet } from './Sheet'
import { toast } from './toast'

type Tpl = keyof typeof TEMPLATES | 'vide'

export function EcranTab() {
  const { screens, activeScreen, set } = useStore()
  const [editId, setEditId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const edit = screens.find(s => s.id === editId)

  if (edit) return renderEditor(edit, edit.id === activeScreen, () => setEditId(null))

  return (
    <>
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
        <ScreenEditor key={screen.id} screen={screen} isStart={isStart} onClose={onBack} />
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={dup}>Dupliquer l'écran</button>
          <button className="btn" aria-label="Monter" onClick={() => set({ screens: moveScreen(screens, screen.id, -1) })}><Icon name="up" size={20} /></button>
          <button className="btn" aria-label="Descendre" onClick={() => set({ screens: moveScreen(screens, screen.id, 1) })}><Icon name="down" size={20} /></button>
          <button className="btn danger" disabled={screens.length < 2} onClick={() => { set({ screens: removeScreen(screens, screen.id) }); if (isStart) set({ activeScreen: screens.find(s => s.id !== screen.id)!.id }); onBack() }}>Supprimer l'écran</button>
        </div>
      </>
    )
  }
}
