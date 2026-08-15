package com.sktpj.td2048

import kotlin.math.abs
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
        private const val BOSS_EVERY_WAVES = 5
        private const val BOSS_WARNING_SECONDS = 5f
        private const val BOSS_SPEED_RATIO = 0.55f
        private const val BOSS_HP_RATIO = 12f
        private const val SLOW_SPEED_RATIO = 0.65f
        private const val HP_DAMAGE_FLASH_SECONDS = 1.2f
        private const val MAX_LOG_ENTRIES = 6

        fun nodePosition(cellIndex: Int): Pair<Float, Float> {
            val row = GameRules.rowOf(cellIndex)
            val col = GameRules.colOf(cellIndex)
            return Pair((col + 0.5f) / 4f, 0.14f + row * 0.205f)
        }

        fun turretPosition(column: Int): Pair<Float, Float> {
            require(column in 0 until GameRules.GRID_SIZE)
            return Pair((column + 0.5f) / GameRules.GRID_SIZE, 0.955f)
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
        val gameOverReason = if (GameRules.canMove(nextBoard)) null else GameOverReason.BOARD_STUCK
        val nextLog = if (gameOverReason == GameOverReason.BOARD_STUCK) {
            appendLog(state.eventLog, state.elapsedSeconds, "2048盤面が詰まりました", BattleLogTone.WARNING)
        } else {
            state.eventLog
        }
        state = state.copy(
            board = nextBoard,
            score = state.score + result.createdValues.sum(),
            mergeBurst = result.createdValues.sum(),
            gameOverReason = gameOverReason,
            eventLog = nextLog,
            columns = buildColumnStates(nextBoard, state.cooldowns),
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
        val elapsedSeconds = state.elapsedSeconds + delta

        var wave = state.wave
        var score = state.score
        var currentHp = state.currentHp
        var bossWarning = state.bossWarning
        var eventLog = state.eventLog
        var hpDamageFlash = state.hpDamageFlash?.let { flash ->
            val remaining = flash.remainingSeconds - delta
            if (remaining > 0f) flash.copy(remainingSeconds = remaining) else null
        }
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
            val leakDamage = leaked.sumOf { it.hp.toInt().coerceAtLeast(1) }
            currentHp = (currentHp - leakDamage).coerceAtLeast(0)
            hpDamageFlash = HpDamageFlash(leakDamage, HP_DAMAGE_FLASH_SECONDS)
            eventLog = appendLog(eventLog, elapsedSeconds, "敵突破  HP -$leakDamage", BattleLogTone.WARNING)
            val leakedIds = leaked.mapTo(mutableSetOf()) { it.id }
            enemies = enemies.filterNot { it.id in leakedIds }
        }

        if (currentHp <= 0) {
            eventLog = appendLog(eventLog, elapsedSeconds, "総HPが0になりました", BattleLogTone.WARNING)
            state = state.copy(
                currentHp = 0,
                enemies = enemies,
                gameOverReason = GameOverReason.HP_ZERO,
                elapsedSeconds = elapsedSeconds,
                eventLog = eventLog,
                hpDamageFlash = hpDamageFlash,
                columns = buildColumnStates(state.board, state.cooldowns),
            )
            return state
        }

        if (bossWarning != null) {
            val nextRemaining = bossWarning.remainingSeconds - delta
            if (nextRemaining <= 0f) {
                val bossHand = pendingBossHand ?: bossWarning.handType
                enemies = enemies + createBoss(enemyId++, wave, bossHand)
                eventLog = appendLog(eventLog, elapsedSeconds, "BOSS出現", BattleLogTone.WARNING)
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
                eventLog = appendLog(eventLog, elapsedSeconds, "WAVE $wave", BattleLogTone.INFO)
                if (wave % BOSS_EVERY_WAVES == 0 && lastBossWave != wave) {
                    val hand = randomHand()
                    pendingBossHand = hand
                    bossWarning = BossWarning(BOSS_WARNING_SECONDS, hand)
                    eventLog = appendLog(eventLog, elapsedSeconds, "BOSS WARNING", BattleLogTone.WARNING)
                }
            }
        }

        val cooldowns = state.cooldowns.toMutableList()
        for (index in cooldowns.indices) {
            cooldowns[index] = (cooldowns[index] - delta).coerceAtLeast(0f)
        }

        var projectiles = state.projectiles
        for (column in 0 until GameRules.GRID_SIZE) {
            val power = ColumnCombatRules.columnPower(state.board, column)
            if (power <= 0 || cooldowns[column] > 0f) continue
            val target = ColumnCombatRules.selectTarget(column, enemies) ?: continue
            val level = ColumnCombatRules.columnLevel(state.board, column)
            val weaponType = ColumnCombatRules.weaponType(level)
            val (sourceX, sourceY) = turretPosition(column)
            projectiles = projectiles + Projectile(
                id = projectileId++,
                sourceCellIndex = column,
                sourceCharacterId = "column-$column",
                targetEnemyId = target.id,
                damage = power,
                x = sourceX,
                y = sourceY,
                speed = ColumnCombatRules.projectileSpeed(weaponType),
                handType = HandType.ROCK,
                onHitAbility = CharacterAbility.NONE,
                weaponType = weaponType,
            )
            cooldowns[column] = ColumnCombatRules.fireIntervalSeconds(weaponType)
        }

        val hits = mutableListOf<Projectile>()
        val moving = mutableListOf<Projectile>()
        for (projectile in projectiles) {
            val sourceColumn = projectile.sourceCellIndex.coerceIn(0, GameRules.GRID_SIZE - 1)
            val existingTarget = enemies.firstOrNull { it.id == projectile.targetEnemyId }
            val target = existingTarget ?: ColumnCombatRules.selectTarget(sourceColumn, enemies)
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
            val damageByEnemyId = mutableMapOf<Int, Int>()
            for (projectile in hits) {
                val target = enemies.firstOrNull { it.id == projectile.targetEnemyId } ?: continue
                val sourceColumn = projectile.sourceCellIndex.coerceIn(0, GameRules.GRID_SIZE - 1)
                when (projectile.weaponType) {
                    WeaponType.NORMAL,
                    WeaponType.RAPID,
                    WeaponType.MACHINE_GUN -> {
                        addDamage(damageByEnemyId, target.id, projectile.damage)
                    }

                    WeaponType.PIERCING -> {
                        addDamage(damageByEnemyId, target.id, projectile.damage)
                        enemies.asSequence()
                            .filter { it.id != target.id && ColumnCombatRules.canAttack(sourceColumn, it) }
                            .sortedByDescending { it.progress }
                            .take(2)
                            .forEach { addDamage(damageByEnemyId, it.id, (projectile.damage * 0.70f).toInt().coerceAtLeast(1)) }
                    }

                    WeaponType.EXPLOSIVE -> {
                        addDamage(damageByEnemyId, target.id, projectile.damage)
                        enemies.asSequence()
                            .filter {
                                it.id != target.id &&
                                    ColumnCombatRules.canAttack(sourceColumn, it) &&
                                    abs(it.progress - target.progress) <= 0.14f
                            }
                            .forEach { addDamage(damageByEnemyId, it.id, (projectile.damage * 0.60f).toInt().coerceAtLeast(1)) }
                    }

                    WeaponType.LASER -> {
                        enemies.asSequence()
                            .filter { ColumnCombatRules.canAttack(sourceColumn, it) }
                            .forEach { addDamage(damageByEnemyId, it.id, projectile.damage) }
                    }
                }
            }

            val survivors = mutableListOf<Enemy>()
            for (enemy in enemies) {
                val damage = damageByEnemyId[enemy.id] ?: 0
                if (damage <= 0) {
                    survivors += enemy
                    continue
                }
                val nextHp = enemy.hp - damage
                if (nextHp <= 0f) {
                    score += enemy.maxHp.toInt()
                    if (enemy.enemyType == EnemyType.BOSS) {
                        eventLog = appendLog(
                            eventLog,
                            elapsedSeconds,
                            "BOSS撃破  SCORE +${enemy.maxHp.toInt()}",
                            BattleLogTone.GOOD,
                        )
                    }
                } else {
                    survivors += enemy.copy(hp = nextHp)
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
            elapsedSeconds = elapsedSeconds,
            eventLog = eventLog,
            hpDamageFlash = hpDamageFlash,
            columns = buildColumnStates(state.board, cooldowns),
        )
        return state
    }

    private fun newGameState(): GameSnapshot {
        val maxHp = FormationRules.maxHp(formation)
        val board = GameRules.initialBoard(random)
        val cooldowns = List(GameRules.CELL_COUNT) { 0f }
        return GameSnapshot(
            board = board,
            formation = formation,
            score = 0,
            currentHp = maxHp,
            maxHp = maxHp,
            wave = 1,
            enemies = emptyList(),
            projectiles = emptyList(),
            cooldowns = cooldowns,
            bossWarning = null,
            gameOverReason = null,
            mergeBurst = 0,
            elapsedSeconds = 0f,
            eventLog = listOf(BattleLogEntry(0f, "防衛開始  WAVE 1", BattleLogTone.INFO)),
            hpDamageFlash = null,
            columns = buildColumnStates(board, cooldowns),
        )
    }

    private fun buildColumnStates(board: List<Int>, cooldowns: List<Float>): List<ColumnCombatState> =
        (0 until GameRules.GRID_SIZE).map { column ->
            val level = ColumnCombatRules.columnLevel(board, column)
            ColumnCombatState(
                column = column,
                power = ColumnCombatRules.columnPower(board, column),
                level = level,
                weaponType = ColumnCombatRules.weaponType(level),
                cooldownRemainingSeconds = cooldowns.getOrElse(column) { 0f },
            )
        }

    private fun addDamage(target: MutableMap<Int, Int>, enemyId: Int, damage: Int) {
        target[enemyId] = (target[enemyId] ?: 0) + damage
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

    private fun appendLog(
        current: List<BattleLogEntry>,
        timestampSeconds: Float,
        message: String,
        tone: BattleLogTone,
    ): List<BattleLogEntry> = (current + BattleLogEntry(timestampSeconds, message, tone)).takeLast(MAX_LOG_ENTRIES)
}
