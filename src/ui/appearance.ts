import type { Appearance } from '../storage/defaults'
import { useStore } from '../storage/store'

/** Pose `data-theme` (clair ou sombre) sur <html>, et suit le thème du téléphone en mode automatique. */
export function startAppearance() {
  const mq = window.matchMedia('(prefers-color-scheme: light)')
  const apply = () => {
    const { appearance = 'auto' } = useStore.getState() as { appearance?: Appearance }
    const light = appearance === 'auto' ? mq.matches : appearance === 'light'
    document.documentElement.dataset.theme = light ? 'light' : 'dark'
  }
  apply()
  mq.addEventListener('change', apply)
  useStore.subscribe(apply)
}
