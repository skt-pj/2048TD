package com.sktpj.td2048

import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

enum class Direction {
    UP,
    DOWN,
    LEFT,
    RIGHT,
}

data class Enemy(
    val id: Int,
    val x: Float,
    val y: Float,
    val speed: Float,
    val hp: Float,
    val maxHp: Float,
    val radius: Float,
)

data class Projectile(
    val id: Int,
    val x: Float,
    val y: Float,
    val damage: Int,
    val speed: Float,
    val targetId: Int,
)

data class GameSnapshot(
    val board: List<Int>,
    val score: Int,
    val baseHp: Int,
    val wave: Int,
    val enemies: List<Enemy>,
    val projectiles: List<Projectile>,
    val gameOver: Boolean,
    val bestShot: Int,
    val lastAutoShot: Int,
    val mergeBurst: Int,
)

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

    fun initialBoard(random: Random): List<Int> {
        return spawnRandomTile(spawnRandomTile(List(CELL_COUNT) { 0 }, random), random)
    }

    fun slideAndMergeLine(line: List<Int>): LineMergeResult {
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

        while (merged.size < GRID_SIZE) {
            merged += 0
        }

        return LineMergeResult(merged, created)
    }

    fun moveWithoutSpawn(board: List<Int>, direction: Direction): BoardMoveResult {
        require(board.size == CELL_COUNT) { "Board must contain $CELL_COUNT cells." }

        val next = MutableList(CELL_COUNT) { 0 }
        val created = mutableListOf<Int>()
        var moved = false

        for (outer in 0 until GRID_SIZE) {
            val indices = buildList {
                for (inner in 0 until GRID_SIZE) {
                    add(
                        when (direction) {
                            Direction.LEFT -> rowColToIndex(outer, inner)
                            Direction.RIGHT -> rowColToIndex(outer, GRID_SIZE - 1 - inner)
                            Direction.UP -> rowColToIndex(inner, outer)
                            Direction.DOWN -> rowColToIndex(GRID_SIZE - 1 - inner, outer)
                        },
                    )
                }
            }

            val result = slideAndMergeLine(indices.map { board[it] })
            created += result.createdValues

            result.line.forEachIndexed { lineIndex, value ->
                val boardIndex = indices[lineIndex]
                next[boardIndex] = value
                if (value != board[boardIndex]) {
                    moved = true
                }
            }
        }

        return BoardMoveResult(next, moved, created)
    }

    fun spawnRandomTile(board: List<Int>, random: Random): List<Int> {
        val emptyIndices = board.indices.filter { board[it] == 0 }
        if (emptyIndices.isEmpty()) return board

        val target = emptyIndices[random.nextInt(emptyIndices.size)]
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

            if (col < GRID_SIZE - 1 && board[rowColToIndex(row, col + 1)] == value) return true
            if (row < GRID_SIZE - 1 && board[rowColToIndex(row + 1, col)] == value) return true
        }

        return false
    }

    fun computeBoardAutoDamage(board: List<Int>): Int {
        val activeTiles = board.filter { it > 0 }
        if (activeTiles.isEmpty()) return 2

        val maxTile = activeTiles.maxOrNull() ?: 2
        val boardSum = activeTiles.sum()
        return max(2, maxTile / 2 + boardSum / 32)
    }

    private fun rowColToIndex(row: Int, col: Int): Int = row * GRID_SIZE + col
}

