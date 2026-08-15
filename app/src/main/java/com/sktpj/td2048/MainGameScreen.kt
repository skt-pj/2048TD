package com.sktpj.td2048

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

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
            .background(UiBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 7.dp, vertical = 6.dp),
    ) {
        val showAux = maxHeight >= 690.dp
        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                GameStatusBar(snapshot = snapshot, onPause = onPause)
                Battlefield(
                    snapshot = snapshot,
                    simpleEffects = settings.simpleEffects,
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(if (showAux) 0.40f else 0.43f),
                )
                TotalHpStrip(snapshot)
                GameBoard(
                    snapshot = snapshot,
                    onMove = onMove,
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(if (showAux) 0.43f else 0.50f),
                )
                if (showAux) {
                    BattleAuxiliaryPanel(snapshot = snapshot)
                }
            }

            if (paused) {
                PauseAndSettingsOverlay(
                    settings = settings,
                    onSettingsChange = onSettingsChange,
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
}

@Composable
private fun GameStatusBar(snapshot: GameSnapshot, onPause: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(50.dp)
            .background(
                Brush.verticalGradient(listOf(Color(0xFF24262A), Color(0xFF0C0E12))),
                RoundedCornerShape(10.dp),
            )
            .border(1.dp, UiBorder, RoundedCornerShape(10.dp))
            .padding(horizontal = 6.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Text("2048TD", color = UiGold, fontWeight = FontWeight.Black, fontSize = 11.sp)
        HeaderHp(snapshot = snapshot, modifier = Modifier.weight(1.75f))
        StatusBlock("WAVE", snapshot.wave.toString(), Modifier.weight(0.65f))
        StatusBlock("SCORE", snapshot.score.toString(), Modifier.weight(0.95f))
        snapshot.bossWarning?.let { warning ->
            Box(
                modifier = Modifier
                    .height(34.dp)
                    .background(UiBoss.copy(alpha = 0.15f), RoundedCornerShape(7.dp))
                    .border(1.dp, UiBoss.copy(alpha = 0.75f), RoundedCornerShape(7.dp))
                    .padding(horizontal = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "BOSS ${ceil(warning.remainingSeconds).toInt()}s",
                    color = UiWarning,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Black,
                )
            }
        }
        Button(
            onClick = onPause,
            modifier = Modifier.size(38.dp),
            contentPadding = PaddingValues(0.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF262B32)),
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
            Text("HP", color = UiMuted, fontSize = 7.sp, fontWeight = FontWeight.Bold)
            Text(
                "${snapshot.currentHp}/${snapshot.maxHp}",
                color = UiText,
                fontSize = 8.sp,
                fontWeight = FontWeight.Black,
            )
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .background(Color(0xFF352B2B), RoundedCornerShape(4.dp)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(ratio.coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .background(
                        if (ratio < 0.25f) UiDanger else UiHp,
                        RoundedCornerShape(4.dp),
                    ),
            )
        }
    }
}

@Composable
private fun StatusBlock(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(Color(0xFF15191F), RoundedCornerShape(7.dp))
            .border(1.dp, Color(0xFF363B43), RoundedCornerShape(7.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(label, color = UiMuted, fontSize = 6.sp)
        Text(value, color = UiText, fontSize = 10.sp, fontWeight = FontWeight.Black, maxLines = 1)
    }
}

@Composable
private fun Battlefield(snapshot: GameSnapshot, simpleEffects: Boolean, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .background(
                Brush.verticalGradient(listOf(Color(0xFF17181B), Color(0xFF07080B))),
                RoundedCornerShape(13.dp),
            )
            .border(1.5.dp, UiGoldSoft, RoundedCornerShape(13.dp))
            .padding(4.dp),
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawBattlefield(snapshot, simpleEffects)
        }

        snapshot.bossWarning?.let { warning ->
            Row(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 5.dp)
                    .background(Color(0xE6290C36), RoundedCornerShape(8.dp))
                    .border(1.dp, UiBoss, RoundedCornerShape(8.dp))
                    .padding(horizontal = 9.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                HandIcon(warning.handType, modifier = Modifier.size(14.dp))
                Text(
                    "BOSS WARNING  ${ceil(warning.remainingSeconds).toInt()}s",
                    color = UiWarning,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                )
            }
        }

        Text(
            text = "敵進行 ↓",
            modifier = Modifier.align(Alignment.TopStart).padding(6.dp),
            color = UiMuted.copy(alpha = 0.75f),
            fontSize = 7.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = "DEFENSE LINE",
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 2.dp)
                .background(UiPanelDeep.copy(alpha = 0.72f), RoundedCornerShape(4.dp))
                .padding(horizontal = 5.dp, vertical = 1.dp),
            color = UiHp,
            fontSize = 7.sp,
            fontWeight = FontWeight.Black,
        )
    }
}

