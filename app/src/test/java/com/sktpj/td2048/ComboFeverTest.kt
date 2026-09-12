package com.sktpj.td2048

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ComboFeverTest {
    @Test
    fun oneSwipeCombo_equalsMergeGroupsResolvedByThatSwipe() {
        val controller = ComboFeverController()

        controller.onMerge(3)

        val state = controller.snapshot()
        assertEquals(3, state.combo)
        assertEquals(1, state.comboEventId)
        assertEquals(6, state.feverGaugeTiles)
    }

    @Test
    fun fifteenSingleMerges_fillTwentyNineTileGaugeAndStartFever() {
        val controller = ComboFeverController()

        repeat(15) { controller.onMerge(1) }

        val state = controller.snapshot()
        assertTrue(state.feverActive)
        assertEquals(29, state.feverGaugeTiles)
        assertEquals(1, state.feverCount)
        assertEquals(ComboFeverRules.FEVER_DURATION_SECONDS, state.feverRemainingSeconds, 0.0001f)
    }

    @Test
    fun mergesDuringFever_doNotExtendDurationOrAddGauge() {
        val controller = ComboFeverController()
        repeat(15) { controller.onMerge(1) }
        controller.tick(1f)
        val before = controller.snapshot()

        controller.onMerge(4)

        val after = controller.snapshot()
        assertEquals(4, after.combo)
        assertEquals(before.feverGaugeTiles, after.feverGaugeTiles)
        assertEquals(before.feverRemainingSeconds, after.feverRemainingSeconds, 0.0001f)
    }

    @Test
    fun feverEnd_resetsGauge() {
        val controller = ComboFeverController()
        repeat(15) { controller.onMerge(1) }

        controller.tick(ComboFeverRules.FEVER_DURATION_SECONDS)

        val state = controller.snapshot()
        assertFalse(state.feverActive)
        assertEquals(0, state.feverGaugeTiles)
    }
}
