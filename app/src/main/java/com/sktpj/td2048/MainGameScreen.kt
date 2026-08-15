package com.sktpj.td2048

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

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
            .padding(horizontal = 8.dp, vertical = 6.dp),
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            GameStatusBar(snapshot = snapshot, onPause = onPause)
            Battlefield(
                snapshot = snapshot,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.46f),
            )
            TotalHpStrip(snapshot)
            ColumnWeaponStrip(snapshot)
            SimpleGameBoard(
                snapshot = snapshot,
                onMove = onMove,
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
            .background(Color(0xFF171A20), RoundedCornerShape(12.dp))
            .border(1.dp, UiBorder, RoundedCornerShape(12.dp))
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Text("2048TD", color = UiGold, fontWeight = FontWeight.Black, fontSize = 12.sp)
        HeaderHp(snapshot, Modifier.weight(1.5f))
        StatusCell("WAVE", snapshot.wave.toString(), Modifier.weight(0.62f))
        StatusCell("SCORE", snapshot.score.toString(), Modifier.weight(0.82f))
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
            Text("HP", color = UiMuted, fontSize = 7.sp)
            Text("${snapshot.currentHp}/${snapshot.maxHp}", color = UiText, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .background(Color(0xFF30343B), RoundedCornerShape(4.dp)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(ratio.coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .background(if (ratio < 0.25f) UiDanger else UiHp, RoundedCornerShape(4.dp)),
            )
        }
    }
}

