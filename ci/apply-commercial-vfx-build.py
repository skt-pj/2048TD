from pathlib import Path


def patch_file(path_name: str, operations):
    path = Path(path_name)
    text = path.read_text(encoding="utf-8")
    for old, new, label in operations:
        count = text.count(old)
        if count != 1:
            raise RuntimeError(f"{path_name} / {label}: expected 1 match, found {count}")
        text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")


patch_file(
    "app/src/main/java/com/sktpj/td2048/GameModels.kt",
    [
        (
            """enum class WeaponType {\n    NORMAL,\n    RAPID,\n    MACHINE_GUN,\n    PIERCING,\n    EXPLOSIVE,\n    LASER,\n}\n\n""",
            """enum class WeaponType {\n    NORMAL,\n    RAPID,\n    MACHINE_GUN,\n    PIERCING,\n    EXPLOSIVE,\n    LASER,\n}\n\nenum class VfxEventType { HIT, KILL, BOSS_KILL }\n\ndata class VfxEvent(\n    val id: Int,\n    val type: VfxEventType,\n    val x: Float,\n    val y: Float,\n    val damage: Int,\n    val weaponType: WeaponType,\n    val createdAtSeconds: Float,\n)\n\n""",
            "VFX event models",
        ),
        (
            """    val hpDamageFlash: HpDamageFlash? = null,\n    val columns: List<ColumnCombatState> = emptyList(),\n)\n""",
            """    val hpDamageFlash: HpDamageFlash? = null,\n    val columns: List<ColumnCombatState> = emptyList(),\n    val mergePeak: Int = 0,\n    val vfxEvents: List<VfxEvent> = emptyList(),\n)\n""",
            "GameSnapshot VFX fields",
        ),
    ],
)

patch_file(
    "app/src/main/java/com/sktpj/td2048/GameEngine.kt",
    [
        (
            """    private var enemyId = 1\n    private var projectileId = 1\n""",
            """    private var enemyId = 1\n    private var projectileId = 1\n    private var vfxEventId = 1\n""",
            "VFX id counter",
        ),
        (
            """        enemyId = 1\n        projectileId = 1\n        spawnTimer = 0f\n""",
            """        enemyId = 1\n        projectileId = 1\n        vfxEventId = 1\n        spawnTimer = 0f\n""",
            "reset VFX id",
        ),
        (
            """            score = state.score + result.createdValues.sum(),\n            mergeBurst = result.createdValues.sum(),\n            gameOverReason = gameOverReason,\n""",
            """            score = state.score + result.createdValues.sum(),\n            mergeBurst = result.createdValues.sum(),\n            mergePeak = result.createdValues.maxOrNull() ?: 0,\n            gameOverReason = gameOverReason,\n""",
            "merge peak",
        ),
        (
            """    fun clearMergeBurst(): GameSnapshot {\n        if (state.mergeBurst == 0) return state\n        state = state.copy(mergeBurst = 0)\n        return state\n    }\n""",
            """    fun clearMergeBurst(): GameSnapshot {\n        if (state.mergeBurst == 0 && state.mergePeak == 0) return state\n        state = state.copy(mergeBurst = 0, mergePeak = 0)\n        return state\n    }\n""",
            "clear merge peak",
        ),
        (
            """        val delta = deltaSeconds.coerceIn(0f, 0.05f)\n        val elapsedSeconds = state.elapsedSeconds + delta\n\n        var wave = state.wave\n""",
            """        val delta = deltaSeconds.coerceIn(0f, 0.05f)\n        val elapsedSeconds = state.elapsedSeconds + delta\n        var vfxEvents = state.vfxEvents.filter { elapsedSeconds - it.createdAtSeconds <= 0.90f }\n\n        var wave = state.wave\n""",
            "expire VFX events",
        ),
        (
            """                val nextHp = enemy.hp - damage\n                if (nextHp <= 0f) {\n                    score += enemy.maxHp.toInt()\n""",
            """                val nextHp = enemy.hp - damage\n                val impactWeapon = hits.firstOrNull { it.targetEnemyId == enemy.id }?.weaponType\n                    ?: hits.firstOrNull { it.weaponType == WeaponType.EXPLOSIVE }?.weaponType\n                    ?: hits.firstOrNull { it.weaponType == WeaponType.LASER }?.weaponType\n                    ?: hits.firstOrNull { it.weaponType == WeaponType.PIERCING }?.weaponType\n                    ?: WeaponType.NORMAL\n                val effectType = when {\n                    nextHp > 0f -> VfxEventType.HIT\n                    enemy.enemyType == EnemyType.BOSS -> VfxEventType.BOSS_KILL\n                    else -> VfxEventType.KILL\n                }\n                vfxEvents = (vfxEvents + VfxEvent(\n                    id = vfxEventId++,\n                    type = effectType,\n                    x = enemyX(enemy),\n                    y = enemy.progress,\n                    damage = damage,\n                    weaponType = impactWeapon,\n                    createdAtSeconds = elapsedSeconds,\n                )).takeLast(48)\n                if (nextHp <= 0f) {\n                    score += enemy.maxHp.toInt()\n""",
            "create hit and kill VFX events",
        ),
        (
            """            eventLog = eventLog,\n            hpDamageFlash = hpDamageFlash,\n            columns = buildColumnStates(state.board, cooldowns),\n""",
            """            eventLog = eventLog,\n            hpDamageFlash = hpDamageFlash,\n            columns = buildColumnStates(state.board, cooldowns),\n            vfxEvents = vfxEvents,\n""",
            "persist VFX events",
        ),
    ],
)

