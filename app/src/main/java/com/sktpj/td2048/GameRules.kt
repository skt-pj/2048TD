package com.sktpj.td2048

import kotlin.random.Random

internal data class LineMergeResult(
    val line: List<Int>,
    val createdValues: List<Int>,
)

internal data class BoardMoveResult(
    val board: List<Int>,
    val moved: Boolean,
    val createdValues: List<Int>,
)

internal object GameRules {
    const val GRID_SIZE = 4
    const val CELL_COUNT = GRID_SIZE * GRID_SIZE

    fun initialBoard(random: Random): List<Int> =
        spawnRandomTile(spawnRandomTile(List(CELL_COUNT) { 0 }, random), random)

    fun slideAndMergeLine(line: List<Int>): LineMergeResult {
        require(line.size == GRID_SIZE)
        val compact = line.filter { it != 0 }
        val merged = mutableListOf<Int>()
        val created = mutableListOf<Int>()
        var index = 0
        while (index < compact.size) {
            if (index + 1 < compact.size && compact[index] == compact[index + 1]) {
                val value = compact[index] * 2
                merged += value
                created += value
                index += 2
            } else {
                merged += compact[index]
                index += 1
            }
        }
        while (merged.size < GRID_SIZE) merged += 0
        return LineMergeResult(merged, created)
    }

    fun moveWithoutSpawn(board: List<Int>, direction: Direction): BoardMoveResult {
        require(board.size == CELL_COUNT)
        val next = MutableList(CELL_COUNT) { 0 }
        val created = mutableListOf<Int>()
        var moved = false

        for (outer in 0 until GRID_SIZE) {
            val indices = buildList {
                for (inner in 0 until GRID_SIZE) {
                    add(
                        when (direction) {
                            Direction.LEFT -> cellIndex(outer, inner)
                            Direction.RIGHT -> cellIndex(outer, GRID_SIZE - 1 - inner)
                            Direction.UP -> cellIndex(inner, outer)
                            Direction.DOWN -> cellIndex(GRID_SIZE - 1 - inner, outer)
                        },
                    )
                }
            }
            val result = slideAndMergeLine(indices.map(board::get))
            created += result.createdValues
            result.line.forEachIndexed { lineIndex, value ->
                val boardIndex = indices[lineIndex]
                next[boardIndex] = value
                if (value != board[boardIndex]) moved = true
            }
        }
        return BoardMoveResult(next, moved, created)
    }

    fun spawnRandomTile(board: List<Int>, random: Random): List<Int> {
        val empties = board.indices.filter { board[it] == 0 }
        if (empties.isEmpty()) return board
        val target = empties[random.nextInt(empties.size)]
        return board.toMutableList().also {
            it[target] = if (random.nextFloat() < 0.9f) 2 else 4
        }
    }

    fun canMove(board: List<Int>): Boolean {
        if (board.any { it == 0 }) return true
        for (index in board.indices) {
            val row = index / GRID_SIZE
            val col = index % GRID_SIZE
            val value = board[index]
            if (col < GRID_SIZE - 1 && board[cellIndex(row, col + 1)] == value) return true
            if (row < GRID_SIZE - 1 && board[cellIndex(row + 1, col)] == value) return true
        }
        return false
    }

    fun cellIndex(row: Int, col: Int): Int = row * GRID_SIZE + col
    fun rowOf(cellIndex: Int): Int = cellIndex / GRID_SIZE
    fun colOf(cellIndex: Int): Int = cellIndex % GRID_SIZE
}
