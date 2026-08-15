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

    private fun enemy(
        type: EnemyType = EnemyType.NORMAL,
        lane: Int = 0,
    ) = Enemy(
        id = 1,
        enemyType = type,
        lane = lane,
        progress = 0.5f,
        speed = 0.1f,
        hp = 100f,
        maxHp = 100f,
        handType = HandType.ROCK,
    )
}
