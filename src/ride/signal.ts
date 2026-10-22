import type { Prio } from '../strategy/types'
import type { NavCue, NavCueMode } from './nav'

let audio: AudioContext | null = null

/** À appeler depuis un geste de l'utilisateur : les navigateurs bloquent le son avant. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext
    if (!audio && AC) audio = new AC()
    else audio?.resume()
  } catch { /* son indisponible */ }
}

/** Vibration et bip selon la priorité. Les infos restent silencieuses. */
export function signal(prio: Prio) {
  if (prio === 'info') return
  try { navigator.vibrate?.(prio === 'critique' ? [250, 120, 250] : 180) } catch { /* pas de vibreur */ }
  beeps(prio === 'critique' ? [[1320, 0.5]] : [[880, 0.25]])
}

/** Suite de bips [fréquence (Hz), durée (s)], séparés de 0,08 s. */
function beeps(seq: [number, number][]) {
  if (!audio) return
  try {
    let t = audio.currentTime
    for (const [f, len] of seq) {
      const o = audio.createOscillator(), g = audio.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + len)
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + len + 0.05)
      t += len + 0.08
    }
  } catch { /* ignoré */ }
}

// Annonces de navigation : deux notes montantes à l'approche, une longue au virage, trois graves hors parcours, une aiguë au retour.
const CUE: Record<NavCue, { vibe: number[]; beep: [number, number][] }> = {
  approche: { vibe: [120, 80, 120], beep: [[880, 0.12], [1175, 0.16]] },
  virage: { vibe: [300], beep: [[1175, 0.35]] },
  hors: { vibe: [400, 150, 400, 150, 400], beep: [[440, 0.25], [440, 0.25], [440, 0.25]] },
  retour: { vibe: [80], beep: [[1568, 0.15]] },
}
/** Joue une annonce de navigation selon le réglage (bip, vibration, les deux, rien). */
export function cue(c: NavCue, mode: NavCueMode) {
  if (mode === 'off') return
  if (mode !== 'beep') try { navigator.vibrate?.(CUE[c].vibe) } catch { /* pas de vibreur */ }
  if (mode !== 'vibe') beeps(CUE[c].beep)
}
