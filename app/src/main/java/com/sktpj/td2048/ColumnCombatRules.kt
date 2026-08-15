package com.sktpj.td2048

import kotlin.math.max

internal object ColumnCombatRules {
    fun tileLevel(tileValue: Int): Int {
        if (tileValue < 2) return 0
        var value = tileValue
        var level = 0
        while (value > 1) {
            value /= 2
            level += 1
        }
        return level
    }

    fun columnPower(board: List<Int>, column: Int): Int {
        require(column in 0 until GameRules.GRID_SIZE)
        require(board.size == GameRules.CELL_COUNT)
        return (0 until GameRules.GRID_SIZE).sumOf { row ->
            board[GameRules.cellIndex(row, column)]
        }
    }

    fun columnLevel(board: List<Int>, column: Int): Int {
        require(column in 0 until GameRules.GRID_SIZE)
        require(board.size == GameRules.CELL_COUNT)
        return (0 until GameRules.GRID_SIZE).sumOf { row ->
            tileLevel(board[GameRules.cellIndex(row, column)])
        }
    }

    fun weaponType(level: Int): WeaponType = when {
        level >= 31 -> WeaponType.LASER
        level >= 25 -> WeaponType.EXPLOSIVE
        level >= 19 -> WeaponType.PIERCING
        level >= 13 -> WeaponType.MACHINE_GUN
        level >= 7 -> WeaponType.RAPID
        else -> WeaponType.NORMAL
    }

    fun fireIntervalSeconds(weaponType: WeaponType): Float = when (weaponType) {
        WeaponType.NORMAL -> 0.90f
        WeaponType.RAPID -> 0.62f
        WeaponType.MACHINE_GUN -> 0.24f
        WeaponType.PIERCING -> 0.72f
        WeaponType.EXPLOSIVE -> 0.95f
        WeaponType.LASER -> 0.78f
    }

    fun projectileSpeed(weaponType: WeaponType): Float = when (weaponType) {
        WeaponType.NORMAL -> 1.45f
        WeaponType.RAPID -> 1.70f
        WeaponType.MACHINE_GUN -> 2.20f
        WeaponType.PIERCING -> 1.85f
        WeaponType.EXPLOSIVE -> 1.35f
        WeaponType.LASER -> 4.00f
    }

    fun canAttack(column: Int, enemy: Enemy): Boolean {
        require(column in 0 until GameRules.GRID_SIZE)
        return when (enemy.enemyType) {
            EnemyType.NORMAL -> enemy.lane == column
            EnemyType.BOSS -> column == 1 || column == 2
        }
    }

    fun selectTarget(column: Int, enemies: List<Enemy>): Enemy? = enemies
        .asSequence()
        .filter { canAttack(column, it) }
        .minWithOrNull(
            compareBy<Enemy> { remainingTime(it) }
                .thenBy { if (it.enemyType == EnemyType.BOSS) 0 else 1 }
                .thenBy { it.id },
        )

    private fun remainingTime(enemy: Enemy): Float {
        val speed = enemy.speed.coerceAtLeast(0.0001f)
        return max(0f, 1f - enemy.progress) / speed
    }
}
