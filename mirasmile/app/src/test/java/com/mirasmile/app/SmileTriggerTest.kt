package com.mirasmile.app

import com.mirasmile.app.SmileTrigger.State
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SmileTriggerTest {
    private fun feed(t: SmileTrigger, smile: Float?, from: Long, to: Long, step: Long = 50): List<State> =
        (from until to step step).map { t.update(smile, it) }

    @Test fun pasDeVisagePasDePhoto() {
        val t = SmileTrigger()
        assertTrue(feed(t, null, 0, 2000).all { it == State.NO_FACE })
    }

    @Test fun visageNeutrePasDePhoto() {
        val t = SmileTrigger()
        assertTrue(feed(t, 0.1f, 0, 3000).none { it == State.FIRE })
    }

    @Test fun sourireTenuDeclencheUneSeuleFois() {
        val t = SmileTrigger()
        val states = feed(t, 0.95f, 0, 5000)
        assertEquals(1, states.count { it == State.FIRE })
        assertEquals(State.REARM, states.last())
    }

    @Test fun uneImageIsoleeNeDeclenchePas() {
        val t = SmileTrigger()
        feed(t, 0.1f, 0, 500)
        assertTrue(t.update(1f, 500) != State.FIRE)
        assertTrue(feed(t, 0.1f, 550, 1500).none { it == State.FIRE })
    }

    @Test fun nouvelleSourireApresAirNeutre() {
        val t = SmileTrigger()
        var all = feed(t, 0.95f, 0, 2000)
        all = all + feed(t, 0.05f, 2000, 4000)
        all = all + feed(t, 0.95f, 4000, 6000)
        assertEquals(2, all.count { it == State.FIRE })
    }
}
