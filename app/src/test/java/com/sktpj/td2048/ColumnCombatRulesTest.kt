package com.sktpj.td2048

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ColumnCombatRulesTest {
    @Test
    fun tileLevel_uses2048Exponent() {
        assertEquals(0, ColumnCombatRules.tileLevel(0))
        assertEquals(1, ColumnCombatRules.tileLevel(2))
        assertEquals(2, ColumnCombatRules.tileLevel(4))
        assertEquals(10, ColumnCombatRules.tileLevel(1024))
    }

    @Test
    fun columnPower_isRawSumOfFourTiles() {
        val board = listOf(
            2, 0, 0, 0,
            4, 0, 0, 0,
            8, 0, 0, 0,
            16, 0, 0, 0,
        )
        assertEquals(30, ColumnCombatRules.columnPower(board, 0))
        assertEquals(10, ColumnCombatRules.columnLevel(board, 0))
    }

    @Test
    fun weaponProgression_usesColumnLevel() {
        assertEquals(WeaponType.NORMAL, ColumnCombatRules.weaponType(6))
        assertEquals(WeaponType.RAPID, ColumnCombatRules.weaponType(7))
        assertEquals(WeaponType.MACHINE_GUN, ColumnCombatRules.weaponType(13))
        assertEquals(WeaponType.PIERCING, ColumnCombatRules.weaponType(19))
        assertEquals(WeaponType.EXPLOSIVE, ColumnCombatRules.weaponType(25))
        assertEquals(WeaponType.LASER, ColumnCombatRules.weaponType(31))
    }

    @Test
    fun normalLane_andBossTargetRulesStayColumnBased() {
        val lane0 = enemy(lane = 0)
        val boss = enemy(type = EnemyType.BOSS, lane = TargetingPolicy.BOSS_LANE)
        assertTrue(ColumnCombatRules.canAttack(0, lane0))
        assertFalse(ColumnCombatRules.canAttack(1, lane0))
        assertFalse(ColumnCombatRules.canAttack(0, boss))
        assertTrue(ColumnCombatRules.canAttack(1, boss))
        assertTrue(ColumnCombatRules.canAttack(2, boss))
        assertFalse(ColumnCombatRules.canAttack(3, boss))
    }

    @Test
    fun feverTargeting_ignoresNormalLaneAndBossColumnRestrictions() {
        val lane3 = enemy(id = 1, lane = 3)
        val boss = enemy(id = 2, type = EnemyType.BOSS, lane = TargetingPolicy.BOSS_LANE)
        assertTrue(ColumnCombatRules.canAttack(0, lane3, ignoreLaneRestriction = true))
        assertTrue(ColumnCombatRules.canAttack(3, boss, ignoreLaneRestriction = true))
    }

    @Test
    fun feverTargeting_canSelectMostUrgentEnemyAcrossAllLanes() {
        val local = enemy(id = 1, lane = 0, progress = 0.20f)
        val urgentOtherLane = enemy(id = 2, lane = 3, progress = 0.90f)

        assertEquals(
            local.id,
            ColumnCombatRules.selectTarget(0, listOf(local, urgentOtherLane))?.id,
        )
        assertEquals(
            urgentOtherLane.id,
            ColumnCombatRules.selectTarget(
                column = 0,
                enemies = listOf(local, urgentOtherLane),
                ignoreLaneRestriction = true,
            )?.id,
        )
    }

    private fun enemy(
        id: Int = 1,
        type: EnemyType = EnemyType.NORMAL,
        lane: Int = 0,
        progress: Float = 0.5f,
        speed: Float = 0.1f,
    ) = Enemy(
        id = id,
        enemyType = type,
        lane = lane,
        progress = progress,
        speed = speed,
        hp = 100f,
        maxHp = 100f,
        handType = HandType.ROCK,
    )
}
