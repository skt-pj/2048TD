package com.sktpj.td2048

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

private val NeonBackground = Color(0xFF020406)
private val NeonPanel = Color(0xFF060A0F)
private val NeonPanelRaised = Color(0xFF0A1017)
private val NeonGrid = Color(0xFF17303A)
private val NeonCyan = Color(0xFF00F5FF)
private val NeonBlue = Color(0xFF4D7CFF)
private val NeonViolet = Color(0xFFAA62FF)
private val NeonPink = Color(0xFFFF35D3)
private val NeonLime = Color(0xFF63FF8C)
private val NeonAmber = Color(0xFFFFB020)
private val NeonOrange = Color(0xFFFF7A18)
private val NeonRed = Color(0xFFFF3B58)
private val NeonText = Color(0xFFF4FBFF)
private val NeonMuted = Color(0xFFA4B7C2)

@Composable
internal fun MainGameScreen(
    snapshot: GameSnapshot,
    paused: Boolean,
    settings: GameSettings,
    onSettingsChange: (GameSettings) -> Unit,
    onMove: (Direction) -> Unit,
    onReset: () -> Unit,
    onPause: () -> Unit,
    onQuit: () -> Unit,
) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(NeonBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 8.dp, vertical = 6.dp),
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            GameStatusBar(snapshot = snapshot, onPause = onPause)
            Battlefield(
                snapshot = snapshot,
                simpleEffects = settings.simpleEffects,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.46f),
            )
            TotalHpStrip(snapshot)
            ColumnWeaponStrip(snapshot)
            SimpleGameBoard(
                snapshot = snapshot,
                onMove = onMove,
                simpleEffects = settings.simpleEffects,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.42f),
            )
        }

        if (paused) {
            PauseOverlay(
                onResume = onPause,
                onReset = onReset,
                onQuit = onQuit,
            )
        }
        snapshot.gameOverReason?.let { reason ->
            GameOverOverlay(
                reason = reason,
                score = snapshot.score,
                maxTile = snapshot.board.maxOrNull() ?: 0,
                onReset = onReset,
                onQuit = onQuit,
            )
        }
    }
}

