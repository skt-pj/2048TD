package com.sktpj.td2048

import kotlin.math.floor

internal object FormationRules {
    val rowAttackMultiplier = listOf(1.35f, 1.15f, 1.00f, 0.85f)
    val rowHpMultiplier = listOf(0.75f, 0.95f, 1.15f, 1.40f)

    fun maxHp(formation: List<CharacterDefinition>): Int {
        require(formation.size == GameRules.CELL_COUNT)
        return formation.indices.sumOf { index ->
            floor(formation[index].baseHp * rowHpMultiplier[GameRules.rowOf(index)]).toInt()
        }
    }
}

internal object DamageCalculator {
    const val AFFINITY_STRONG = 1.50f
    const val AFFINITY_NEUTRAL = 1.00f
    const val AFFINITY_WEAK = 0.75f
    private const val BOSS_BONUS_MULTIPLIER = 1.35f

    fun affinity(attacker: HandType, defender: HandType): Float = when {
        attacker == defender -> AFFINITY_NEUTRAL
        attacker == HandType.ROCK && defender == HandType.SCISSORS -> AFFINITY_STRONG
        attacker == HandType.SCISSORS && defender == HandType.PAPER -> AFFINITY_STRONG
        attacker == HandType.PAPER && defender == HandType.ROCK -> AFFINITY_STRONG
        else -> AFFINITY_WEAK
    }

    fun damage(
        tileValue: Int,
        character: CharacterDefinition,
        row: Int,
        enemy: Enemy,
    ): Int {
        require(row in 0 until GameRules.GRID_SIZE)
        if (tileValue <= 0) return 0
        val abilityMultiplier = if (
            character.ability == CharacterAbility.BOSS_BONUS && enemy.enemyType == EnemyType.BOSS
        ) BOSS_BONUS_MULTIPLIER else 1f
        val raw = tileValue * character.attackCoefficient *
            FormationRules.rowAttackMultiplier[row] * affinity(character.handType, enemy.handType) *
            abilityMultiplier
        return floor(raw).toInt().coerceAtLeast(1)
    }
}

internal object TargetingPolicy {
    const val BOSS_LANE = -1

    fun canAttack(cellIndex: Int, enemy: Enemy): Boolean {
        val col = GameRules.colOf(cellIndex)
        return when (enemy.enemyType) {
            EnemyType.NORMAL -> enemy.lane == col
            EnemyType.BOSS -> col == 1 || col == 2
        }
    }

    fun selectTarget(cellIndex: Int, enemies: List<Enemy>): Enemy? = enemies
        .asSequence()
        .filter { canAttack(cellIndex, it) }
        .minWithOrNull(
            compareBy<Enemy> { remainingTime(it) }
                .thenBy { if (it.enemyType == EnemyType.BOSS) 0 else 1 }
                .thenBy { it.id },
        )

    private fun remainingTime(enemy: Enemy): Float {
        val effectiveSpeed = if (enemy.slowRemainingSeconds > 0f) enemy.speed * 0.65f else enemy.speed
        return (1f - enemy.progress).coerceAtLeast(0f) / effectiveSpeed.coerceAtLeast(0.0001f)
    }
}

internal object StarterRoster {
    val characters: List<CharacterDefinition> = listOf(
        CharacterDefinition("r1", "紅蓮", HandType.ROCK, 96, 1.10f, 950, CharacterAbility.BOSS_BONUS, level = 40),
        CharacterDefinition("s1", "蒼刃", HandType.SCISSORS, 102, 1.05f, 900, level = 35),
        CharacterDefinition("p1", "翠風", HandType.PAPER, 104, 1.00f, 900, CharacterAbility.SLOW, level = 30),
        CharacterDefinition("r2", "火槍", HandType.ROCK, 98, 1.08f, 1000, level = 25),
        CharacterDefinition("s2", "氷刃", HandType.SCISSORS, 108, 0.96f, 850, CharacterAbility.SLOW, level = 45),
        CharacterDefinition("p2", "森弓", HandType.PAPER, 112, 1.00f, 950, level = 38),
        CharacterDefinition("r3", "赤盾", HandType.ROCK, 126, 0.90f, 1050, level = 50),
        CharacterDefinition("s3", "青槍", HandType.SCISSORS, 110, 1.04f, 950, level = 42),
        CharacterDefinition("p3", "緑術", HandType.PAPER, 106, 1.08f, 1050, CharacterAbility.BOSS_BONUS, level = 46),
        CharacterDefinition("r4", "焔騎", HandType.ROCK, 118, 0.98f, 900, level = 44),
        CharacterDefinition("s4", "迅影", HandType.SCISSORS, 100, 1.12f, 850, level = 52),
        CharacterDefinition("p4", "樹守", HandType.PAPER, 130, 0.88f, 1100, CharacterAbility.SLOW, level = 48),
        CharacterDefinition("r5", "烈牙", HandType.ROCK, 116, 1.02f, 900, level = 41),
        CharacterDefinition("s5", "月鋏", HandType.SCISSORS, 114, 1.00f, 900, CharacterAbility.BOSS_BONUS, level = 39),
        CharacterDefinition("p5", "葉雨", HandType.PAPER, 120, 0.96f, 850, level = 43),
        CharacterDefinition("r6", "岩拳", HandType.ROCK, 138, 0.86f, 1100, level = 55),
    )
}
