package com.sktpj.td2048

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FeverProjectileTargetingTest {
    @Test
    fun feverProjectileDoesNotRetargetWhenOriginalTargetIsGone() {
        val projectile = projectile(targetEnemyId = 1, ignoresLaneRestriction = true)
        val nextEnemy = enemy(id = 2, lane = 3)

        assertNull(selectProjectileTarget(projectile, listOf(nextEnemy)))
    }

    @Test
    fun normalProjectileKeepsExistingRetargetBehaviorWithinLane() {
        val projectile = projectile(targetEnemyId = 1, ignoresLaneRestriction = false)
        val nextEnemy = enemy(id = 2, lane = 0)

        assertEquals(2, selectProjectileTarget(projectile, listOf(nextEnemy))?.id)
    }

    @Test
    fun feverProjectileKeepsFollowingItsOriginalCrossLaneTarget() {
        val projectile = projectile(targetEnemyId = 1, ignoresLaneRestriction = true)
        val originalTarget = enemy(id = 1, lane = 3)
        val otherEnemy = enemy(id = 2, lane = 0)

        assertEquals(1, selectProjectileTarget(projectile, listOf(otherEnemy, originalTarget))?.id)
    }

    private fun projectile(targetEnemyId: Int, ignoresLaneRestriction: Boolean) = Projectile(
        id = 10,
        sourceCellIndex = 0,
        sourceCharacterId = "column-0",
        targetEnemyId = targetEnemyId,
        damage = 8,
        x = 0.125f,
        y = 0.955f,
        speed = 1.45f,
        handType = HandType.ROCK,
        onHitAbility = CharacterAbility.NONE,
        weaponType = WeaponType.NORMAL,
        ignoresLaneRestriction = ignoresLaneRestriction,
    )

    private fun enemy(id: Int, lane: Int) = Enemy(
        id = id,
        enemyType = EnemyType.NORMAL,
        lane = lane,
        progress = 0.4f,
        speed = 0.1f,
        hp = 20f,
        maxHp = 20f,
        handType = HandType.ROCK,
    )
}
