package com.sktpj.td2048

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CombatRulesTest {
    private val character = CharacterDefinition(
        characterId = "test",
        name = "test",
        handType = HandType.ROCK,
        baseHp = 100,
        attackCoefficient = 1f,
        attackIntervalMs = 1000,
    )

    @Test
    fun normalEnemy_canOnlyBeAttackedFromSameColumn() {
        val enemy = enemy(lane = 0)
        assertTrue(TargetingPolicy.canAttack(GameRules.cellIndex(0, 0), enemy))
        assertFalse(TargetingPolicy.canAttack(GameRules.cellIndex(0, 1), enemy))
    }

    @Test
    fun boss_canOnlyBeAttackedFromMiddleColumns() {
        val boss = enemy(type = EnemyType.BOSS, lane = TargetingPolicy.BOSS_LANE)
        assertFalse(TargetingPolicy.canAttack(GameRules.cellIndex(0, 0), boss))
        assertTrue(TargetingPolicy.canAttack(GameRules.cellIndex(0, 1), boss))
        assertTrue(TargetingPolicy.canAttack(GameRules.cellIndex(0, 2), boss))
        assertFalse(TargetingPolicy.canAttack(GameRules.cellIndex(0, 3), boss))
    }

    @Test
    fun rowAttackMultiplier_decreasesFromTopToBottom() {
        val target = enemy(hand = HandType.SCISSORS)
        val damages = (0..3).map { row -> DamageCalculator.damage(100, character, row, target) }
        assertTrue(damages[0] > damages[1])
        assertTrue(damages[1] > damages[2])
        assertTrue(damages[2] > damages[3])
    }

    @Test
    fun rowHpMultiplier_increasesTowardBottom() {
        val hp = FormationRules.rowHpMultiplier
        assertTrue(hp[3] > hp[2])
        assertTrue(hp[2] > hp[1])
        assertTrue(hp[1] > hp[0])
    }

    @Test
    fun affinity_usesRockScissorsPaper() {
        assertEquals(1.50f, DamageCalculator.affinity(HandType.ROCK, HandType.SCISSORS))
        assertEquals(1.00f, DamageCalculator.affinity(HandType.ROCK, HandType.ROCK))
        assertEquals(0.75f, DamageCalculator.affinity(HandType.ROCK, HandType.PAPER))
    }

    @Test
    fun targetPriority_usesShortestRemainingTime() {
        val farFast = enemy(id = 1, progress = 0.2f, speed = 0.4f)
        val nearSlow = enemy(id = 2, progress = 0.8f, speed = 0.2f)
        val selected = TargetingPolicy.selectTarget(GameRules.cellIndex(0, 0), listOf(farFast, nearSlow))
        assertEquals(2, selected?.id)
    }

    @Test
    fun nodePosition_matchesBoardColumnAndRow() {
        val topLeft = GameEngine.nodePosition(GameRules.cellIndex(0, 0))
        val bottomRight = GameEngine.nodePosition(GameRules.cellIndex(3, 3))
        assertTrue(topLeft.first < bottomRight.first)
        assertTrue(topLeft.second < bottomRight.second)
    }

    private fun enemy(
        id: Int = 1,
        type: EnemyType = EnemyType.NORMAL,
        lane: Int = 0,
        progress: Float = 0.5f,
        speed: Float = 0.1f,
        hand: HandType = HandType.ROCK,
    ) = Enemy(
        id = id,
        enemyType = type,
        lane = lane,
        progress = progress,
        speed = speed,
        hp = 100f,
        maxHp = 100f,
        handType = hand,
    )
}