@Composable
private fun GameStatusBar(snapshot: GameSnapshot, onPause: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .background(NeonPanel, RoundedCornerShape(12.dp))
            .border(1.dp, NeonCyan.copy(alpha = 0.62f), RoundedCornerShape(12.dp))
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Text("2048TD", color = NeonCyan, fontWeight = FontWeight.Black, fontSize = 12.sp)
        HeaderHp(snapshot, Modifier.weight(1.5f))
        StatusCell("WAVE", snapshot.wave.toString(), Modifier.weight(0.62f))
        StatusCell("SCORE", snapshot.score.toString(), Modifier.weight(0.82f))
        Button(
            onClick = onPause,
            modifier = Modifier.size(38.dp),
            contentPadding = PaddingValues(0.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = NeonPanelRaised,
                contentColor = NeonCyan,
            ),
        ) {
            Text("Ⅱ", fontSize = 16.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun HeaderHp(snapshot: GameSnapshot, modifier: Modifier = Modifier) {
    val ratio = if (snapshot.maxHp <= 0) 0f else snapshot.currentHp.toFloat() / snapshot.maxHp
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("HP", color = NeonMuted, fontSize = 7.sp)
            Text("${snapshot.currentHp}/${snapshot.maxHp}", color = NeonText, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .background(Color(0xFF101820), RoundedCornerShape(4.dp)),
        ) {
            val hpColor = if (ratio < 0.25f) NeonRed else NeonLime
            Box(
                modifier = Modifier
                    .fillMaxWidth(ratio.coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .background(hpColor.copy(alpha = 0.30f), RoundedCornerShape(4.dp)),
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth(ratio.coerceIn(0f, 1f))
                    .height(3.dp)
                    .align(Alignment.CenterStart)
                    .background(hpColor, RoundedCornerShape(4.dp)),
            )
        }
    }
}

@Composable
private fun StatusCell(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(NeonPanelRaised, RoundedCornerShape(8.dp))
            .border(1.dp, NeonCyan.copy(alpha = 0.24f), RoundedCornerShape(8.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(label, color = NeonMuted, fontSize = 6.sp)
        Text(value, color = NeonText, fontSize = 11.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun Battlefield(
    snapshot: GameSnapshot,
    simpleEffects: Boolean,
    modifier: Modifier = Modifier,
) {
    val pulseTransition = rememberInfiniteTransition(label = "boss-neon-pulse")
    val pulse by pulseTransition.animateFloat(
        initialValue = 0.42f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 720, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "boss-neon-alpha",
    )

    Box(
        modifier = modifier
            .background(NeonPanel, RoundedCornerShape(14.dp))
            .border(1.5.dp, NeonCyan.copy(alpha = 0.58f), RoundedCornerShape(14.dp)),
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawBattlefield(
                snapshot = snapshot,
                bossPulse = if (simpleEffects) 0.62f else pulse,
                simpleEffects = simpleEffects,
            )
        }

        snapshot.bossWarning?.let { warning ->
            Text(
                text = "BOSS  ${ceil(warning.remainingSeconds).toInt()}s",
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 7.dp)
                    .background(Color(0xE20A0610), RoundedCornerShape(8.dp))
                    .border(1.dp, NeonPink.copy(alpha = if (simpleEffects) 0.72f else pulse), RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                color = NeonPink,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
            )
        }
        Text(
            "敵進行 ↓",
            modifier = Modifier.align(Alignment.TopStart).padding(7.dp),
            color = NeonMuted,
            fontSize = 8.sp,
        )
        Text(
            "DEFENSE LINE",
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 4.dp)
                .background(Color(0xE005090D), RoundedCornerShape(5.dp))
                .padding(horizontal = 6.dp, vertical = 2.dp),
            color = NeonCyan,
            fontSize = 7.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

private fun DrawScope.drawBattlefield(
    snapshot: GameSnapshot,
    bossPulse: Float,
    simpleEffects: Boolean,
) {
    val laneWidth = size.width / 4f
    for (lane in 0 until 4) {
        val left = lane * laneWidth
        drawRect(
            color = if (lane % 2 == 0) Color(0xFF05090D) else Color(0xFF03070A),
            topLeft = Offset(left, 0f),
            size = Size(laneWidth, size.height),
        )
        drawTextNative("${lane + 1}", left + laneWidth / 2f, 18f, NeonMuted, 15f)
    }
    for (lane in 1 until 4) {
        val x = lane * laneWidth
        if (!simpleEffects) {
            drawLine(NeonCyan.copy(alpha = 0.10f), Offset(x, 0f), Offset(x, size.height), 8f)
        }
        drawLine(NeonCyan.copy(alpha = 0.40f), Offset(x, 0f), Offset(x, size.height), 1.5f)
    }

    val bossX = size.width / 2f
    val warningActive = snapshot.bossWarning != null
    val bossAlpha = if (warningActive) 0.12f + 0.12f * bossPulse else 0.045f
    drawRect(
        NeonPink.copy(alpha = bossAlpha),
        Offset(bossX - 9f, 0f),
        Size(18f, size.height),
    )
    if (!simpleEffects) {
        drawLine(
            NeonPink.copy(alpha = if (warningActive) 0.18f + 0.18f * bossPulse else 0.08f),
            Offset(bossX, 0f),
            Offset(bossX, size.height),
            if (warningActive) 12f else 7f,
        )
    }
    drawLine(
        NeonPink.copy(alpha = if (warningActive) 0.72f + 0.28f * bossPulse else 0.50f),
        Offset(bossX, 0f),
        Offset(bossX, size.height),
        if (warningActive) 3.2f else 1.8f,
    )
    drawTextNative("BOSS", bossX, 35f, NeonPink, 14f)

    snapshot.enemies.forEach { enemy ->
        val center = Offset(size.width * GameEngine.enemyX(enemy), size.height * enemy.progress)
        val radius = if (enemy.enemyType == EnemyType.BOSS) {
            min(size.width, size.height) * 0.060f
        } else {
            min(size.width, size.height) * 0.032f
        }
        val color = if (enemy.enemyType == EnemyType.BOSS) NeonPink else NeonRed
        if (!simpleEffects) {
            drawCircle(color.copy(alpha = 0.09f), radius * 1.80f, center)
            drawCircle(color.copy(alpha = 0.18f), radius * 1.42f, center)
        }
        drawCircle(color.copy(alpha = 0.28f), radius * 1.18f, center)
        drawCircle(color, radius, center)
        drawCircle(Color.White.copy(alpha = 0.72f), radius * 0.32f, center)

        val hpRatio = (enemy.hp / enemy.maxHp).coerceIn(0f, 1f)
        val barWidth = radius * 2.4f
        val top = center.y - radius - 10f
        drawRect(Color(0xFF101820), Offset(center.x - barWidth / 2f, top), Size(barWidth, 5f))
        if (!simpleEffects) {
            drawRect(NeonLime.copy(alpha = 0.22f), Offset(center.x - barWidth / 2f, top - 1f), Size(barWidth * hpRatio, 7f))
        }
        drawRect(NeonLime, Offset(center.x - barWidth / 2f, top), Size(barWidth * hpRatio, 5f))
        drawTextNative(
            enemy.hp.toInt().coerceAtLeast(0).toString(),
            center.x,
            top - 4f,
            NeonText,
            if (enemy.enemyType == EnemyType.BOSS) 17f else 13f,
        )
    }

    snapshot.projectiles.forEach { projectile ->
        val center = Offset(size.width * projectile.x, size.height * projectile.y)
        val sourceColumn = projectile.sourceCellIndex.coerceIn(0, 3)
        val (sx, sy) = GameEngine.turretPosition(sourceColumn)
        val source = Offset(size.width * sx, size.height * sy)
        val color = weaponColor(projectile.weaponType)
        when (projectile.weaponType) {
            WeaponType.NORMAL -> {
                if (!simpleEffects) drawCircle(color.copy(alpha = 0.18f), 10f, center)
                drawCircle(color, 4.5f, center)
                drawCircle(Color.White.copy(alpha = 0.78f), 1.6f, center)
            }
            WeaponType.RAPID -> {
                if (!simpleEffects) drawCircle(color.copy(alpha = 0.18f), 8f, center)
                drawCircle(color, 3.8f, center)
            }
            WeaponType.MACHINE_GUN -> {
                if (!simpleEffects) {
                    drawLine(color.copy(alpha = 0.18f), Offset(center.x, center.y + 15f), center, 8f)
                }
                drawLine(color.copy(alpha = 0.72f), Offset(center.x, center.y + 12f), center, 3f)
                drawCircle(color, 3.2f, center)
            }
            WeaponType.PIERCING -> {
                if (!simpleEffects) {
                    drawLine(color.copy(alpha = 0.16f), Offset(center.x, center.y + 18f), Offset(center.x, center.y - 8f), 12f)
                }
                drawLine(color, Offset(center.x, center.y + 14f), Offset(center.x, center.y - 6f), 4.5f)
            }
            WeaponType.EXPLOSIVE -> {
                if (!simpleEffects) drawCircle(color.copy(alpha = 0.10f), 17f, center)
                drawCircle(color.copy(alpha = 0.24f), 11f, center)
                drawCircle(color, 6f, center)
                drawCircle(NeonText.copy(alpha = 0.82f), 2f, center)
            }
            WeaponType.LASER -> {
                if (!simpleEffects) {
                    drawLine(color.copy(alpha = 0.10f), source, center, 20f)
                    drawLine(color.copy(alpha = 0.22f), source, center, 11f)
                }
                drawLine(color, source, center, 4f)
                drawLine(Color.White.copy(alpha = 0.84f), source, center, 1.4f)
            }
        }
    }

    val defenseY = size.height - 12f
    if (!simpleEffects) {
        drawLine(NeonCyan.copy(alpha = 0.10f), Offset(0f, defenseY), Offset(size.width, defenseY), 16f)
    }
    drawLine(NeonCyan.copy(alpha = 0.28f), Offset(0f, defenseY), Offset(size.width, defenseY), 8f)
    drawLine(NeonCyan, Offset(0f, defenseY), Offset(size.width, defenseY), 2.5f)

    for (column in 0 until 4) {
        val x = (column + 0.5f) * laneWidth
        val y = defenseY - 2f
        val state = snapshot.columns.getOrNull(column)
        val color = weaponColor(state?.weaponType ?: WeaponType.NORMAL)
        if (!simpleEffects) {
            drawCircle(color.copy(alpha = 0.10f), 19f, Offset(x, y))
            drawLine(color.copy(alpha = 0.12f), Offset(x, y - 4f), Offset(x, y - 22f), 12f)
        }
        drawCircle(NeonBackground, 13f, Offset(x, y))
        drawCircle(color.copy(alpha = 0.24f), 12f, Offset(x, y))
        drawCircle(color, 8f, Offset(x, y))
        drawCircle(Color.White.copy(alpha = 0.72f), 2.4f, Offset(x, y))
        drawLine(color, Offset(x, y - 4f), Offset(x, y - 18f), 5f)
    }
}

private fun DrawScope.drawTextNative(text: String, x: Float, y: Float, color: Color, textSize: Float) {
    drawContext.canvas.nativeCanvas.drawText(
        text,
        x,
        y,
        Paint().apply {
            this.color = color.toArgb()
            this.textSize = textSize
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
            isAntiAlias = true
        },
    )
}

@Composable
private fun TotalHpStrip(snapshot: GameSnapshot) {
    val ratio = if (snapshot.maxHp <= 0) 0f else snapshot.currentHp.toFloat() / snapshot.maxHp
    val hpColor = if (ratio < 0.25f) NeonRed else NeonLime
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(31.dp)
            .background(NeonPanel, RoundedCornerShape(9.dp))
            .border(1.dp, NeonCyan.copy(alpha = 0.32f), RoundedCornerShape(9.dp))
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("TOTAL HP", color = NeonMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        Box(
            modifier = Modifier
                .weight(1f)
                .height(9.dp)
                .background(Color(0xFF101820), RoundedCornerShape(5.dp)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(ratio.coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .background(hpColor.copy(alpha = 0.28f), RoundedCornerShape(5.dp)),
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth(ratio.coerceIn(0f, 1f))
                    .height(3.dp)
                    .align(Alignment.CenterStart)
                    .background(hpColor, RoundedCornerShape(5.dp)),
            )
        }
        Text("${snapshot.currentHp}/${snapshot.maxHp}", color = NeonText, fontSize = 8.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun ColumnWeaponStrip(snapshot: GameSnapshot) {
    val columns = if (snapshot.columns.size == 4) snapshot.columns else {
        (0 until 4).map { col ->
            val level = ColumnCombatRules.columnLevel(snapshot.board, col)
            ColumnCombatState(
                column = col,
                power = ColumnCombatRules.columnPower(snapshot.board, col),
                level = level,
                weaponType = ColumnCombatRules.weaponType(level),
                cooldownRemainingSeconds = 0f,
            )
        }
    }
    Row(
        modifier = Modifier.fillMaxWidth().height(54.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        columns.forEach { state ->
            val color = weaponColor(state.weaponType)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .background(NeonPanel, RoundedCornerShape(9.dp))
                    .border(1.dp, color.copy(alpha = 0.72f), RoundedCornerShape(9.dp))
                    .padding(vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("LV ${state.level}", color = color, fontSize = 8.sp, fontWeight = FontWeight.Black)
                Text(weaponLabel(state.weaponType), color = NeonText, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Text("ATK ${state.power}", color = NeonMuted, fontSize = 7.sp)
            }
        }
    }
}

@Composable
private fun SimpleGameBoard(
    snapshot: GameSnapshot,
    onMove: (Direction) -> Unit,
    simpleEffects: Boolean,
    modifier: Modifier = Modifier,
) {
    var dragX by remember { mutableFloatStateOf(0f) }
    var dragY by remember { mutableFloatStateOf(0f) }
    var previousBoard by remember { mutableStateOf(snapshot.board) }
    var lastDirection by remember { mutableStateOf<Direction?>(null) }
    var moveEpoch by remember { mutableIntStateOf(0) }

    LaunchedEffect(snapshot.board) {
        if (snapshot.board != previousBoard) {
            previousBoard = snapshot.board
            moveEpoch += 1
        }
    }
    LaunchedEffect(moveEpoch) {
        if (moveEpoch > 0) {
            delay(220)
            lastDirection = null
        }
    }

    Card(
        modifier = modifier.border(1.5.dp, NeonCyan.copy(alpha = 0.62f), RoundedCornerShape(14.dp)),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = NeonPanel),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("2048", color = NeonCyan, fontSize = 12.sp, fontWeight = FontWeight.Black)
                Text(
                    if (snapshot.mergeBurst > 0) "MERGE +${snapshot.mergeBurst}" else "列を育てて武器進化",
                    color = if (snapshot.mergeBurst > 0) NeonPink else NeonMuted,
                    fontSize = 9.sp,
                    fontWeight = if (snapshot.mergeBurst > 0) FontWeight.Bold else FontWeight.Normal,
                )
            }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .background(NeonBackground, RoundedCornerShape(10.dp))
                    .border(1.dp, NeonGrid.copy(alpha = 0.72f), RoundedCornerShape(10.dp))
                    .padding(4.dp)
                    .pointerInput(Unit) {
                        detectDragGestures(
                            onDragStart = {
                                dragX = 0f
                                dragY = 0f
                            },
                            onDrag = { change, amount ->
                                change.consume()
                                dragX += amount.x
                                dragY += amount.y
                            },
                            onDragEnd = {
                                if (max(abs(dragX), abs(dragY)) >= 24f) {
                                    val direction = if (abs(dragX) > abs(dragY)) {
                                        if (dragX > 0) Direction.RIGHT else Direction.LEFT
                                    } else {
                                        if (dragY > 0) Direction.DOWN else Direction.UP
                                    }
                                    lastDirection = direction
                                    onMove(direction)
                                }
                                dragX = 0f
                                dragY = 0f
                            },
                            onDragCancel = {
                                dragX = 0f
                                dragY = 0f
                            },
                        )
                    },
                verticalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                repeat(4) { row ->
                    Row(
                        modifier = Modifier.fillMaxWidth().weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                    ) {
                        repeat(4) { col ->
                            val value = snapshot.board[GameRules.cellIndex(row, col)]
                            SimpleTile(
                                value = value,
                                moveEpoch = moveEpoch,
                                direction = lastDirection,
                                mergePulse = snapshot.mergeBurst > 0,
                                simpleEffects = simpleEffects,
                                modifier = Modifier.weight(1f).fillMaxHeight(),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SimpleTile(
    value: Int,
    moveEpoch: Int,
    direction: Direction?,
    mergePulse: Boolean,
    simpleEffects: Boolean,
    modifier: Modifier = Modifier,
) {
    val offsetProgress = remember { Animatable(0f) }
    val scale = remember { Animatable(1f) }
    val density = LocalDensity.current
    val travelPx = with(density) { 26.dp.toPx() }
    val accent = neonTileAccent(value)

    LaunchedEffect(moveEpoch, value, direction) {
        if (moveEpoch <= 0 || value <= 0) {
            offsetProgress.snapTo(0f)
            scale.snapTo(1f)
            return@LaunchedEffect
        }
        offsetProgress.snapTo(1f)
        scale.snapTo(if (mergePulse) 1.09f else 0.96f)
        coroutineScope {
            launch {
                offsetProgress.animateTo(
                    targetValue = 0f,
                    animationSpec = tween(durationMillis = 165, easing = FastOutSlowInEasing),
                )
            }
            launch {
                scale.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(durationMillis = 185, easing = FastOutSlowInEasing),
                )
            }
        }
    }

    val directionX = when (direction) {
        Direction.RIGHT -> -1f
        Direction.LEFT -> 1f
        else -> 0f
    }
    val directionY = when (direction) {
        Direction.DOWN -> -1f
        Direction.UP -> 1f
        else -> 0f
    }
    val glowWidth = with(density) { if (simpleEffects) 2.dp.toPx() else 5.dp.toPx() }
    val cornerRadius = with(density) { 10.dp.toPx() }

    Box(
        modifier = modifier
            .graphicsLayer {
                translationX = directionX * travelPx * offsetProgress.value
                translationY = directionY * travelPx * offsetProgress.value
                scaleX = scale.value
                scaleY = scale.value
            }
            .drawBehind {
                if (value > 0) {
                    drawRoundRect(
                        color = accent.copy(alpha = if (simpleEffects) 0.10f else 0.20f),
                        cornerRadius = CornerRadius(cornerRadius, cornerRadius),
                        style = Stroke(width = glowWidth),
                    )
                }
            }
            .background(if (value == 0) Color(0xFF070B10) else NeonPanelRaised, RoundedCornerShape(10.dp))
            .border(
                width = if (value == 0) 1.dp else 1.5.dp,
                color = if (value == 0) NeonGrid.copy(alpha = 0.65f) else accent.copy(alpha = 0.92f),
                shape = RoundedCornerShape(10.dp),
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (value > 0) {
            Text(
                value.toString(),
                color = NeonText,
                fontSize = when {
                    value < 100 -> 25.sp
                    value < 1000 -> 21.sp
                    else -> 17.sp
                },
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun PauseOverlay(onResume: () -> Unit, onReset: () -> Unit, onQuit: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xEE020406)),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            modifier = Modifier.border(1.dp, NeonCyan.copy(alpha = 0.72f), RoundedCornerShape(18.dp)),
            colors = CardDefaults.cardColors(containerColor = NeonPanel),
            shape = RoundedCornerShape(18.dp),
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("PAUSE", color = NeonCyan, fontSize = 23.sp, fontWeight = FontWeight.Black)
                NeonActionButton("再開", onResume)
                NeonActionButton("リトライ", onReset)
                NeonActionButton("戦闘終了 / メニューへ", onQuit)
            }
        }
    }
}

@Composable
private fun GameOverOverlay(
    reason: GameOverReason,
    score: Int,
    maxTile: Int,
    onReset: () -> Unit,
    onQuit: () -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xF2020406)),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            modifier = Modifier.border(1.dp, NeonPink.copy(alpha = 0.78f), RoundedCornerShape(18.dp)),
            colors = CardDefaults.cardColors(containerColor = NeonPanel),
            shape = RoundedCornerShape(18.dp),
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("GAME OVER", color = NeonPink, fontSize = 24.sp, fontWeight = FontWeight.Black)
                Text(
                    if (reason == GameOverReason.HP_ZERO) "TOTAL HP 0" else "2048盤面が詰まりました",
                    color = NeonMuted,
                )
                Text("SCORE $score  /  MAX $maxTile", color = NeonText, fontSize = 10.sp)
                NeonActionButton("RETRY", onReset)
                NeonActionButton("MENU", onQuit)
            }
        }
    }
}

@Composable
private fun NeonActionButton(label: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(
            containerColor = NeonPanelRaised,
            contentColor = NeonCyan,
        ),
    ) {
        Text(label, fontWeight = FontWeight.Bold)
    }
}

private fun neonTileAccent(value: Int): Color = when (value) {
    0 -> NeonGrid
    2 -> NeonCyan
    4 -> NeonBlue
    8 -> NeonViolet
    16 -> NeonPink
    32 -> NeonOrange
    64 -> NeonRed
    128 -> NeonLime
    256 -> NeonCyan
    512 -> NeonBlue
    1024 -> NeonViolet
    2048 -> NeonPink
    else -> NeonAmber
}

private fun weaponLabel(type: WeaponType): String = when (type) {
    WeaponType.NORMAL -> "通常"
    WeaponType.RAPID -> "連射"
    WeaponType.MACHINE_GUN -> "MG"
    WeaponType.PIERCING -> "貫通"
    WeaponType.EXPLOSIVE -> "爆殺"
    WeaponType.LASER -> "LASER"
}

private fun weaponColor(type: WeaponType): Color = when (type) {
    WeaponType.NORMAL -> Color(0xFFBFFBFF)
    WeaponType.RAPID -> NeonCyan
    WeaponType.MACHINE_GUN -> NeonBlue
    WeaponType.PIERCING -> NeonViolet
    WeaponType.EXPLOSIVE -> NeonOrange
    WeaponType.LASER -> NeonPink
}
