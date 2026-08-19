from pathlib import Path

path = Path("app/src/main/java/com/sktpj/td2048/MainGameScreen.kt")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    "import androidx.compose.animation.core.FastOutSlowInEasing\n",
    "import androidx.compose.animation.core.FastOutSlowInEasing\nimport androidx.compose.animation.core.LinearEasing\n",
    "LinearEasing import",
)

replace_once(
    """    val pulse by pulseTransition.animateFloat(\n        initialValue = 0.42f,\n        targetValue = 1f,\n        animationSpec = infiniteRepeatable(\n            animation = tween(durationMillis = 720, easing = FastOutSlowInEasing),\n            repeatMode = RepeatMode.Reverse,\n        ),\n        label = \"boss-neon-alpha\",\n    )\n\n    Box(\n""",
    """    val pulse by pulseTransition.animateFloat(\n        initialValue = 0.42f,\n        targetValue = 1f,\n        animationSpec = infiniteRepeatable(\n            animation = tween(durationMillis = 720, easing = FastOutSlowInEasing),\n            repeatMode = RepeatMode.Reverse,\n        ),\n        label = \"boss-neon-alpha\",\n    )\n    val effectPhase by pulseTransition.animateFloat(\n        initialValue = 0f,\n        targetValue = 1f,\n        animationSpec = infiniteRepeatable(\n            animation = tween(durationMillis = 900, easing = LinearEasing),\n        ),\n        label = \"battle-vector-phase\",\n    )\n\n    Box(\n""",
    "battle vector phase",
)

replace_once(
    """                bossPulse = if (simpleEffects) 0.62f else pulse,\n                simpleEffects = simpleEffects,\n""",
    """                bossPulse = if (simpleEffects) 0.62f else pulse,\n                effectPhase = if (simpleEffects) 0f else effectPhase,\n                simpleEffects = simpleEffects,\n""",
    "drawBattlefield effect phase argument",
)

replace_once(
    """private fun DrawScope.drawBattlefield(\n    snapshot: GameSnapshot,\n    bossPulse: Float,\n    simpleEffects: Boolean,\n) {\n""",
    """private fun DrawScope.drawBattlefield(\n    snapshot: GameSnapshot,\n    bossPulse: Float,\n    effectPhase: Float,\n    simpleEffects: Boolean,\n) {\n""",
    "drawBattlefield signature",
)

replace_once(
    """        drawTextNative(\"${lane + 1}\", left + laneWidth / 2f, 18f, NeonMuted, 15f)\n    }\n""",
    """        drawTextNative(\"${lane + 1}\", left + laneWidth / 2f, 18f, NeonMuted, 15f)\n        drawVectorLaneFlow(\n            laneLeft = left,\n            laneWidth = laneWidth,\n            height = size.height,\n            phase = effectPhase,\n            color = NeonCyan,\n            simpleEffects = simpleEffects,\n        )\n    }\n""",
    "lane vector flow",
)

replace_once(
    """        val color = if (enemy.enemyType == EnemyType.BOSS) NeonPink else NeonRed\n        if (!simpleEffects) {\n""",
    """        val color = if (enemy.enemyType == EnemyType.BOSS) NeonPink else NeonRed\n        drawVectorRadialGlow(\n            center = center,\n            radius = radius * if (enemy.enemyType == EnemyType.BOSS) 2.6f else 2.0f,\n            color = color,\n            simpleEffects = simpleEffects,\n        )\n        if (enemy.enemyType == EnemyType.BOSS) {\n            drawVectorReticle(\n                center = center,\n                color = NeonPink,\n                radius = radius * 1.58f,\n                phase = effectPhase,\n                simpleEffects = simpleEffects,\n            )\n        }\n        if (!simpleEffects) {\n""",
    "enemy vector glow",
)

old_projectiles = """        when (projectile.weaponType) {\n            WeaponType.NORMAL -> {\n                if (!simpleEffects) drawCircle(color.copy(alpha = 0.18f), 10f, center)\n                drawCircle(color, 4.5f, center)\n                drawCircle(Color.White.copy(alpha = 0.78f), 1.6f, center)\n            }\n            WeaponType.RAPID -> {\n                if (!simpleEffects) drawCircle(color.copy(alpha = 0.18f), 8f, center)\n                drawCircle(color, 3.8f, center)\n            }\n            WeaponType.MACHINE_GUN -> {\n                if (!simpleEffects) {\n                    drawLine(color.copy(alpha = 0.18f), Offset(center.x, center.y + 15f), center, 8f)\n                }\n                drawLine(color.copy(alpha = 0.72f), Offset(center.x, center.y + 12f), center, 3f)\n                drawCircle(color, 3.2f, center)\n            }\n            WeaponType.PIERCING -> {\n                if (!simpleEffects) {\n                    drawLine(color.copy(alpha = 0.16f), Offset(center.x, center.y + 18f), Offset(center.x, center.y - 8f), 12f)\n                }\n                drawLine(color, Offset(center.x, center.y + 14f), Offset(center.x, center.y - 6f), 4.5f)\n            }\n            WeaponType.EXPLOSIVE -> {\n                if (!simpleEffects) drawCircle(color.copy(alpha = 0.10f), 17f, center)\n                drawCircle(color.copy(alpha = 0.24f), 11f, center)\n                drawCircle(color, 6f, center)\n                drawCircle(NeonText.copy(alpha = 0.82f), 2f, center)\n            }\n            WeaponType.LASER -> {\n                if (!simpleEffects) {\n                    drawLine(color.copy(alpha = 0.10f), source, center, 20f)\n                    drawLine(color.copy(alpha = 0.22f), source, center, 11f)\n                }\n                drawLine(color, source, center, 4f)\n                drawLine(Color.White.copy(alpha = 0.84f), source, center, 1.4f)\n            }\n        }\n"""