@Composable
private fun StatusCell(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(Color(0xFF11141A), RoundedCornerShape(8.dp))
            .border(1.dp, Color(0xFF343941), RoundedCornerShape(8.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(label, color = UiMuted, fontSize = 6.sp)
        Text(value, color = UiText, fontSize = 11.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun Battlefield(snapshot: GameSnapshot, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .background(Color(0xFF0C1015), RoundedCornerShape(14.dp))
            .border(1.5.dp, UiGoldSoft, RoundedCornerShape(14.dp)),
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawBattlefield(snapshot)
        }

        snapshot.bossWarning?.let { warning ->
            Text(
                text = "BOSS  ${ceil(warning.remainingSeconds).toInt()}s",
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 7.dp)
                    .background(Color(0xD52B1234), RoundedCornerShape(8.dp))
                    .border(1.dp, UiBoss, RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                color = UiWarning,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
            )
        }
        Text(
            "敵進行 ↓",
            modifier = Modifier.align(Alignment.TopStart).padding(7.dp),
            color = UiMuted,
            fontSize = 8.sp,
        )
        Text(
            "DEFENSE LINE",
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 4.dp)
                .background(Color(0xD9080A0E), RoundedCornerShape(5.dp))
                .padding(horizontal = 6.dp, vertical = 2.dp),
            color = UiHp,
            fontSize = 7.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

private fun DrawScope.drawBattlefield(snapshot: GameSnapshot) {
    val laneWidth = size.width / 4f
    for (lane in 0 until 4) {
        val left = lane * laneWidth
        drawRect(
            color = if (lane % 2 == 0) Color(0xFF12171D) else Color(0xFF0E1318),
            topLeft = Offset(left, 0f),
            size = Size(laneWidth, size.height),
        )
        drawTextNative("${lane + 1}", left + laneWidth / 2f, 18f, UiMuted, 15f)
    }
    for (lane in 1 until 4) {
        val x = lane * laneWidth
        drawLine(Color(0xFF39414B), Offset(x, 0f), Offset(x, size.height), 1.5f)
    }

    val bossX = size.width / 2f
    drawRect(
        UiBoss.copy(alpha = if (snapshot.bossWarning != null) 0.20f else 0.07f),
        Offset(bossX - 7f, 0f),
        Size(14f, size.height),
    )
    drawLine(
        if (snapshot.bossWarning != null) UiWarning else UiBoss.copy(alpha = 0.55f),
        Offset(bossX, 0f),
        Offset(bossX, size.height),
        if (snapshot.bossWarning != null) 4f else 2f,
    )
    drawTextNative("BOSS", bossX, 35f, UiBoss, 14f)

    snapshot.enemies.forEach { enemy ->
        val center = Offset(size.width * GameEngine.enemyX(enemy), size.height * enemy.progress)
        val radius = if (enemy.enemyType == EnemyType.BOSS) min(size.width, size.height) * 0.060f else min(size.width, size.height) * 0.032f
        val color = if (enemy.enemyType == EnemyType.BOSS) UiBoss else Color(0xFFE85E52)
        drawCircle(color.copy(alpha = 0.22f), radius * 1.35f, center)
        drawCircle(color, radius, center)
        val hpRatio = (enemy.hp / enemy.maxHp).coerceIn(0f, 1f)
        val barWidth = radius * 2.4f
        val top = center.y - radius - 10f
        drawRect(Color(0xFF333942), Offset(center.x - barWidth / 2f, top), Size(barWidth, 5f))
        drawRect(UiHp, Offset(center.x - barWidth / 2f, top), Size(barWidth * hpRatio, 5f))
        drawTextNative(enemy.hp.toInt().coerceAtLeast(0).toString(), center.x, top - 4f, UiText, if (enemy.enemyType == EnemyType.BOSS) 17f else 13f)
    }

    snapshot.projectiles.forEach { projectile ->
        val center = Offset(size.width * projectile.x, size.height * projectile.y)
        val sourceColumn = projectile.sourceCellIndex.coerceIn(0, 3)
        val (sx, sy) = GameEngine.turretPosition(sourceColumn)
        val source = Offset(size.width * sx, size.height * sy)
        val color = weaponColor(projectile.weaponType)
        when (projectile.weaponType) {
            WeaponType.NORMAL -> drawCircle(color, 4.5f, center)
            WeaponType.RAPID -> drawCircle(color, 3.8f, center)
            WeaponType.MACHINE_GUN -> {
                drawLine(color.copy(alpha = 0.55f), Offset(center.x, center.y + 11f), center, 3f)
                drawCircle(color, 3.2f, center)
            }
            WeaponType.PIERCING -> {
                drawLine(color, Offset(center.x, center.y + 14f), Offset(center.x, center.y - 6f), 5f)
            }
            WeaponType.EXPLOSIVE -> {
                drawCircle(color.copy(alpha = 0.25f), 11f, center)
                drawCircle(color, 6f, center)
            }
            WeaponType.LASER -> {
                drawLine(color.copy(alpha = 0.28f), source, center, 13f)
                drawLine(color, source, center, 4f)
            }
        }
    }

    val defenseY = size.height - 12f
    drawLine(UiHp.copy(alpha = 0.30f), Offset(0f, defenseY), Offset(size.width, defenseY), 9f)
    drawLine(UiHp, Offset(0f, defenseY), Offset(size.width, defenseY), 2.5f)

    for (column in 0 until 4) {
        val x = (column + 0.5f) * laneWidth
        val y = defenseY - 2f
        val state = snapshot.columns.getOrNull(column)
        val color = weaponColor(state?.weaponType ?: WeaponType.NORMAL)
        drawCircle(Color(0xFF090C11), 13f, Offset(x, y), style = Stroke(3f))
        drawCircle(color.copy(alpha = 0.22f), 12f, Offset(x, y))
        drawCircle(color, 8f, Offset(x, y))
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
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(31.dp)
            .background(Color(0xFF101319), RoundedCornerShape(9.dp))
            .border(1.dp, Color(0xFF343941), RoundedCornerShape(9.dp))
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("TOTAL HP", color = UiMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        Box(
            modifier = Modifier
                .weight(1f)
                .height(9.dp)
                .background(Color(0xFF30343B), RoundedCornerShape(5.dp)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(ratio.coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .background(if (ratio < 0.25f) UiDanger else UiHp, RoundedCornerShape(5.dp)),
            )
        }
        Text("${snapshot.currentHp}/${snapshot.maxHp}", color = UiText, fontSize = 8.sp, fontWeight = FontWeight.Bold)
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
                    .background(Color(0xFF11151B), RoundedCornerShape(9.dp))
                    .border(1.dp, color.copy(alpha = 0.72f), RoundedCornerShape(9.dp))
                    .padding(vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("LV ${state.level}", color = color, fontSize = 8.sp, fontWeight = FontWeight.Black)
                Text(weaponLabel(state.weaponType), color = UiText, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Text("ATK ${state.power}", color = UiMuted, fontSize = 7.sp)
            }
        }
    }
}

@Composable
private fun SimpleGameBoard(snapshot: GameSnapshot, onMove: (Direction) -> Unit, modifier: Modifier = Modifier) {
    var dragX by remember { mutableFloatStateOf(0f) }
    var dragY by remember { mutableFloatStateOf(0f) }

    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF11151B)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("2048", color = UiText, fontSize = 12.sp, fontWeight = FontWeight.Black)
                Text(
                    if (snapshot.mergeBurst > 0) "MERGE +${snapshot.mergeBurst}" else "列を育てて武器進化",
                    color = if (snapshot.mergeBurst > 0) UiWarning else UiMuted,
                    fontSize = 9.sp,
                )
            }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
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
                                        onMove(if (dragX > 0) Direction.RIGHT else Direction.LEFT)
                                    } else {
                                        onMove(if (dragY > 0) Direction.DOWN else Direction.UP)
                                    }
                                }
                                dragX = 0f
                                dragY = 0f
                            },
                            onDragCancel = { dragX = 0f; dragY = 0f },
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
                            SimpleTile(value, Modifier.weight(1f).fillMaxHeight())
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SimpleTile(value: Int, modifier: Modifier = Modifier) {
    val background = tileColor(value)
    Box(
        modifier = modifier
            .background(background, RoundedCornerShape(10.dp))
            .border(1.dp, if (value == 0) Color(0xFF333942) else Color.White.copy(alpha = 0.12f), RoundedCornerShape(10.dp)),
        contentAlignment = Alignment.Center,
    ) {
        if (value > 0) {
            Text(
                value.toString(),
                color = tileTextColor(value),
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
        modifier = Modifier.fillMaxSize().background(Color(0xDD080A0E)),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = UiPanel),
            shape = RoundedCornerShape(18.dp),
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("PAUSE", color = UiText, fontSize = 23.sp, fontWeight = FontWeight.Black)
                Button(onClick = onResume, modifier = Modifier.fillMaxWidth()) { Text("再開") }
                Button(onClick = onReset, modifier = Modifier.fillMaxWidth()) { Text("リトライ") }
                Button(onClick = onQuit, modifier = Modifier.fillMaxWidth()) { Text("戦闘終了 / メニューへ") }
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
        modifier = Modifier.fillMaxSize().background(Color(0xE6080A0E)),
        contentAlignment = Alignment.Center,
    ) {
        Card(colors = CardDefaults.cardColors(containerColor = UiPanel), shape = RoundedCornerShape(18.dp)) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("GAME OVER", color = UiText, fontSize = 24.sp, fontWeight = FontWeight.Black)
                Text(
                    if (reason == GameOverReason.HP_ZERO) "TOTAL HP 0" else "2048盤面が詰まりました",
                    color = UiMuted,
                )
                Text("SCORE $score  /  MAX $maxTile", color = UiMuted, fontSize = 10.sp)
                Button(onClick = onReset, modifier = Modifier.fillMaxWidth()) { Text("RETRY") }
                Button(onClick = onQuit, modifier = Modifier.fillMaxWidth()) { Text("MENU") }
            }
        }
    }
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
    WeaponType.NORMAL -> Color(0xFFCBD5E1)
    WeaponType.RAPID -> Color(0xFF67E8F9)
    WeaponType.MACHINE_GUN -> Color(0xFF60A5FA)
    WeaponType.PIERCING -> Color(0xFFA78BFA)
    WeaponType.EXPLOSIVE -> Color(0xFFF97316)
    WeaponType.LASER -> Color(0xFFE879F9)
}
