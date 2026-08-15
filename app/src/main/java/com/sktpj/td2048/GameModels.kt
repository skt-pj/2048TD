package com.sktpj.td2048

enum class Direction { UP, DOWN, LEFT, RIGHT }

enum class HandType { ROCK, SCISSORS, PAPER }

enum class EnemyType { NORMAL, BOSS }

enum class CharacterAbility { NONE, BOSS_BONUS, SLOW }

enum class GameOverReason { BOARD_STUCK, HP_ZERO }

data class CharacterDefinition(
    val characterId: String,
    val name: String,
    val handType: HandType,
    val baseHp: Int,
    val attackCoefficient: Float,
    val attackIntervalMs: Int,
    val ability: CharacterAbility = CharacterAbility.NONE,
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
)

data class BossWarning(
    val remainingSeconds: Float,
    val handType: HandType,
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
)