private fun DrawScope.drawBattlefield(snapshot: GameSnapshot, simpleEffects: Boolean) {
    val laneWidth = size.width / 4f
    val rowHeight = size.height / 4f

    for (lane in 0 until 4) {
        val left = lane * laneWidth
        drawRect(
            color = if (lane % 2 == 0) Color(0xFF11151B) else Color(0xFF0D1117),
            topLeft = Offset(left, 0f),
            size = Size(laneWidth, size.height),
        )
        drawTextNative(
            text = "LANE ${lane + 1}",
            x = left + laneWidth / 2f,
            y = 15f,
            color = UiMuted.copy(alpha = 0.65f),
            textSize = 14f,
        )
    }

    for (row in 0 until 4) {
        val top = row * rowHeight
        val color = when (row) {
            0 -> UiDanger.copy(alpha = 0.055f)
            1 -> UiWarning.copy(alpha = 0.035f)
            2 -> UiPaper.copy(alpha = 0.028f)
            else -> UiHp.copy(alpha = 0.050f)
        }
        drawRect(color, Offset(0f, top), Size(size.width, rowHeight))
    }

    for (lane in 1 until 4) {
        val x = lane * laneWidth
        drawLine(Color(0xFF4B5058), Offset(x, 0f), Offset(x, size.height), strokeWidth = 1.5f)
    }

    val bossX = size.width * 0.5f
    val bossPathWidth = size.width * 0.035f
    drawRect(
        color = if (snapshot.bossWarning != null) UiBoss.copy(alpha = 0.25f) else UiBoss.copy(alpha = 0.075f),
        topLeft = Offset(bossX - bossPathWidth / 2f, 0f),
        size = Size(bossPathWidth, size.height),
    )
    drawLine(
        color = if (snapshot.bossWarning != null) UiWarning else UiBoss.copy(alpha = 0.65f),
        start = Offset(bossX, 0f),
        end = Offset(bossX, size.height),
        strokeWidth = if (snapshot.bossWarning != null) 4.5f else 2f,
    )
    drawTextNative("BOSS", bossX, 30f, UiBoss.copy(alpha = 0.9f), 15f)

    val boss = snapshot.enemies.firstOrNull { it.enemyType == EnemyType.BOSS }
    if (boss != null) {
        val bossCenter = Offset(size.width * 0.5f, size.height * boss.progress)
        snapshot.board.indices.forEach { cellIndex ->
            val col = GameRules.colOf(cellIndex)
            if (snapshot.board[cellIndex] > 0 && (col == 1 || col == 2)) {
                val (nx, ny) = GameEngine.nodePosition(cellIndex)
                drawLine(
                    color = UiBoss.copy(alpha = if (simpleEffects) 0.12f else 0.24f),
                    start = Offset(size.width * nx, size.height * ny),
                    end = bossCenter,
                    strokeWidth = 1.5f,
                )
            }
        }
    }

    snapshot.board.indices.forEach { cellIndex ->
        val value = snapshot.board[cellIndex]
        val character = snapshot.formation[cellIndex]
        val (nx, ny) = GameEngine.nodePosition(cellIndex)
        val center = Offset(size.width * nx, size.height * ny)
        val active = value > 0
        val accent = handColor(character.handType)
        if (active && !simpleEffects) {
            drawCircle(accent.copy(alpha = 0.10f), radius = 17f, center = center)
        }
        drawCircle(
            color = UiPanelDeep.copy(alpha = if (active) 0.96f else 0.50f),
            radius = if (active) 10.5f else 7.5f,
            center = center,
        )
        drawCircle(
            color = accent.copy(alpha = if (active) 0.95f else 0.25f),
            radius = if (active) 10.5f else 7.5f,
            center = center,
            style = Stroke(width = if (active) 2.5f else 1.3f),
        )
        drawTextNative(
            character.name.take(1),
            center.x,
            center.y + 4f,
            if (active) UiText else UiMuted.copy(alpha = 0.45f),
            if (active) 14f else 11f,
        )
        if (active) {
            drawTextNative(value.toString(), center.x, center.y - 14f, UiText, 15f)
        }
    }

    snapshot.projectiles.forEach { projectile ->
        val center = Offset(size.width * projectile.x, size.height * projectile.y)
        val target = snapshot.enemies.firstOrNull { it.id == projectile.targetEnemyId }
        val accent = handColor(projectile.handType)
        if (target != null) {
            val tx = size.width * GameEngine.enemyX(target)
            val ty = size.height * target.progress
            val dx = tx - center.x
            val dy = ty - center.y
            val len = sqrt(dx * dx + dy * dy).coerceAtLeast(0.001f)
            val tail = Offset(center.x - dx / len * 13f, center.y - dy / len * 13f)
            drawLine(accent.copy(alpha = 0.45f), tail, center, strokeWidth = 3f)
        }
        if (!simpleEffects) drawCircle(accent.copy(alpha = 0.20f), 8f, center)
        drawCircle(accent, 4.2f, center)
    }

    snapshot.enemies.forEach { enemy ->
        val x = size.width * GameEngine.enemyX(enemy)
        val y = size.height * enemy.progress
        val center = Offset(x, y)
        drawEnemy(enemy, center, simpleEffects)
    }

    val defenseY = size.height - 5f
    drawLine(UiHp.copy(alpha = 0.35f), Offset(0f, defenseY - 5f), Offset(size.width, defenseY - 5f), strokeWidth = 8f)
    drawLine(UiHp, Offset(0f, defenseY), Offset(size.width, defenseY), strokeWidth = 2.5f)
}

