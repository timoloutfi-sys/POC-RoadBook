import type { Prio } from '../strategy/types'

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
  if (!audio) return
  try {
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime, len = prio === 'critique' ? 0.5 : 0.25
    o.frequency.value = prio === 'critique' ? 1320 : 880
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len)
    o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + len + 0.05)
  } catch { /* ignoré */ }
}
