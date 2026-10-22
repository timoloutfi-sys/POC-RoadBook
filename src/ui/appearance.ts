import type { Accent, Appearance } from '../storage/defaults'
import { useStore } from '../storage/store'

/** Pose `data-theme` (clair ou sombre) et `data-accent` sur <html>, et suit le thème du téléphone en mode automatique. */
export function startAppearance() {
  const mq = window.matchMedia('(prefers-color-scheme: light)')
  const apply = () => {
    const { appearance = 'auto', accent = 'graphite' } = useStore.getState() as { appearance?: Appearance; accent?: Accent }
    const light = appearance === 'auto' ? mq.matches : appearance === 'light'
    document.documentElement.dataset.theme = light ? 'light' : 'dark'
    document.documentElement.dataset.accent = accent
  }
  apply()
  mq.addEventListener('change', apply)
  useStore.subscribe(apply)
}
