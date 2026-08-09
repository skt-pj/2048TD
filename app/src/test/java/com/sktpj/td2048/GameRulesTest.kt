package com.sktpj.td2048

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GameRulesTest {
    @Test
    fun slideAndMergeLine_mergesSinglePair() {
        val result = GameRules.slideAndMergeLine(listOf(2, 2, 0, 0))

        assertEquals(listOf(4, 0, 0, 0), result.line)
        assertEquals(listOf(4), result.createdValues)
    }

    @Test
    fun slideAndMergeLine_doesNotChainMergeInSameMove() {
        val result = GameRules.slideAndMergeLine(listOf(2, 2, 2, 2))

        assertEquals(listOf(4, 4, 0, 0), result.line)
        assertEquals(listOf(4, 4), result.createdValues)
    }

    @Test
    fun canMove_returnsFalseForLockedBoard() {
        val board = listOf(
            2, 4, 2, 4,
            4, 2, 4, 2,
            2, 4, 2, 4,
            4, 2, 4, 2,
        )

        assertFalse(GameRules.canMove(board))
    }

    @Test
    fun canMove_returnsTrueWhenMergeExists() {
        val board = listOf(
            2, 2, 4, 8,
            16, 32, 64, 128,
            2, 4, 8, 16,
            32, 64, 128, 256,
        )

        assertTrue(GameRules.canMove(board))
    }

    @Test
    fun computeBoardAutoDamage_usesMaxTileAndBoardSum() {
        val board = listOf(
            2, 4, 8, 16,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
        )

        assertEquals(8, GameRules.computeBoardAutoDamage(board))
    }

    @Test
    fun moveWithoutSpawn_movesAndMergesLeft() {
        val board = listOf(
            2, 0, 2, 0,
            4, 4, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
        )

        val result = GameRules.moveWithoutSpawn(board, Direction.LEFT)

        assertTrue(result.moved)
        assertEquals(
            listOf(
                4, 0, 0, 0,
                8, 0, 0, 0,
                0, 0, 0, 0,
                0, 0, 0, 0,
            ),
            result.board,
        )
        assertEquals(listOf(4, 8), result.createdValues)
    }
}
