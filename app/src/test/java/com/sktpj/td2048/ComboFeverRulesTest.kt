package com.sktpj.td2048

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ComboFeverRulesTest {
    @Test
    fun mergeCount_isConvertedToConsumedSourceTiles() {
        assertEquals(0, ComboFeverRules.processedTilesForMergeCount(0))
        assertEquals(2, ComboFeverRules.processedTilesForMergeCount(1))
        assertEquals(8, ComboFeverRules.processedTilesForMergeCount(4))
    }

    @Test
    fun comboRepresentsMergesResolvedByOneSwipe() {
        val controller = ComboFeverController()

        controller.onMerge(3)
        assertEquals(3, controller.snapshot().combo)
        assertEquals(1, controller.snapshot().comboEventId)

        controller.tick(30f)
        assertEquals(3, controller.snapshot().combo)
        assertEquals(1, controller.snapshot().comboEventId)

        controller.onMerge(2)
        assertEquals(2, controller.snapshot().combo)
        assertEquals(2, controller.snapshot().comboEventId)
    }

    @Test
    fun feverStartsWhenProcessedTilesReachTarget() {
        val controller = ComboFeverController()
        repeat(14) { controller.onMerge(1) }

        assertEquals(28, controller.snapshot().feverGaugeTiles)
        assertFalse(controller.snapshot().feverActive)

        controller.onMerge(1)
        assertTrue(controller.snapshot().feverActive)
        assertEquals(29, controller.snapshot().feverGaugeTiles)
        assertEquals(1, controller.snapshot().feverCount)
    }

    @Test
    fun feverDoesNotPrechargeTheNextGauge() {
        val controller = ComboFeverController()
        repeat(15) { controller.onMerge(1) }
        assertTrue(controller.snapshot().feverActive)

        controller.onMerge(4)
        assertEquals(4, controller.snapshot().combo)
        assertEquals(29, controller.snapshot().feverGaugeTiles)

        controller.tick(ComboFeverRules.FEVER_DURATION_SECONDS + 0.1f)
        assertFalse(controller.snapshot().feverActive)
        assertEquals(0, controller.snapshot().feverGaugeTiles)
    }
}
