/** Durée sur laquelle un écart avec le GPS est résorbé (s), et seuils de saut (m). */
export const CATCH_UP_S = 3
export const NO_BACK_M = 30
export const SNAP_M = 100

/**
 * Distance parcourue fluide entre deux positions GPS : elle avance avec la vitesse mesurée, et chaque
 * recalage sur le tracé est résorbé en 3 s. Pas de saut en arrière de moins de 30 m ; au-delà de 100 m
 * d'écart (demi-tour, reprise), la distance saute directement. Pur, sans horloge : on lui donne `dt`.
 */
export class Position {
  d = 0
  private corr = 0
  private left = 0
  private total: number
  constructor(total = Infinity) { this.total = total }

  reset(d = 0, total?: number) { this.d = d; this.corr = 0; this.left = 0; this.total = total ?? Infinity }

  /** Position recalée sur le tracé (m). */
  fix(pos: number) {
    const err = pos - this.d
    if (Math.abs(err) > SNAP_M) { this.d = pos; this.corr = 0; this.left = 0; return }
    this.corr = err; this.left = CATCH_UP_S
  }

  /** Avance de dt secondes à la vitesse v (m/s). */
  step(dt: number, v: number) {
    let move = Math.max(0, v) * dt
    if (this.left > 0 && this.corr !== 0) {
      const part = Math.min(dt, this.left) / this.left
      move += this.corr * part
      this.corr -= this.corr * part; this.left -= Math.min(dt, this.left)
      if (this.left <= 0) this.corr = 0
    }
    // Jamais de recul, sauf un recalage franc (voir fix).
    this.d = Math.min(this.total, this.d + Math.max(0, move))
    return this.d
  }
}
