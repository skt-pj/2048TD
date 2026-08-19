from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


game_path = Path("app/src/main/java/com/sktpj/td2048/GameScreen.kt")
game = game_path.read_text(encoding="utf-8")
game = replace_once(
    game,
    """                    MainGameScreen(\n                        snapshot = snapshot,\n                        paused = paused,\n                        settings = settings,\n""",
    """                    MainGameScreen(\n                        snapshot = snapshot,\n                        paused = paused,\n                        settings = settings,\n                        feverActive = comboFeverSnapshot.feverActive,\n""",
    "pass FEVER state to main game screen",
)
game_path.write_text(game, encoding="utf-8")


main_path = Path("app/src/main/java/com/sktpj/td2048/MainGameScreen.kt")
main = main_path.read_text(encoding="utf-8")

main = replace_once(
    main,
    """internal fun MainGameScreen(\n    snapshot: GameSnapshot,\n    paused: Boolean,\n    settings: GameSettings,\n    onSettingsChange: (GameSettings) -> Unit,\n""",
    """internal fun MainGameScreen(\n    snapshot: GameSnapshot,\n    paused: Boolean,\n    settings: GameSettings,\n    feverActive: Boolean,\n    onSettingsChange: (GameSettings) -> Unit,\n""",
    "main screen FEVER argument",
)

main = replace_once(
    main,
    """            Battlefield(\n                snapshot = snapshot,\n                simpleEffects = settings.simpleEffects,\n                modifier = Modifier\n""",
    """            Battlefield(\n                snapshot = snapshot,\n                simpleEffects = settings.simpleEffects,\n                feverActive = feverActive,\n                modifier = Modifier\n""",
    "battlefield FEVER argument",
)

main = replace_once(
    main,
    """private fun Battlefield(\n    snapshot: GameSnapshot,\n    simpleEffects: Boolean,\n    modifier: Modifier = Modifier,\n) {\n""",
    """private fun Battlefield(\n    snapshot: GameSnapshot,\n    simpleEffects: Boolean,\n    feverActive: Boolean,\n    modifier: Modifier = Modifier,\n) {\n""",
    "battlefield signature",
)

main = replace_once(
    main,
    """    Box(\n        modifier = modifier\n            .background(NeonPanel, RoundedCornerShape(14.dp))\n            .border(1.5.dp, NeonCyan.copy(alpha = 0.58f), RoundedCornerShape(14.dp)),\n    ) {\n""",
    """    Box(\n        modifier = modifier\n            .background(\n                if (feverActive) Color(0xFF100619) else NeonPanel,\n                RoundedCornerShape(14.dp),\n            )\n            .border(\n                width = if (feverActive) 2.5.dp else 1.5.dp,\n                color = if (feverActive) {\n                    NeonPink.copy(alpha = if (simpleEffects) 0.82f else 0.62f + 0.34f * pulse)\n                } else {\n                    NeonCyan.copy(alpha = 0.58f)\n                },\n                shape = RoundedCornerShape(14.dp),\n            ),\n    ) {\n""",
    "persistent FEVER battlefield shell",
)

main = replace_once(
    main,
    """                snapshot = snapshot,\n                bossPulse = if (simpleEffects) 0.62f else pulse,\n                effectPhase = if (simpleEffects) 0f else effectPhase,\n                simpleEffects = simpleEffects,\n""",
    """                snapshot = snapshot,\n                bossPulse = if (simpleEffects) 0.62f else pulse,\n                effectPhase = if (simpleEffects) 0f else effectPhase,\n                feverActive = feverActive,\n                feverPulse = if (simpleEffects) 0.78f else pulse,\n                simpleEffects = simpleEffects,\n""",
    "draw battlefield FEVER arguments",
)

main = replace_once(
    main,
    """        BattleParticleVfxLayer(\n            snapshot = snapshot,\n            simpleEffects = simpleEffects,\n            modifier = Modifier.fillMaxSize(),\n        )\n""",
    """        BattleParticleVfxLayer(\n            snapshot = snapshot,\n            simpleEffects = simpleEffects,\n            feverActive = feverActive,\n            modifier = Modifier.fillMaxSize(),\n        )\n""",
    "FEVER particle amplification",
)

main = replace_once(
    main,
    """private fun DrawScope.drawBattlefield(\n    snapshot: GameSnapshot,\n    bossPulse: Float,\n    effectPhase: Float,\n    simpleEffects: Boolean,\n) {\n""",
    """private fun DrawScope.drawBattlefield(\n    snapshot: GameSnapshot,\n    bossPulse: Float,\n    effectPhase: Float,\n    feverActive: Boolean,\n    feverPulse: Float,\n    simpleEffects: Boolean,\n) {\n""",
    "draw battlefield signature",
)