patch_file(
    "app/src/main/java/com/sktpj/td2048/MainGameScreen.kt",
    [
        (
            """import android.graphics.Paint\nimport android.graphics.Typeface\n""",
            """import android.graphics.Paint\nimport android.graphics.Typeface\nimport android.view.HapticFeedbackConstants\n""",
            "haptic import",
        ),
        (
            """import androidx.compose.ui.draw.drawBehind\n""",
            """import androidx.compose.ui.draw.drawBehind\nimport androidx.compose.ui.draw.drawWithContent\n""",
            "drawWithContent import",
        ),
        (
            """import androidx.compose.ui.platform.LocalDensity\n""",
            """import androidx.compose.ui.platform.LocalDensity\nimport androidx.compose.ui.platform.LocalView\n""",
            "LocalView import",
        ),
        (
            """internal fun MainGameScreen(\n    snapshot: GameSnapshot,\n    paused: Boolean,\n    settings: GameSettings,\n    onSettingsChange: (GameSettings) -> Unit,\n    onMove: (Direction) -> Unit,\n    onReset: () -> Unit,\n    onPause: () -> Unit,\n    onQuit: () -> Unit,\n) {\n    BoxWithConstraints(\n""",
            """internal fun MainGameScreen(\n    snapshot: GameSnapshot,\n    paused: Boolean,\n    settings: GameSettings,\n    onSettingsChange: (GameSettings) -> Unit,\n    onMove: (Direction) -> Unit,\n    onReset: () -> Unit,\n    onPause: () -> Unit,\n    onQuit: () -> Unit,\n) {\n    val view = LocalView.current\n    var lastHapticEventId by remember { mutableIntStateOf(0) }\n    val cameraShake = commercialCameraShake(snapshot.elapsedSeconds, snapshot.vfxEvents, settings.simpleEffects)\n\n    LaunchedEffect(snapshot.mergePeak) {\n        if (snapshot.mergePeak > 0) {\n            view.performHapticFeedback(\n                if (snapshot.mergePeak >= 128) HapticFeedbackConstants.LONG_PRESS else HapticFeedbackConstants.VIRTUAL_KEY,\n            )\n        }\n    }\n    LaunchedEffect(snapshot.vfxEvents) {\n        val bossKill = snapshot.vfxEvents.lastOrNull { it.type == VfxEventType.BOSS_KILL }\n        if (bossKill != null && bossKill.id > lastHapticEventId) {\n            lastHapticEventId = bossKill.id\n            view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)\n        }\n    }\n\n    BoxWithConstraints(\n""",
            "commercial feedback state",
        ),
        (
            """                modifier = Modifier\n                    .fillMaxWidth()\n                    .weight(0.46f),\n""",
            """                modifier = Modifier\n                    .fillMaxWidth()\n                    .weight(0.46f)\n                    .graphicsLayer {\n                        translationX = cameraShake.x\n                        translationY = cameraShake.y\n                    },\n""",
            "battlefield camera shake",
        ),
        (
            """        when (projectile.weaponType) {\n            WeaponType.NORMAL -> {\n                drawVectorGlowLine(\n                    start = Offset(center.x, center.y + 13f),\n                    end = center,\n                    color = color,\n                    coreWidth = 2.2f,\n                    simpleEffects = simpleEffects,\n                )\n""",
            """        when (projectile.weaponType) {\n            WeaponType.NORMAL -> {\n                drawCommercialProjectileTrail(source, center, projectile.weaponType, simpleEffects)\n""",
            "normal directional trail",
        ),
        (
            """            WeaponType.RAPID -> {\n                drawVectorGlowLine(\n                    start = Offset(center.x, center.y + 20f),\n                    end = center,\n                    color = color,\n                    coreWidth = 2.0f,\n                    simpleEffects = simpleEffects,\n                )\n""",
            """            WeaponType.RAPID -> {\n                drawCommercialProjectileTrail(source, center, projectile.weaponType, simpleEffects)\n""",
            "rapid directional trail",
        ),
        (
            """            WeaponType.MACHINE_GUN -> {\n                drawVectorGlowLine(\n                    start = Offset(center.x, center.y + 27f),\n                    end = center,\n                    color = color,\n                    coreWidth = 2.8f,\n                    simpleEffects = simpleEffects,\n                )\n""",
            """            WeaponType.MACHINE_GUN -> {\n                drawCommercialProjectileTrail(source, center, projectile.weaponType, simpleEffects)\n""",
            "machine gun directional trail",
        ),
        (
            """            WeaponType.PIERCING -> {\n                drawVectorGlowLine(\n                    start = Offset(center.x, center.y + 31f),\n                    end = Offset(center.x, center.y - 9f),\n                    color = color,\n                    coreWidth = 3.6f,\n                    simpleEffects = simpleEffects,\n                )\n""",
            """            WeaponType.PIERCING -> {\n                drawCommercialProjectileTrail(source, center, projectile.weaponType, simpleEffects)\n""",
            "piercing directional trail",
        ),
        (
            """            WeaponType.EXPLOSIVE -> {\n                drawVectorRadialGlow(center, 24f, color, simpleEffects)\n""",
            """            WeaponType.EXPLOSIVE -> {\n                drawCommercialProjectileTrail(source, center, projectile.weaponType, simpleEffects)\n                drawVectorRadialGlow(center, 24f, color, simpleEffects)\n""",
            "explosive directional trail",
        ),
        (
            """        }\n    }\n\n    val defenseY = size.height - 12f\n""",
            """        }\n    }\n\n    snapshot.vfxEvents.forEach { event ->\n        drawCommercialImpactEvent(\n            event = event,\n            elapsedSeconds = snapshot.elapsedSeconds,\n            simpleEffects = simpleEffects,\n        )\n    }\n\n    val defenseY = size.height - 12f\n""",
            "event-driven impact rendering",
        ),
        (
            """    var previousBoard by remember { mutableStateOf(snapshot.board) }\n    var lastDirection by remember { mutableStateOf<Direction?>(null) }\n    var moveEpoch by remember { mutableIntStateOf(0) }\n\n""",
            """    var previousBoard by remember { mutableStateOf(snapshot.board) }\n    var lastDirection by remember { mutableStateOf<Direction?>(null) }\n    var moveEpoch by remember { mutableIntStateOf(0) }\n    var effectMergeValue by remember { mutableIntStateOf(0) }\n    val mergeAccentProgress = remember { Animatable(1f) }\n\n""",
            "merge VFX state",
        ),
        (
            """    LaunchedEffect(moveEpoch) {\n        if (moveEpoch > 0) {\n            delay(220)\n            lastDirection = null\n        }\n    }\n\n""",
            """    LaunchedEffect(moveEpoch) {\n        if (moveEpoch > 0) {\n            delay(220)\n            lastDirection = null\n        }\n    }\n    LaunchedEffect(snapshot.mergePeak) {\n        if (snapshot.mergePeak > 0) {\n            effectMergeValue = snapshot.mergePeak\n            mergeAccentProgress.snapTo(0f)\n            mergeAccentProgress.animateTo(\n                1f,\n                animationSpec = tween(\n                    durationMillis = if (simpleEffects) 220 else 360,\n                    easing = FastOutSlowInEasing,\n                ),\n            )\n            effectMergeValue = 0\n        }\n    }\n\n""",
            "merge accent animation",
        ),
        (
            """                    .border(1.dp, NeonGrid.copy(alpha = 0.72f), RoundedCornerShape(10.dp))\n                    .padding(4.dp)\n                    .pointerInput(Unit) {\n""",
            """                    .border(1.dp, NeonGrid.copy(alpha = 0.72f), RoundedCornerShape(10.dp))\n                    .padding(4.dp)\n                    .drawWithContent {\n                        drawContent()\n                        if (effectMergeValue > 0) {\n                            drawCommercialMergeAccent(\n                                mergeValue = effectMergeValue,\n                                progress = mergeAccentProgress.value,\n                                simpleEffects = simpleEffects,\n                            )\n                        }\n                    }\n                    .pointerInput(Unit) {\n""",
            "board merge accent overlay",
        ),
        (
            """                                mergePulse = snapshot.mergeBurst > 0,\n""",
            """                                mergePulse = snapshot.mergePeak > 0 && value == snapshot.mergePeak,\n""",
            "localize tile merge pulse",
        ),
    ],
)

print("Applied commercial event-driven VFX integration")