new_projectiles = """        when (projectile.weaponType) {\n            WeaponType.NORMAL -> {\n                drawVectorGlowLine(\n                    start = Offset(center.x, center.y + 13f),\n                    end = center,\n                    color = color,\n                    coreWidth = 2.2f,\n                    simpleEffects = simpleEffects,\n                )\n                drawVectorDiamond(center, 5.2f, color, simpleEffects)\n            }\n            WeaponType.RAPID -> {\n                drawVectorGlowLine(\n                    start = Offset(center.x, center.y + 20f),\n                    end = center,\n                    color = color,\n                    coreWidth = 2.0f,\n                    simpleEffects = simpleEffects,\n                )\n                if (!simpleEffects) {\n                    drawLine(color.copy(alpha = 0.42f), Offset(center.x - 6f, center.y + 15f), Offset(center.x - 3f, center.y + 3f), 1.4f)\n                    drawLine(color.copy(alpha = 0.42f), Offset(center.x + 6f, center.y + 15f), Offset(center.x + 3f, center.y + 3f), 1.4f)\n                }\n                drawCircle(color, 3.8f, center)\n                drawCircle(Color.White.copy(alpha = 0.84f), 1.3f, center)\n            }\n            WeaponType.MACHINE_GUN -> {\n                drawVectorGlowLine(\n                    start = Offset(center.x, center.y + 27f),\n                    end = center,\n                    color = color,\n                    coreWidth = 2.8f,\n                    simpleEffects = simpleEffects,\n                )\n                drawVectorSparkBurst(center, color, 8f, effectPhase, simpleEffects)\n            }\n            WeaponType.PIERCING -> {\n                drawVectorGlowLine(\n                    start = Offset(center.x, center.y + 31f),\n                    end = Offset(center.x, center.y - 9f),\n                    color = color,\n                    coreWidth = 3.6f,\n                    simpleEffects = simpleEffects,\n                )\n                drawVectorDiamond(center, 7f, color, simpleEffects)\n            }\n            WeaponType.EXPLOSIVE -> {\n                drawVectorRadialGlow(center, 24f, color, simpleEffects)\n                drawVectorSparkBurst(center, color, 16f, effectPhase, simpleEffects)\n                drawCircle(color, 6.2f, center)\n                drawCircle(NeonText.copy(alpha = 0.92f), 2.2f, center)\n            }\n            WeaponType.LASER -> {\n                drawVectorGlowLine(\n                    start = source,\n                    end = center,\n                    color = color,\n                    coreWidth = 4.4f,\n                    simpleEffects = simpleEffects,\n                )\n                drawVectorReticle(center, color, 11f, effectPhase, simpleEffects)\n            }\n        }\n"""
replace_once(old_projectiles, new_projectiles, "projectile vector effects")

replace_once(
    """    val defenseY = size.height - 12f\n    if (!simpleEffects) {\n        drawLine(NeonCyan.copy(alpha = 0.10f), Offset(0f, defenseY), Offset(size.width, defenseY), 16f)\n    }\n    drawLine(NeonCyan.copy(alpha = 0.28f), Offset(0f, defenseY), Offset(size.width, defenseY), 8f)\n    drawLine(NeonCyan, Offset(0f, defenseY), Offset(size.width, defenseY), 2.5f)\n\n""",
    """    val defenseY = size.height - 12f\n    drawVectorEnergyBoundary(\n        y = defenseY,\n        color = NeonCyan,\n        phase = effectPhase,\n        simpleEffects = simpleEffects,\n    )\n\n""",
    "defense vector boundary",
)

replace_once(
    """        val state = snapshot.columns.getOrNull(column)\n        val color = weaponColor(state?.weaponType ?: WeaponType.NORMAL)\n        if (!simpleEffects) {\n""",
    """        val state = snapshot.columns.getOrNull(column)\n        val color = weaponColor(state?.weaponType ?: WeaponType.NORMAL)\n        val interval = ColumnCombatRules.fireIntervalSeconds(state?.weaponType ?: WeaponType.NORMAL)\n        val cooldown = state?.cooldownRemainingSeconds ?: 0f\n        val readyRatio = if (interval <= 0f) 1f else (1f - cooldown / interval).coerceIn(0f, 1f)\n        drawArc(\n            color = color.copy(alpha = 0.86f),\n            startAngle = -90f,\n            sweepAngle = 360f * readyRatio,\n            useCenter = false,\n            topLeft = Offset(x - 16f, y - 16f),\n            size = Size(32f, 32f),\n            style = Stroke(width = if (simpleEffects) 1.8f else 2.6f),\n        )\n        if (!simpleEffects) {\n""",
    "turret charge arcs",
)

replace_once(
    """                if (value > 0) {\n                    drawRoundRect(\n                        color = accent.copy(alpha = if (simpleEffects) 0.10f else 0.20f),\n                        cornerRadius = CornerRadius(cornerRadius, cornerRadius),\n                        style = Stroke(width = glowWidth),\n                    )\n                }\n""",
    """                if (value > 0) {\n                    drawRoundRect(\n                        color = accent.copy(alpha = if (simpleEffects) 0.10f else 0.20f),\n                        cornerRadius = CornerRadius(cornerRadius, cornerRadius),\n                        style = Stroke(width = glowWidth),\n                    )\n                    if (mergePulse) {\n                        drawVectorRadialGlow(\n                            center = Offset(size.width / 2f, size.height / 2f),\n                            radius = min(size.width, size.height) * 0.58f,\n                            color = accent,\n                            simpleEffects = simpleEffects,\n                        )\n                    }\n                }\n""",
    "tile merge radial glow",
)

path.write_text(text, encoding="utf-8")
print("Applied vector effect MainGameScreen patch")
