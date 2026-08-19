package com.sktpj.td2048

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ComboFeverRulesTest {
    @Test
    fun comboWindows_followReferenceThresholds() {
        assertEquals(3f, ComboFeverRules.comboWindowSeconds(1), 0.0001f)
        assertEquals(3f, ComboFeverRules.comboWindowSeconds(50), 0.0001f)
        assertEquals(2f, ComboFeverRules.comboWindowSeconds(51), 0.0001f)
        assertEquals(2f, ComboFeverRules.comboWindowSeconds(100), 0.0001f)
        assertEquals(1f, ComboFeverRules.comboWindowSeconds(101), 0.0001f)
        assertEquals(1f, ComboFeverRules.comboWindowSeconds(500), 0.0001f)
        assertEquals(0.5f, ComboFeverRules.comboWindowSeconds(501), 0.0001f)
    }

    @Test
    fun mergeCount_isConvertedToConsumedSourceTiles() {
        assertEquals(0, ComboFeverRules.processedTilesForMergeCount(0))
        assertEquals(2, ComboFeverRules.processedTilesForMergeCount(1))
        assertEquals(8, ComboFeverRules.processedTilesForMergeCount(4))
    }

    @Test
    fun comboExpiresAfterCurrentWindow() {
        val controller = ComboFeverController()
        controller.onMerge(1)

        assertEquals(1, controller.snapshot().combo)
        controller.tick(2.9f)
        assertEquals(1, controller.snapshot().combo)
        controller.tick(0.2f)
        assertEquals(0, controller.snapshot().combo)
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
    fun comboDoesNotExpireDuringFever() {
        val controller = ComboFeverController()
        repeat(15) { controller.onMerge(1) }
        val comboAtStart = controller.snapshot().combo

        controller.tick(10.5f)
        assertTrue(controller.snapshot().feverActive)
        assertEquals(comboAtStart, controller.snapshot().combo)

        controller.tick(0.6f)
        assertFalse(controller.snapshot().feverActive)
        assertEquals(comboAtStart, controller.snapshot().combo)

        controller.tick(3.1f)
        assertEquals(0, controller.snapshot().combo)
    }
}