private fun DrawScope.drawEnemy(enemy: Enemy, center: Offset, simpleEffects: Boolean) {
    val base = min(size.width, size.height)
    val radius = if (enemy.enemyType == EnemyType.BOSS) base * 0.078f else base * 0.037f
    val accent = handColor(enemy.handType)

    if (!simpleEffects) {
        drawCircle(
            color = if (enemy.enemyType == EnemyType.BOSS) UiBoss.copy(alpha = 0.18f) else accent.copy(alpha = 0.12f),
            radius = radius * 1.35f,
            center = center,
        )
    }

    if (enemy.enemyType == EnemyType.BOSS) {
        val path = Path().apply {
            moveTo(center.x, center.y - radius * 1.15f)
            lineTo(center.x + radius, center.y - radius * 0.15f)
            lineTo(center.x + radius * 0.70f, center.y + radius)
            lineTo(center.x - radius * 0.70f, center.y + radius)
            lineTo(center.x - radius, center.y - radius * 0.15f)
            close()
        }
        drawPath(path, color = Color(0xFF24152D))
        drawPath(path, color = UiBoss, style = Stroke(width = 3f))
    } else {
        drawCircle(Color(0xFF1A1E25), radius, center)
        drawCircle(accent, radius, center, style = Stroke(width = 2.5f))
        val horn = Path().apply {
            moveTo(center.x - radius * 0.75f, center.y - radius * 0.55f)
            lineTo(center.x - radius * 1.00f, center.y - radius * 1.00f)
            lineTo(center.x - radius * 0.25f, center.y - radius * 0.72f)
            close()
        }
        drawPath(horn, accent.copy(alpha = 0.75f))
        val horn2 = Path().apply {
            moveTo(center.x + radius * 0.75f, center.y - radius * 0.55f)
            lineTo(center.x + radius * 1.00f, center.y - radius * 1.00f)
            lineTo(center.x + radius * 0.25f, center.y - radius * 0.72f)
            close()
        }
        drawPath(horn2, accent.copy(alpha = 0.75f))
    }

    drawHandMark(center = center, handType = enemy.handType, d = radius * 0.90f, color = accent)

    if (enemy.slowRemainingSeconds > 0f) {
        drawCircle(UiScissors.copy(alpha = 0.45f), radius * 1.20f, center, style = Stroke(width = 2f))
    }

    val hpRatio = (enemy.hp / enemy.maxHp).coerceIn(0f, 1f)
    val barWidth = radius * 2.5f
    val barHeight = if (enemy.enemyType == EnemyType.BOSS) 6f else 4f
    val barY = center.y - radius - 10f
    drawRoundRect(
        color = Color(0xFF391D1D),
        topLeft = Offset(center.x - barWidth / 2f, barY),
        size = Size(barWidth, barHeight),
        cornerRadius = CornerRadius(2f, 2f),
    )
    drawRoundRect(
        color = if (enemy.enemyType == EnemyType.BOSS) UiDanger else UiHp,
        topLeft = Offset(center.x - barWidth / 2f, barY),
        size = Size(barWidth * hpRatio, barHeight),
        cornerRadius = CornerRadius(2f, 2f),
    )
    drawTextNative(
        text = if (enemy.enemyType == EnemyType.BOSS) "BOSS ${enemy.hp.toInt()}" else enemy.hp.toInt().toString(),
        x = center.x,
        y = barY - 4f,
        color = if (enemy.enemyType == EnemyType.BOSS) UiWarning else UiText,
        textSize = if (enemy.enemyType == EnemyType.BOSS) 16f else 12f,
    )
}