main = replace_once(
    main,
    """        drawRect(\n            color = if (lane % 2 == 0) Color(0xFF05090D) else Color(0xFF03070A),\n            topLeft = Offset(left, 0f),\n            size = Size(laneWidth, size.height),\n        )\n""",
    """        drawRect(\n            color = if (feverActive) {\n                if (lane % 2 == 0) Color(0xFF100718) else Color(0xFF07101A)\n            } else {\n                if (lane % 2 == 0) Color(0xFF05090D) else Color(0xFF03070A)\n            },\n            topLeft = Offset(left, 0f),\n            size = Size(laneWidth, size.height),\n        )\n""",
    "FEVER lane background",
)

main = replace_once(
    main,
    """        drawVectorLaneFlow(\n            laneLeft = left,\n            laneWidth = laneWidth,\n            height = size.height,\n            phase = effectPhase,\n            color = NeonCyan,\n            simpleEffects = simpleEffects,\n        )\n""",
    """        drawVectorLaneFlow(\n            laneLeft = left,\n            laneWidth = laneWidth,\n            height = size.height,\n            phase = effectPhase,\n            color = if (feverActive && lane % 2 == 0) NeonPink else NeonCyan,\n            simpleEffects = simpleEffects,\n        )\n""",
    "FEVER lane flow color",
)

main = replace_once(
    main,
    """    for (lane in 1 until 4) {\n        val x = lane * laneWidth\n        if (!simpleEffects) {\n            drawLine(NeonCyan.copy(alpha = 0.10f), Offset(x, 0f), Offset(x, size.height), 8f)\n        }\n        drawLine(NeonCyan.copy(alpha = 0.40f), Offset(x, 0f), Offset(x, size.height), 1.5f)\n    }\n""",
    """    for (lane in 1 until 4) {\n        val x = lane * laneWidth\n        val laneEnergyColor = if (feverActive && lane % 2 == 1) NeonPink else NeonCyan\n        if (!simpleEffects) {\n            drawLine(\n                laneEnergyColor.copy(alpha = if (feverActive) 0.16f + 0.10f * feverPulse else 0.10f),\n                Offset(x, 0f),\n                Offset(x, size.height),\n                if (feverActive) 11f else 8f,\n            )\n        }\n        drawLine(\n            laneEnergyColor.copy(alpha = if (feverActive) 0.56f + 0.28f * feverPulse else 0.40f),\n            Offset(x, 0f),\n            Offset(x, size.height),\n            if (feverActive) 2.2f else 1.5f,\n        )\n    }\n""",
    "FEVER lane separators",
)

main = replace_once(
    main,
    """        }\n    }\n\n    snapshot.vfxEvents.forEach { event ->\n""",
    """        }\n        if (feverActive) {\n            // Every shot gains a shared white/pink energy core during FEVER so the mode is visible\n            // through normal combat motion, not only through the HUD.\n            drawCircle(\n                color = Color.White.copy(alpha = 0.56f + 0.30f * feverPulse),\n                radius = 2.3f + 1.4f * feverPulse,\n                center = center,\n            )\n            if (!simpleEffects) {\n                drawCircle(\n                    color = NeonPink.copy(alpha = 0.10f + 0.10f * feverPulse),\n                    radius = 10f + 5f * feverPulse,\n                    center = center,\n                )\n            }\n        }\n    }\n\n    snapshot.vfxEvents.forEach { event ->\n""",
    "FEVER projectile energy core",
)

main = replace_once(
    main,
    """    drawVectorEnergyBoundary(\n        y = defenseY,\n        color = NeonCyan,\n        phase = effectPhase,\n        simpleEffects = simpleEffects,\n    )\n""",
    """    drawVectorEnergyBoundary(\n        y = defenseY,\n        color = if (feverActive) NeonPink else NeonCyan,\n        phase = effectPhase,\n        simpleEffects = simpleEffects,\n    )\n""",
    "FEVER defense boundary",
)

main = replace_once(
    main,
    """        drawArc(\n            color = color.copy(alpha = 0.86f),\n            startAngle = -90f,\n            sweepAngle = 360f * readyRatio,\n            useCenter = false,\n            topLeft = Offset(x - 16f, y - 16f),\n            size = Size(32f, 32f),\n            style = Stroke(width = if (simpleEffects) 1.8f else 2.6f),\n        )\n        if (!simpleEffects) {\n""",
    """        drawArc(\n            color = color.copy(alpha = 0.86f),\n            startAngle = -90f,\n            sweepAngle = 360f * readyRatio,\n            useCenter = false,\n            topLeft = Offset(x - 16f, y - 16f),\n            size = Size(32f, 32f),\n            style = Stroke(width = if (simpleEffects) 1.8f else 2.6f),\n        )\n        if (feverActive) {\n            drawArc(\n                color = NeonPink.copy(alpha = 0.48f + 0.34f * feverPulse),\n                startAngle = -90f + 120f * effectPhase,\n                sweepAngle = if (simpleEffects) 110f else 170f,\n                useCenter = false,\n                topLeft = Offset(x - 20f, y - 20f),\n                size = Size(40f, 40f),\n                style = Stroke(width = if (simpleEffects) 1.8f else 3.2f),\n            )\n        }\n        if (!simpleEffects) {\n""",
    "FEVER turret halo",
)

main_path.write_text(main, encoding="utf-8")
print("Applied persistent FEVER battlefield presentation")