class GameEngine(
    private val random: Random = Random.Default,
) {
    companion object {
        private const val INITIAL_BASE_HP = 100
        private const val INITIAL_ENEMY_HP = 18
        private const val ENEMY_SPAWN_SECONDS = 1.3f
        private const val AUTO_FIRE_SECONDS = 0.9f
        private const val BASE_X = 0.07f
        private const val PROJECTILE_SPEED = 0.9f
    }

    private var enemyId = 1
    private var projectileId = 1
    private var spawnedEnemies = 0
    private var spawnTimer = 0f
    private var autoFireTimer = 0f

    private var state = newGameState()

    fun snapshot(): GameSnapshot = state

    fun reset(): GameSnapshot {
        enemyId = 1
        projectileId = 1
        spawnedEnemies = 0
        spawnTimer = 0f
        autoFireTimer = 0f
        state = newGameState()
        return state
    }

    fun move(direction: Direction): GameSnapshot {
        if (state.gameOver) return state

        val result = GameRules.moveWithoutSpawn(state.board, direction)
        if (!result.moved) return state

        val nextBoard = GameRules.spawnRandomTile(result.board, random)
        val mergeScore = result.createdValues.sum()
        val gameOver = !GameRules.canMove(nextBoard)

        state = state.copy(
            board = nextBoard,
            score = state.score + mergeScore,
            gameOver = gameOver,
            mergeBurst = mergeScore,
        )
        return state
    }

    fun clearMergeBurst(): GameSnapshot {
        if (state.mergeBurst == 0) return state
        state = state.copy(mergeBurst = 0)
        return state
    }

    fun tick(deltaSeconds: Float): GameSnapshot {
        if (state.gameOver) return state

        val delta = deltaSeconds.coerceIn(0f, 0.05f)
        spawnTimer += delta
        autoFireTimer += delta

        var wave = state.wave
        var score = state.score
        var baseHp = state.baseHp
        var enemies = state.enemies.map { enemy ->
            enemy.copy(x = enemy.x - enemy.speed * delta)
        }

        val reachedBase = enemies.filter { it.x <= BASE_X }
        if (reachedBase.isNotEmpty()) {
            val damage = reachedBase.sumOf { enemy -> max(4, (enemy.maxHp / 4f).toInt()) }
            baseHp = max(0, baseHp - damage)
            val reachedIds = reachedBase.mapTo(mutableSetOf()) { it.id }
            enemies = enemies.filterNot { it.id in reachedIds }
        }

        val spawnInterval = max(0.42f, ENEMY_SPAWN_SECONDS - (wave - 1) * 0.055f)
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0f
            enemies = enemies + createEnemy(enemyId++, wave)
            spawnedEnemies += 1
            if (spawnedEnemies % 7 == 0) {
                wave += 1
            }
        }

        var projectiles = state.projectiles
        var bestShot = state.bestShot
        var lastAutoShot = state.lastAutoShot

        if (autoFireTimer >= AUTO_FIRE_SECONDS) {
            autoFireTimer = 0f
            val target = enemies.minByOrNull { it.x }
            if (target != null) {
                val damage = GameRules.computeBoardAutoDamage(state.board)
                projectiles = projectiles + Projectile(
                    id = projectileId++,
                    x = 0.10f,
                    y = 0.50f,
                    damage = damage,
                    speed = PROJECTILE_SPEED,
                    targetId = target.id,
                )
                bestShot = max(bestShot, damage)
                lastAutoShot = damage
            }
        }

        val damageByEnemyId = mutableMapOf<Int, Int>()
        val movingProjectiles = mutableListOf<Projectile>()

        for (projectile in projectiles) {
            val target = enemies.firstOrNull { it.id == projectile.targetId }
                ?: enemies.minByOrNull { it.x }
                ?: continue

            val dx = target.x - projectile.x
            val dy = target.y - projectile.y
            val distance = hypot(dx.toDouble(), dy.toDouble()).toFloat().coerceAtLeast(0.0001f)
            val moveDistance = projectile.speed * delta

            if (distance <= moveDistance + target.radius) {
                damageByEnemyId[target.id] = (damageByEnemyId[target.id] ?: 0) + projectile.damage
            } else {
                movingProjectiles += projectile.copy(
                    x = projectile.x + dx / distance * moveDistance,
                    y = projectile.y + dy / distance * moveDistance,
                    targetId = target.id,
                )
            }
        }

        if (damageByEnemyId.isNotEmpty()) {
            val survivors = mutableListOf<Enemy>()
            for (enemy in enemies) {
                val nextHp = enemy.hp - (damageByEnemyId[enemy.id] ?: 0)
                if (nextHp <= 0f) {
                    score += enemy.maxHp.toInt()
                } else {
                    survivors += enemy.copy(hp = nextHp)
                }
            }
            enemies = survivors
        }

        state = state.copy(
            score = score,
            baseHp = baseHp,
            wave = wave,
            enemies = enemies,
            projectiles = movingProjectiles,
            gameOver = baseHp <= 0,
            bestShot = bestShot,
            lastAutoShot = lastAutoShot,
        )

        return state
    }

    private fun newGameState(): GameSnapshot {
        return GameSnapshot(
            board = GameRules.initialBoard(random),
            score = 0,
            baseHp = INITIAL_BASE_HP,
            wave = 1,
            enemies = emptyList(),
            projectiles = emptyList(),
            gameOver = false,
            bestShot = 0,
            lastAutoShot = 0,
            mergeBurst = 0,
        )
    }

    private fun createEnemy(id: Int, wave: Int): Enemy {
        val lane = random.nextInt(4)
        val maxHp = (INITIAL_ENEMY_HP + wave * 4 + random.nextInt(10)).toFloat()

        return Enemy(
            id = id,
            x = 1.05f,
            y = 0.18f + lane * 0.20f,
            speed = 0.06f + random.nextFloat() * 0.05f + wave * 0.004f,
            hp = maxHp,
            maxHp = maxHp,
            radius = min(0.05f, 0.03f + wave * 0.001f),
        )
    }
}
