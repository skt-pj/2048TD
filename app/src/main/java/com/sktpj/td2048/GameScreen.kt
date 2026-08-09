package com.sktpj.td2048

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

private val AppBackground = Color(0xFF020617)
private val PanelBackground = Color(0xFF0F172A)
private val PanelBorder = Color(0xFF334155)
private val Cyan = Color(0xFF67E8F9)
private val Rose = Color(0xFFFB7185)
private val Lime = Color(0xFFA3E635)

@Composable
fun GameApp() {
    val engine = remember { GameEngine() }
    var snapshot by remember { mutableStateOf(engine.snapshot()) }

    LaunchedEffect(engine) {
        var lastFrame = withFrameNanos { it }
        while (isActive) {
            withFrameNanos { frame ->
                val deltaSeconds = (frame - lastFrame) / 1_000_000_000f
                lastFrame = frame
                snapshot = engine.tick(deltaSeconds)
            }
        }
    }

    LaunchedEffect(snapshot.mergeBurst) {
        if (snapshot.mergeBurst > 0) {
            delay(240)
            snapshot = engine.clearMergeBurst()
        }
    }

    MaterialTheme(colorScheme = darkColorScheme()) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = AppBackground,
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .navigationBarsPadding()
                    .padding(12.dp),
            ) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Header(
                        snapshot = snapshot,
                        onReset = { snapshot = engine.reset() },
                    )

                    Battlefield(
                        snapshot = snapshot,
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(0.38f),
                    )

                    GameBoard(
                        board = snapshot.board,
                        autoDamage = GameRules.computeBoardAutoDamage(snapshot.board),
                        mergeBurst = snapshot.mergeBurst,
                        onMove = { direction -> snapshot = engine.move(direction) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(0.52f),
                    )
                }

                if (snapshot.gameOver) {
                    GameOverOverlay(
                        score = snapshot.score,
                        maxTile = snapshot.board.maxOrNull() ?: 0,
                        onReset = { snapshot = engine.reset() },
                    )
                }
            }
        }
    }
}

@Composable
private fun Header(
    snapshot: GameSnapshot,
    onReset: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text(
                    text = "2048 Defense",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                )
                Text(
                    text = "2048を育てて定期火力を上げる",
                    color = Color(0xFFCBD5E1),
                    fontSize = 12.sp,
                )
            }
            Button(onClick = onReset) {
                Text("RESET")
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            StatCell("SCORE", snapshot.score.toString(), Modifier.weight(1f))
            StatCell("WAVE", snapshot.wave.toString(), Modifier.weight(1f))
            StatCell("BASE", snapshot.baseHp.toString(), Modifier.weight(1f))
            StatCell("SHOT", snapshot.lastAutoShot.toString(), Modifier.weight(1f))
        }
    }
}

@Composable
private fun StatCell(label: String, value: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = PanelBackground),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(label, color = Color(0xFF94A3B8), fontSize = 9.sp)
            Text(value, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        }
    }
}

