package com.mirasmile.app

/**
 * Décide quand déclencher la photo à partir de la probabilité de sourire
 * donnée image par image par le détecteur de visage.
 *
 * - lissage pour ignorer une image isolée mal lue ;
 * - le sourire doit tenir [holdMs] au-dessus de [fireAt] ;
 * - après une photo, il faut reprendre un air neutre (sous [rearmAt]) ou
 *   sortir du champ avant qu'une nouvelle photo soit possible : pas de rafale.
 */
class SmileTrigger(
    private val fireAt: Float = 0.75f,
    private val rearmAt: Float = 0.35f,
    private val holdMs: Long = 300,
    private val cooldownMs: Long = 1500,
) {
    enum class State { NO_FACE, WAITING, ALMOST, FIRE, REARM }

    var level = 0f
        private set
    private var armed = true
    private var holdSince = -1L
    private var firedAt = Long.MIN_VALUE / 2
    private var lostSince = -1L

    fun update(smile: Float?, now: Long): State {
        if (smile == null) {
            level *= 0.5f
            holdSince = -1L
            if (lostSince < 0) lostSince = now
            if (!armed && now - lostSince > 1000 && now - firedAt > cooldownMs) armed = true
            return if (armed) State.NO_FACE else State.REARM
        }
        lostSince = -1L
        level = 0.5f * level + 0.5f * smile.coerceIn(0f, 1f)

        if (!armed) {
            if (level < rearmAt && now - firedAt > cooldownMs) armed = true
            else return State.REARM
        }
        if (level >= fireAt) {
            if (holdSince < 0) holdSince = now
            if (now - holdSince >= holdMs) {
                armed = false
                holdSince = -1L
                firedAt = now
                return State.FIRE
            }
            return State.ALMOST
        }
        holdSince = -1L
        return State.WAITING
    }

    /** Photo prise à la main : même pause qu'après un sourire. */
    fun manualFire(now: Long) {
        armed = false
        holdSince = -1L
        firedAt = now
    }
}
