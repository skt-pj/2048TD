package com.sktpj.td2048

enum class Direction { UP, DOWN, LEFT, RIGHT }

enum class HandType { ROCK, SCISSORS, PAPER }

enum class EnemyType { NORMAL, BOSS }

enum class CharacterAbility { NONE, BOSS_BONUS, SLOW }

enum class GameOverReason { BOARD_STUCK, HP_ZERO }

enum class BattleLogTone { INFO, GOOD, WARNING }

enum class WeaponType {
    NORMAL,
    RAPID,
    MACHINE_GUN,
    PIERCING,
    EXPLOSIVE,
    LASER,
}

data class CharacterDefinition(
    val characterId: String,
    val name: String,
    val handType: HandType,
    val baseHp: Int,
    val attackCoefficient: Float,
    val attackIntervalMs: Int,
    val ability: CharacterAbility = CharacterAbility.NONE,
    val level: Int = 1,
)

data class Enemy(
    val id: Int,
    val enemyType: EnemyType,
    val lane: Int,
    val progress: Float,
    val speed: Float,
    val hp: Float,
    val maxHp: Float,
    val handType: HandType,
    val slowRemainingSeconds: Float = 0f,
)

data class Projectile(
    val id: Int,
    val sourceCellIndex: Int,
    val sourceCharacterId: String,
    val targetEnemyId: Int,
    val damage: Int,
    val x: Float,
    val y: Float,
    val speed: Float,
    val handType: HandType,
    val onHitAbility: CharacterAbility,
    val weaponType: WeaponType = WeaponType.NORMAL,
)

data class ColumnCombatState(
    val column: Int,
    val power: Int,
    val level: Int,
    val weaponType: WeaponType,
    val cooldownRemainingSeconds: Float,
)

data class BossWarning(
    val remainingSeconds: Float,
    val handType: HandType,
)

data class BattleLogEntry(
    val timestampSeconds: Float,
    val message: String,
    val tone: BattleLogTone = BattleLogTone.INFO,
)

data class HpDamageFlash(
    val amount: Int,
    val remainingSeconds: Float,
)

data class GameSnapshot(
    val board: List<Int>,
    val formation: List<CharacterDefinition>,
    val score: Int,
    val currentHp: Int,
    val maxHp: Int,
    val wave: Int,
    val enemies: List<Enemy>,
    val projectiles: List<Projectile>,
    val cooldowns: List<Float>,
    val bossWarning: BossWarning?,
    val gameOverReason: GameOverReason?,
    val mergeBurst: Int,
    val elapsedSeconds: Float = 0f,
    val eventLog: List<BattleLogEntry> = emptyList(),
    val hpDamageFlash: HpDamageFlash? = null,
    val columns: List<ColumnCombatState> = emptyList(),
)