private fun DrawScope.drawHandMark(center: Offset, handType: HandType, d: Float, color: Color) {
    val stroke = (d * 0.13f).coerceAtLeast(1.5f)
    when (handType) {
        HandType.ROCK -> {
            drawCircle(color, radius = d * 0.28f, center = Offset(center.x, center.y + d * 0.10f), style = Stroke(stroke))
            listOf(-0.23f, -0.08f, 0.08f, 0.23f).forEach { x ->
                drawCircle(color, radius = d * 0.08f, center = Offset(center.x + d * x, center.y - d * 0.18f))
            }
        }
        HandType.SCISSORS -> {
            drawLine(color, Offset(center.x - d * 0.08f, center.y + d * 0.20f), Offset(center.x - d * 0.28f, center.y - d * 0.28f), stroke)
            drawLine(color, Offset(center.x + d * 0.08f, center.y + d * 0.20f), Offset(center.x + d * 0.28f, center.y - d * 0.28f), stroke)
            drawCircle(color, d * 0.10f, Offset(center.x - d * 0.12f, center.y + d * 0.27f), style = Stroke(stroke * 0.8f))
            drawCircle(color, d * 0.10f, Offset(center.x + d * 0.12f, center.y + d * 0.27f), style = Stroke(stroke * 0.8f))
        }
        HandType.PAPER -> {
            drawRoundRect(
                color = color,
                topLeft = Offset(center.x - d * 0.26f, center.y - d * 0.30f),
                size = Size(d * 0.52f, d * 0.62f),
                cornerRadius = CornerRadius(d * 0.08f, d * 0.08f),
                style = Stroke(stroke),
            )
            drawLine(color, Offset(center.x, center.y - d * 0.24f), Offset(center.x, center.y + d * 0.05f), stroke * 0.45f)
        }
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
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(28.dp)
            .background(UiPanelDeep, RoundedCornerShape(7.dp))
            .border(1.dp, UiBorder.copy(alpha = 0.65f), RoundedCornerShape(7.dp))
            .padding(horizontal = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Text("TOTAL HP", color = UiMuted, fontSize = 7.sp, fontWeight = FontWeight.Black)
        Box(
            modifier = Modifier
                .weight(1f)
                .height(9.dp)
                .background(Color(0xFF342729), RoundedCornerShape(5.dp)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(ratio.coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .background(if (ratio < 0.25f) UiDanger else UiHp, RoundedCornerShape(5.dp)),
            )
        }
        Text("${snapshot.currentHp}/${snapshot.maxHp}", color = UiText, fontSize = 8.sp, fontWeight = FontWeight.Black)
        snapshot.hpDamageFlash?.let { flash ->
            Text("-${flash.amount}", color = UiDanger, fontSize = 10.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun GameBoard(snapshot: GameSnapshot, onMove: (Direction) -> Unit, modifier: Modifier = Modifier) {
    var dragX by remember { mutableFloatStateOf(0f) }
    var dragY by remember { mutableFloatStateOf(0f) }

    Column(
        modifier = modifier
            .background(
                Brush.verticalGradient(listOf(Color(0xFF282A2D), Color(0xFF111317))),
                RoundedCornerShape(13.dp),
            )
            .border(1.5.dp, UiGoldSoft, RoundedCornerShape(13.dp))
            .padding(5.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("2048 BOARD", color = UiText, fontSize = 9.sp, fontWeight = FontWeight.Black)
            Text(
                text = if (snapshot.mergeBurst > 0) "MERGE +${snapshot.mergeBurst}" else "数字 × 位置 × キャラ",
                color = if (snapshot.mergeBurst > 0) UiWarning else UiMuted,
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            AttackBonusGutter(Modifier.width(43.dp).fillMaxHeight())
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .pointerInput(Unit) {
                        detectDragGestures(
                            onDragStart = { dragX = 0f; dragY = 0f },
                            onDrag = { change, amount ->
                                change.consume()
                                dragX += amount.x
                                dragY += amount.y
                            },
                            onDragEnd = {
                                if (max(abs(dragX), abs(dragY)) >= 24f) {
                                    if (abs(dragX) > abs(dragY)) {
                                        onMove(if (dragX > 0f) Direction.RIGHT else Direction.LEFT)
                                    } else {
                                        onMove(if (dragY > 0f) Direction.DOWN else Direction.UP)
                                    }
                                }
                                dragX = 0f
                                dragY = 0f
                            },
                            onDragCancel = { dragX = 0f; dragY = 0f },
                        )
                    },
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                repeat(4) { row ->
                    Row(
                        modifier = Modifier.fillMaxWidth().weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        repeat(4) { col ->
                            val index = GameRules.cellIndex(row, col)
                            GameTileCell(
                                value = snapshot.board[index],
                                character = snapshot.formation[index],
                                bossColumn = col == 1 || col == 2,
                                modifier = Modifier.weight(1f).fillMaxHeight(),
                            )
                        }
                    }
                }
            }
            HpBonusGutter(Modifier.width(43.dp).fillMaxHeight())
        }
    }
}

@Composable
private fun AttackBonusGutter(modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(4) { row ->
            val accent = if (row <= 1) UiDanger else UiGold
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .background(accent.copy(alpha = 0.10f), RoundedCornerShape(7.dp))
                    .border(1.dp, accent.copy(alpha = 0.38f), RoundedCornerShape(7.dp)),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("ATK", color = accent, fontSize = 6.sp, fontWeight = FontWeight.Black)
                Text("×${formatMultiplier(FormationRules.rowAttackMultiplier[row])}", color = UiText, fontSize = 8.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun HpBonusGutter(modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(4) { row ->
            val accent = if (row >= 2) UiHp else UiScissors
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .background(accent.copy(alpha = 0.09f), RoundedCornerShape(7.dp))
                    .border(1.dp, accent.copy(alpha = 0.34f), RoundedCornerShape(7.dp)),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("HP", color = accent, fontSize = 6.sp, fontWeight = FontWeight.Black)
                Text("×${formatMultiplier(FormationRules.rowHpMultiplier[row])}", color = UiText, fontSize = 8.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun GameTileCell(
    value: Int,
    character: CharacterDefinition,
    bossColumn: Boolean,
    modifier: Modifier = Modifier,
) {
    val accent = handColor(character.handType)
    val base = tileColor(value)
    val shape = RoundedCornerShape(8.dp)
    Box(
        modifier = modifier
            .background(
                Brush.verticalGradient(
                    if (value == 0) {
                        listOf(Color(0xFF23272E), Color(0xFF171A20))
                    } else {
                        listOf(base.copy(alpha = 0.98f), base.copy(alpha = 0.72f))
                    },
                ),
                shape,
            )
            .border(1.5.dp, accent.copy(alpha = if (value > 0) 0.92f else 0.38f), shape),
    ) {
        HandIcon(
            handType = character.handType,
            modifier = Modifier.align(Alignment.TopStart).padding(4.dp).size(13.dp),
        )
        if (bossColumn) {
            Text("◆", modifier = Modifier.align(Alignment.TopEnd).padding(3.dp), color = UiBoss, fontSize = 8.sp)
        }
        AbilityBadge(
            ability = character.ability,
            modifier = Modifier.align(Alignment.BottomStart).padding(3.dp).size(17.dp, 12.dp),
        )
        if (value > 0) {
            Text(
                text = value.toString(),
                modifier = Modifier.align(Alignment.Center),
                color = tileTextColor(value),
                fontSize = when {
                    value < 100 -> 23.sp
                    value < 1000 -> 19.sp
                    value < 10000 -> 16.sp
                    else -> 13.sp
                },
                fontWeight = FontWeight.Black,
                maxLines = 1,
            )
        }
        Column(
            modifier = Modifier.align(Alignment.BottomEnd).padding(3.dp),
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            CharacterAvatar(character, muted = value == 0, size = 25.dp)
            Text(
                "Lv.${character.level}",
                color = if (value == 0) UiMuted.copy(alpha = 0.45f) else UiText.copy(alpha = 0.92f),
                fontSize = 6.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun BattleAuxiliaryPanel(snapshot: GameSnapshot) {
    val bossCount = snapshot.formation.count { it.ability == CharacterAbility.BOSS_BONUS }
    val slowCount = snapshot.formation.count { it.ability == CharacterAbility.SLOW }
    val nextBossWave = if (snapshot.wave % 5 == 0) snapshot.wave else snapshot.wave + (5 - snapshot.wave % 5)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .height(88.dp)
            .background(UiPanelDeep, RoundedCornerShape(10.dp))
            .border(1.dp, UiBorder.copy(alpha = 0.75f), RoundedCornerShape(10.dp))
            .padding(5.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().height(36.dp),
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            InfoChip("BOSS+", bossCount.toString(), UiBoss, Modifier.weight(0.75f))
            InfoChip("SLOW", slowCount.toString(), UiScissors, Modifier.weight(0.75f))
            val warning = snapshot.bossWarning
            Row(
                modifier = Modifier
                    .weight(1.8f)
                    .fillMaxHeight()
                    .background(UiBoss.copy(alpha = 0.10f), RoundedCornerShape(7.dp))
                    .border(1.dp, UiBoss.copy(alpha = 0.35f), RoundedCornerShape(7.dp))
                    .padding(horizontal = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                if (warning != null) {
                    HandIcon(warning.handType, Modifier.size(15.dp))
                    Column {
                        Text("NEXT BOSS", color = UiMuted, fontSize = 6.sp)
                        Text("${ceil(warning.remainingSeconds).toInt()} 秒", color = UiWarning, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    }
                } else {
                    Text("◆", color = UiBoss, fontSize = 12.sp)
                    Column {
                        Text("NEXT BOSS", color = UiMuted, fontSize = 6.sp)
                        Text("WAVE $nextBossWave", color = UiText, fontSize = 9.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
        }

        Column(modifier = Modifier.fillMaxWidth().weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            snapshot.eventLog.takeLast(2).forEach { entry ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(formatLogTime(entry.timestampSeconds), color = UiMuted, fontSize = 6.sp)
                    Text(
                        entry.message,
                        color = when (entry.tone) {
                            BattleLogTone.INFO -> UiText
                            BattleLogTone.GOOD -> UiGood
                            BattleLogTone.WARNING -> UiWarning
                        },
                        fontSize = 7.sp,
                        fontWeight = if (entry.tone == BattleLogTone.INFO) FontWeight.Normal else FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun InfoChip(label: String, value: String, accent: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(accent.copy(alpha = 0.10f), RoundedCornerShape(7.dp))
            .border(1.dp, accent.copy(alpha = 0.32f), RoundedCornerShape(7.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(label, color = accent, fontSize = 6.sp, fontWeight = FontWeight.Black)
        Text(value, color = UiText, fontSize = 10.sp, fontWeight = FontWeight.Black)
    }
}

private fun formatLogTime(seconds: Float): String {
    val total = seconds.toInt().coerceAtLeast(0)
    return "%02d:%02d".format(total / 60, total % 60)
}

@Composable
private fun PauseAndSettingsOverlay(
    settings: GameSettings,
    onSettingsChange: (GameSettings) -> Unit,
    onResume: () -> Unit,
    onReset: () -> Unit,
    onQuit: () -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xDF050607)),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(0.88f),
            colors = CardDefaults.cardColors(containerColor = UiPanel),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.5.dp, UiGoldSoft),
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                Text("一時停止", color = UiText, fontSize = 22.sp, fontWeight = FontWeight.Black)
                Button(onClick = onResume, modifier = Modifier.fillMaxWidth()) { Text("再開") }
                Button(onClick = onReset, modifier = Modifier.fillMaxWidth()) { Text("リトライ") }
                HorizontalDivider(color = UiBorder.copy(alpha = 0.55f))
                Text("音量", color = UiMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Slider(
                    value = settings.soundVolume,
                    onValueChange = { onSettingsChange(settings.copy(soundVolume = it)) },
                    valueRange = 0f..1f,
                )
                SettingSwitchRow(
                    label = "振動",
                    checked = settings.vibrationEnabled,
                    onCheckedChange = { onSettingsChange(settings.copy(vibrationEnabled = it)) },
                )
                SettingSwitchRow(
                    label = "エフェクト簡略化",
                    checked = settings.simpleEffects,
                    onCheckedChange = { onSettingsChange(settings.copy(simpleEffects = it)) },
                )
                OutlinedButton(onClick = onQuit, modifier = Modifier.fillMaxWidth()) {
                    Text("戦闘終了 / メニューへ", color = UiDanger)
                }
            }
        }
    }
}

@Composable
private fun SettingSwitchRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = UiText, fontSize = 10.sp)
        Switch(checked = checked, onCheckedChange = onCheckedChange)
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
        modifier = Modifier.fillMaxSize().background(Color(0xE8050607)),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(0.84f),
            colors = CardDefaults.cardColors(containerColor = UiPanel),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.5.dp, UiDanger.copy(alpha = 0.7f)),
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                Text("GAME OVER", color = UiDanger, fontSize = 25.sp, fontWeight = FontWeight.Black)
                Text(
                    if (reason == GameOverReason.HP_ZERO) "総HPが0になりました" else "2048盤面が詰まりました",
                    color = UiText,
                    fontSize = 12.sp,
                )
                Text("SCORE $score  /  MAX $maxTile", color = UiMuted, fontSize = 10.sp)
                Button(onClick = onReset, modifier = Modifier.fillMaxWidth()) { Text("RETRY") }
                OutlinedButton(onClick = onQuit, modifier = Modifier.fillMaxWidth()) { Text("メニューへ") }
            }
        }
    }
}
