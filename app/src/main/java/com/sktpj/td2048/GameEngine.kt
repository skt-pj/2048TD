package com.sktpj.td2048

import kotlin.math.hypot
import kotlin.math.max
import kotlin.random.Random

class GameEngine(
    private val random: Random = Random.Default,
    initialFormation: List<CharacterDefinition> = StarterRoster.characters,
) {
    companion object {
        private const val INITIAL_ENEMY_HP = 24f
        private const val ENEMIES_PER_WAVE = 7
        private const val ENEMY_SPAWN_SECONDS = 1.30f
        private const val PROJECTILE_SPEED = 1.30f
        private const val BOSS_EVERY_WAVES = 5
        private const val BOSS_WARNING_SECONDS = 5f
        private const val BOSS_SPEED_RATIO = 0.55f
        private const val BOSS_HP_RATIO = 12f
        private const val SLOW_SECONDS = 1.6f
        private const val SLOW_SPEED_RATIO = 0.65f

        fun nodePosition(cellIndex: Int): Pair<Float, Float> {
            val row = GameRules.rowOf(cellIndex)
            val col = GameRules.colOf(cellIndex)
            return Pair((col + 0.5f) / 4f, 0.14f + row * 0.205f)
        }

        fun enemyX(enemy: Enemy): Float =
            if (enemy.enemyType == EnemyType.BOSS) 0.5f else (enemy.lane + 0.5f) / 4f
    }

    private var formation = initialFormation.toList()
    private var enemyId = 1
    private var projectileId = 1
    private var spawnTimer = 0f
    private var enemiesSpawnedThisWave = 0
    private var lastBossWave = 0
    private var pendingBossHand: HandType? = null
    private var state = newGameState()

    init {
        require(formation.size == GameRules.CELL_COUNT)
    }

    fun snapshot(): GameSnapshot = state

    fun reset(): GameSnapshot {
        enemyId = 1
        projectileId = 1
        spawnTimer = 0f
        enemiesSpawnedThisWave = 0
        lastBossWave = 0
        pendingBossHand = null
        state = newGameState()
        return state
    }

    fun setFormation(newFormation: List<CharacterDefinition>): GameSnapshot {
        require(newFormation.size == GameRules.CELL_COUNT)
        require(newFormation.map { it.characterId }.distinct().size == GameRules.CELL_COUNT)
        formation = newFormation.toList()
        return reset()
    }

    fun move(direction: Direction): GameSnapshot {
        if (state.gameOverReason != null) return state
        val result = GameRules.moveWithoutSpawn(state.board, direction)
        if (!result.moved) return state
        val nextBoard = GameRules.spawnRandomTile(result.board, random)
        state = state.copy(
            board = nextBoard,
            score = state.score + result.createdValues.sum(),
            mergeBurst = result.createdValues.sum(),
            gameOverReason = if (GameRules.canMove(nextBoard)) null else GameOverReason.BOARD_STUCK,
        )
        return state
    }

    fun clearMergeBurst(): GameSnapshot {
        if (state.mergeBurst == 0) return state
        state = state.copy(mergeBurst = 0)
        return state
    }

    fun tick(deltaSeconds: Float): GameSnapshot {
        if (state.gameOverReason != null) return state
        val delta = deltaSeconds.coerceIn(0f, 0.05f)

        var wave = state.wave
        var score = state.score
        var currentHp = state.currentHp
        var bossWarning = state.bossWarning
        var enemies = state.enemies.map { enemy ->
            val remainingSlow = (enemy.slowRemainingSeconds - delta).coerceAtLeast(0f)
            val speedMultiplier = if (enemy.slowRemainingSeconds > 0f) SLOW_SPEED_RATIO else 1f
            enemy.copy(
                progress = enemy.progress + enemy.speed * speedMultiplier * delta,
                slowRemainingSeconds = remainingSlow,
            )
        }

        val leaked = enemies.filter { it.progress >= 1f }
        if (leaked.isNotEmpty()) {
            currentHp = (currentHp - leaked.sumOf { it.hp.toInt().coerceAtLeast(1) }).coerceAtLeast(0)
            val leakedIds = leaked.mapTo(mutableSetOf()) { it.id }
            enemies = enemies.filterNot { it.id in leakedIds }
        }

        if (currentHp <= 0) {
            state = state.copy(
                currentHp = 0,
                enemies = enemies,
                gameOverReason = GameOverReason.HP_ZERO,
            )
            return state
        }

        if (bossWarning != null) {
            val nextRemaining = bossWarning.remainingSeconds - delta
            if (nextRemaining <= 0f) {
                val bossHand = pendingBossHand ?: bossWarning.handType
                enemies = enemies + createBoss(enemyId++, wave, bossHand)
                lastBossWave = wave
                pendingBossHand = null
                bossWarning = null
            } else {
                bossWarning = bossWarning.copy(remainingSeconds = nextRemaining)
            }
        }

        spawnTimer += delta
        val spawnInterval = max(0.48f, ENEMY_SPAWN_SECONDS - (wave - 1) * 0.045f)
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0f
            enemies = enemies + createNormalEnemy(enemyId++, wave)
            enemiesSpawnedThisWave += 1
            if (enemiesSpawnedThisWave >= ENEMIES_PER_WAVE) {
                enemiesSpawnedThisWave = 0
                wave += 1
                if (wave % BOSS_EVERY_WAVES == 0 && lastBossWave != wave) {
                    val hand = randomHand()
                    pendingBossHand = hand
                    bossWarning = BossWarning(BOSS_WARNING_SECONDS, hand)
                }
            }
        }

        val cooldowns = state.cooldowns.toMutableList()
        for (index in cooldowns.indices) cooldowns[index] = (cooldowns[index] - delta).coerceAtLeast(0f)

        var projectiles = state.projectiles
        for (cellIndex in 0 until GameRules.CELL_COUNT) {
            val tileValue = state.board[cellIndex]
            if (tileValue <= 0 || cooldowns[cellIndex] > 0f) continue
            val target = TargetingPolicy.selectTarget(cellIndex, enemies) ?: continue
            val character = formation[cellIndex]
            val damage = DamageCalculator.damage(tileValue, character, GameRules.rowOf(cellIndex), target)
            val (sourceX, sourceY) = nodePosition(cellIndex)
            projectiles = projectiles + Projectile(
                id = projectileId++,
                sourceCellIndex = cellIndex,
                sourceCharacterId = character.characterId,
                targetEnemyId = target.id,
                damage = damage,
                x = sourceX,
                y = sourceY,
                speed = PROJECTILE_SPEED,
                handType = character.handType,
                onHitAbility = character.ability,
            )
            cooldowns[cellIndex] = character.attackIntervalMs / 1000f
        }

        val hits = mutableListOf<Projectile>()
        val moving = mutableListOf<Projectile>()
        for (projectile in projectiles) {
            val existingTarget = enemies.firstOrNull { it.id == projectile.targetEnemyId }
            val target = existingTarget ?: TargetingPolicy.selectTarget(projectile.sourceCellIndex, enemies)
            if (target == null) continue

            val targetX = enemyX(target)
            val targetY = target.progress
            val dx = targetX - projectile.x
            val dy = targetY - projectile.y
            val distance = hypot(dx.toDouble(), dy.toDouble()).toFloat().coerceAtLeast(0.0001f)
            val moveDistance = projectile.speed * delta
            val hitRadius = if (target.enemyType == EnemyType.BOSS) 0.065f else 0.035f
            if (distance <= moveDistance + hitRadius) {
                hits += projectile.copy(targetEnemyId = target.id)
            } else {
                moving += projectile.copy(
                    targetEnemyId = target.id,
                    x = projectile.x + (dx / distance) * moveDistance,
                    y = projectile.y + (dy / distance) * moveDistance,
                )
            }
        }

        if (hits.isNotEmpty()) {
            val hitByEnemy = hits.groupBy { it.targetEnemyId }
            val survivors = mutableListOf<Enemy>()
            for (enemy in enemies) {
                val enemyHits = hitByEnemy[enemy.id].orEmpty()
                val damage = enemyHits.sumOf { it.damage }
                val nextHp = enemy.hp - damage
                if (nextHp <= 0f) {
                    score += enemy.maxHp.toInt()
                } else {
                    val slowed = enemyHits.any { it.onHitAbility == CharacterAbility.SLOW }
                    survivors += enemy.copy(
                        hp = nextHp,
                        slowRemainingSeconds = if (slowed) max(enemy.slowRemainingSeconds, SLOW_SECONDS) else enemy.slowRemainingSeconds,
                    )
                }
            }
            enemies = survivors
        }

        state = state.copy(
            formation = formation,
            score = score,
            currentHp = currentHp,
            wave = wave,
            enemies = enemies,
            projectiles = moving,
            cooldowns = cooldowns,
            bossWarning = bossWarning,
        )
        return state
    }

    private fun newGameState(): GameSnapshot {
        val maxHp = FormationRules.maxHp(formation)
        return GameSnapshot(
            board = GameRules.initialBoard(random),
            formation = formation,
            score = 0,
            currentHp = maxHp,
            maxHp = maxHp,
            wave = 1,
            enemies = emptyList(),
            projectiles = emptyList(),
            cooldowns = List(GameRules.CELL_COUNT) { 0f },
            bossWarning = null,
            gameOverReason = null,
            mergeBurst = 0,
        )
    }

    private fun createNormalEnemy(id: Int, wave: Int): Enemy {
        val lane = random.nextInt(GameRules.GRID_SIZE)
        val maxHp = normalEnemyHp(wave) + random.nextInt(0, 9)
        return Enemy(
            id = id,
            enemyType = EnemyType.NORMAL,
            lane = lane,
            progress = -0.05f,
            speed = 0.075f + random.nextFloat() * 0.035f + wave * 0.003f,
            hp = maxHp,
            maxHp = maxHp,
            handType = randomHand(),
        )
    }

    private fun createBoss(id: Int, wave: Int, handType: HandType): Enemy {
        val hp = normalEnemyHp(wave) * BOSS_HP_RATIO
        return Enemy(
            id = id,
            enemyType = EnemyType.BOSS,
            lane = TargetingPolicy.BOSS_LANE,
            progress = -0.08f,
            speed = (0.075f + wave * 0.003f) * BOSS_SPEED_RATIO,
            hp = hp,
            maxHp = hp,
            handType = handType,
        )
    }

    private fun normalEnemyHp(wave: Int): Float = INITIAL_ENEMY_HP + wave * 7f

    private fun randomHand(): HandType = HandType.entries[random.nextInt(HandType.entries.size)]
}