@Composable
private fun Battlefield(
    snapshot: GameSnapshot,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = PanelBackground),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp)
                .background(AppBackground, RoundedCornerShape(16.dp)),
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val laneColor = Color(0xFF1E293B)
                val baseWidth = size.width * 0.08f

                drawRect(
                    color = Color(0x3322D3EE),
                    topLeft = Offset.Zero,
                    size = Size(baseWidth, size.height),
                )
                drawLine(
                    color = Cyan,
                    start = Offset(baseWidth, 0f),
                    end = Offset(baseWidth, size.height),
                    strokeWidth = 2f,
                )

                for (lane in 1..4) {
                    val y = size.height * lane / 5f
                    drawLine(
                        color = laneColor,
                        start = Offset(0f, y),
                        end = Offset(size.width, y),
                        strokeWidth = 1f,
                    )
                }

                snapshot.projectiles.forEach { projectile ->
                    drawCircle(
                        color = Cyan,
                        radius = max(5f, min(size.width, size.height) * 0.018f),
                        center = Offset(size.width * projectile.x, size.height * projectile.y),
                    )
                }

                snapshot.enemies.forEach { enemy ->
                    val center = Offset(size.width * enemy.x, size.height * enemy.y)
                    val radius = min(size.width, size.height) * enemy.radius
                    drawCircle(
                        color = Rose,
                        radius = radius,
                        center = center,
                    )

                    val hpRatio = (enemy.hp / enemy.maxHp).coerceIn(0f, 1f)
                    val barWidth = radius * 2.4f
                    val barHeight = max(4f, radius * 0.18f)
                    val barLeft = center.x - barWidth / 2f
                    val barTop = center.y + radius + 6f
                    drawRect(
                        color = Color(0xFF334155),
                        topLeft = Offset(barLeft, barTop),
                        size = Size(barWidth, barHeight),
                    )
                    drawRect(
                        color = Lime,
                        topLeft = Offset(barLeft, barTop),
                        size = Size(barWidth * hpRatio, barHeight),
                    )
                }
            }

            Text(
                text = "BASE",
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = 4.dp),
                color = Cyan,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
            )

            Text(
                text = "AUTO ${snapshot.lastAutoShot}",
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(8.dp)
                    .background(Color(0x3322D3EE), RoundedCornerShape(10.dp))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                color = Cyan,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun GameBoard(
    board: List<Int>,
    autoDamage: Int,
    mergeBurst: Int,
    onMove: (Direction) -> Unit,
    modifier: Modifier = Modifier,
) {
    var dragX by remember { mutableStateOf(0f) }
    var dragY by remember { mutableStateOf(0f) }

    Card(
        modifier = modifier,
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = PanelBackground),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "2048 BOARD",
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                )
                Text(
                    text = if (mergeBurst > 0) "MERGE +$mergeBurst" else "POWER $autoDamage",
                    color = if (mergeBurst > 0) Color(0xFFFDE68A) else Cyan,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .pointerInput(Unit) {
                        detectDragGestures(
                            onDragStart = {
                                dragX = 0f
                                dragY = 0f
                            },
                            onDrag = { change, dragAmount ->
                                change.consume()
                                dragX += dragAmount.x
                                dragY += dragAmount.y
                            },
                            onDragEnd = {
                                val threshold = 24f
                                if (max(abs(dragX), abs(dragY)) >= threshold) {
                                    if (abs(dragX) > abs(dragY)) {
                                        onMove(if (dragX > 0f) Direction.RIGHT else Direction.LEFT)
                                    } else {
                                        onMove(if (dragY > 0f) Direction.DOWN else Direction.UP)
                                    }
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
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                repeat(GameRules.GRID_SIZE) { row ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        repeat(GameRules.GRID_SIZE) { col ->
                            val value = board[row * GameRules.GRID_SIZE + col]
                            Tile(
                                value = value,
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxSize(),
                            )
                        }
                    }
                }
            }

            Text(
                text = "盤面を上下左右にスワイプ / 攻撃は0.9秒ごとに自動",
                modifier = Modifier.fillMaxWidth(),
                color = Color(0xFF94A3B8),
                fontSize = 10.sp,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun Tile(value: Int, modifier: Modifier = Modifier) {
    val background = tileColor(value)
    val textColor = if (value <= 4) Color(0xFF0F172A) else Color(0xFFF8FAFC)
    val fontSize = when {
        value < 100 -> 24.sp
        value < 1000 -> 21.sp
        value < 10000 -> 18.sp
        else -> 15.sp
    }

    Box(
        modifier = modifier
            .background(background, RoundedCornerShape(14.dp)),
        contentAlignment = Alignment.Center,
    ) {
        if (value > 0) {
            Text(
                text = value.toString(),
                color = textColor,
                fontSize = fontSize,
                fontWeight = FontWeight.Black,
            )
        }
    }
}

private fun tileColor(value: Int): Color {
    return when (value) {
        0 -> Color(0xFF1E293B)
        2 -> Color(0xFFF1F5F9)
        4 -> Color(0xFFFFEDD5)
        8 -> Color(0xFFFCD34D)
        16 -> Color(0xFFF59E0B)
        32 -> Color(0xFF84CC16)
        64 -> Color(0xFF10B981)
        128 -> Color(0xFF06B6D4)
        256 -> Color(0xFF0EA5E9)
        512 -> Color(0xFF6366F1)
        1024 -> Color(0xFF8B5CF6)
        2048 -> Color(0xFFD946EF)
        else -> Color(0xFFF43F5E)
    }
}

@Composable
private fun GameOverOverlay(
    score: Int,
    maxTile: Int,
    onReset: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xCC020617)),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = PanelBackground),
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("GAME OVER", fontSize = 26.sp, fontWeight = FontWeight.Black)
                Text("Score $score / Max $maxTile", color = Color(0xFFCBD5E1))
                Spacer(Modifier.height(2.dp))
                Button(onClick = onReset) {
                    Text("RETRY")
                }
            }
        }
    }
}
