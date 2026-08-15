package com.sktpj.td2048

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
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

private val AppBackground = Color(0xFF050816)
private val PanelBackground = Color(0xFF111827)
private val RockColor = Color(0xFFEF4444)
private val ScissorsColor = Color(0xFF3B82F6)
private val PaperColor = Color(0xFF22C55E)
private val BossColor = Color(0xFFA855F7)
private val HpColor = Color(0xFF22C55E)
private val WarningColor = Color(0xFFF59E0B)

private enum class AppScreen { GAME, FORMATION }

@Composable
fun GameApp() {
    val engine = remember { GameEngine() }
    var snapshot by remember { mutableStateOf(engine.snapshot()) }
    var screen by remember { mutableStateOf(AppScreen.GAME) }
    var paused by remember { mutableStateOf(false) }
    var formationDraft by remember { mutableStateOf(snapshot.formation) }

    LaunchedEffect(engine, screen, paused) {
        var lastFrame = withFrameNanos { it }
        while (isActive) {
            withFrameNanos { frame ->
                val deltaSeconds = (frame - lastFrame) / 1_000_000_000f
                lastFrame = frame
                if (screen == AppScreen.GAME && !paused) snapshot = engine.tick(deltaSeconds)
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
        Surface(modifier = Modifier.fillMaxSize(), color = AppBackground) {
            when (screen) {
                AppScreen.GAME -> GameScreen(
                    snapshot = snapshot,
                    paused = paused,
                    onMove = { snapshot = engine.move(it) },
                    onReset = { snapshot = engine.reset() },
                    onPause = { paused = !paused },
                    onFormation = {
                        paused = true
                        formationDraft = snapshot.formation
                        screen = AppScreen.FORMATION
                    },
                )
                AppScreen.FORMATION -> FormationScreen(
                    formation = formationDraft,
                    onFormationChange = { formationDraft = it },
                    onSave = {
                        snapshot = engine.setFormation(formationDraft)
                        paused = false
                        screen = AppScreen.GAME
                    },
                    onCancel = {
                        paused = false
                        screen = AppScreen.GAME
                    },
                )
            }
        }
    }
}

@Composable
private fun GameScreen(
    snapshot: GameSnapshot,
    paused: Boolean,
    onMove: (Direction) -> Unit,
    onReset: () -> Unit,
    onPause: () -> Unit,
    onFormation: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(8.dp),
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Header(snapshot, onPause, onFormation)
            Battlefield(
                snapshot = snapshot,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.43f),
            )
            HpStrip(snapshot)
            GameBoard(
                snapshot = snapshot,
                onMove = onMove,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.48f),
            )
        }

        if (paused) PauseOverlay(onResume = onPause, onReset = onReset)
        snapshot.gameOverReason?.let { reason ->
            GameOverOverlay(
                reason = reason,
                score = snapshot.score,
                maxTile = snapshot.board.maxOrNull() ?: 0,
                onReset = onReset,
            )
        }
    }
}

@Composable
private fun Header(snapshot: GameSnapshot, onPause: () -> Unit, onFormation: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StatCell("HP", "${snapshot.currentHp}/${snapshot.maxHp}", Modifier.weight(1.6f))
        StatCell("WAVE", snapshot.wave.toString(), Modifier.weight(0.8f))
        StatCell("SCORE", snapshot.score.toString(), Modifier.weight(1.0f))
        Button(onClick = onFormation, modifier = Modifier.height(46.dp)) { Text("編成", fontSize = 11.sp) }
        Button(onClick = onPause, modifier = Modifier.height(46.dp)) { Text("Ⅱ", fontSize = 13.sp) }
    }
}

@Composable
private fun StatCell(label: String, value: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.height(46.dp),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = PanelBackground),
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(label, color = Color(0xFF94A3B8), fontSize = 8.sp)
            Text(value, fontWeight = FontWeight.Bold, fontSize = 12.sp, maxLines = 1)
        }
    }
}

@Composable
private fun Battlefield(snapshot: GameSnapshot, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = PanelBackground),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(5.dp)
                .background(AppBackground, RoundedCornerShape(14.dp)),
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                drawBattlefield(snapshot)
            }

            snapshot.bossWarning?.let { warning ->
                Text(
                    text = "BOSS WARNING  ${warning.remainingSeconds.toInt() + 1}s  ${handLabel(warning.handType)}",
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 6.dp)
                        .background(Color(0xCC3B0764), RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                )
            }

            Text(
                text = "敵は上から ↓",
                modifier = Modifier.align(Alignment.TopStart).padding(6.dp),
                color = Color(0xFF94A3B8),
                fontSize = 9.sp,
            )
            Text(
                text = "DEFENSE LINE",
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 3.dp),
                color = HpColor,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

private fun DrawScope.drawBattlefield(snapshot: GameSnapshot) {
    val laneWidth = size.width / 4f
    val rowBandHeight = size.height / 4f

    for (row in 0 until 4) {
        val alpha = 0.10f - row * 0.015f
        drawRect(
            color = if (row < 2) RockColor.copy(alpha = alpha) else PaperColor.copy(alpha = 0.04f + row * 0.01f),
            topLeft = Offset(0f, row * rowBandHeight),
            size = Size(size.width, rowBandHeight),
        )
    }

    for (lane in 1 until 4) {
        val x = lane * laneWidth
        drawLine(Color(0xFF334155), Offset(x, 0f), Offset(x, size.height), strokeWidth = 2f)
    }

    val bossX = size.width * 0.5f
    drawLine(
        color = if (snapshot.bossWarning != null) WarningColor else BossColor.copy(alpha = 0.45f),
        start = Offset(bossX, 0f),
        end = Offset(bossX, size.height),
        strokeWidth = if (snapshot.bossWarning != null) 8f else 4f,
    )

    drawLine(
        color = HpColor,
        start = Offset(0f, size.height - 2f),
        end = Offset(size.width, size.height - 2f),
        strokeWidth = 4f,
    )

    snapshot.board.indices.forEach { cellIndex ->
        val tileValue = snapshot.board[cellIndex]
        val character = snapshot.formation[cellIndex]
        val (nx, ny) = GameEngine.nodePosition(cellIndex)
        val center = Offset(size.width * nx, size.height * ny)
        val active = tileValue > 0
        drawCircle(
            color = handColor(character.handType).copy(alpha = if (active) 0.90f else 0.20f),
            radius = if (active) 10f else 6f,
            center = center,
        )
        if (active) {
            drawTextNative(
                text = tileValue.toString(),
                x = center.x,
                y = center.y - 13f,
                color = Color.White,
                textSize = 20f,
            )
        }
    }

    snapshot.projectiles.forEach { projectile ->
        drawCircle(
            color = handColor(projectile.handType),
            radius = 6f,
            center = Offset(size.width * projectile.x, size.height * projectile.y),
        )
    }

    snapshot.enemies.forEach { enemy ->
        val x = size.width * GameEngine.enemyX(enemy)
        val y = size.height * enemy.progress
        val center = Offset(x, y)
        val radius = if (enemy.enemyType == EnemyType.BOSS) min(size.width, size.height) * 0.075f else min(size.width, size.height) * 0.035f
        val enemyColor = if (enemy.enemyType == EnemyType.BOSS) BossColor else handColor(enemy.handType)
        drawCircle(color = enemyColor, radius = radius, center = center)
        if (enemy.slowRemainingSeconds > 0f) {
            drawCircle(color = ScissorsColor.copy(alpha = 0.35f), radius = radius * 1.25f, center = center)
        }
        val hpRatio = (enemy.hp / enemy.maxHp).coerceIn(0f, 1f)
        val barWidth = radius * 2.4f
        val barTop = center.y - radius - 10f
        drawRect(Color(0xFF334155), Offset(center.x - barWidth / 2, barTop), Size(barWidth, 5f))
        drawRect(HpColor, Offset(center.x - barWidth / 2, barTop), Size(barWidth * hpRatio, 5f))
        if (enemy.enemyType == EnemyType.BOSS) {
            drawTextNative("BOSS ${enemy.hp.toInt()}", center.x, barTop - 5f, Color.White, 22f)
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
private fun HpStrip(snapshot: GameSnapshot) {
    val ratio = if (snapshot.maxHp == 0) 0f else snapshot.currentHp.toFloat() / snapshot.maxHp
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("TOTAL HP", color = Color(0xFF94A3B8), fontSize = 9.sp)
            Text("${snapshot.currentHp} / ${snapshot.maxHp}", fontSize = 9.sp, fontWeight = FontWeight.Bold)
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .background(Color(0xFF334155), RoundedCornerShape(5.dp)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(ratio.coerceIn(0f, 1f))
                    .height(8.dp)
                    .background(if (ratio < 0.25f) RockColor else HpColor, RoundedCornerShape(5.dp)),
            )
        }
    }
}

@Composable
private fun GameBoard(snapshot: GameSnapshot, onMove: (Direction) -> Unit, modifier: Modifier = Modifier) {
    var dragX by remember { mutableStateOf(0f) }
    var dragY by remember { mutableStateOf(0f) }

    Card(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = PanelBackground),
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(7.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("2048 BOARD", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Text(
                    if (snapshot.mergeBurst > 0) "MERGE +${snapshot.mergeBurst}" else "数字×位置×キャラ",
                    color = if (snapshot.mergeBurst > 0) WarningColor else Color(0xFF94A3B8),
                    fontSize = 10.sp,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth().weight(1f),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                RowBonusColumn(Modifier.width(45.dp).fillMaxSize())
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxSize()
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
                                        if (abs(dragX) > abs(dragY)) onMove(if (dragX > 0) Direction.RIGHT else Direction.LEFT)
                                        else onMove(if (dragY > 0) Direction.DOWN else Direction.UP)
                                    }
                                    dragX = 0f; dragY = 0f
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
                                TileCell(
                                    value = snapshot.board[index],
                                    character = snapshot.formation[index],
                                    bossColumn = col == 1 || col == 2,
                                    modifier = Modifier.weight(1f).fillMaxSize(),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RowBonusColumn(modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(4) { row ->
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .background(Color(0xFF1E293B), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("ATK", color = if (row < 2) RockColor else Color(0xFF94A3B8), fontSize = 7.sp)
                    Text("×${formatMultiplier(FormationRules.rowAttackMultiplier[row])}", fontSize = 8.sp, fontWeight = FontWeight.Bold)
                    Text("HP×${formatMultiplier(FormationRules.rowHpMultiplier[row])}", color = if (row >= 2) HpColor else Color(0xFF94A3B8), fontSize = 7.sp)
                }
            }
        }
    }
}

@Composable
private fun TileCell(value: Int, character: CharacterDefinition, bossColumn: Boolean, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(10.dp)
    Box(
        modifier = modifier
            .background(tileColor(value), shape)
            .border(if (bossColumn) 2.dp else 1.dp, handColor(character.handType), shape),
    ) {
        Text(
            text = handShort(character.handType),
            modifier = Modifier.align(Alignment.TopStart).padding(4.dp),
            color = handColor(character.handType),
            fontSize = 8.sp,
            fontWeight = FontWeight.Black,
        )
        if (bossColumn) {
            Text("B", modifier = Modifier.align(Alignment.TopEnd).padding(4.dp), color = BossColor, fontSize = 7.sp, fontWeight = FontWeight.Black)
        }
        if (value > 0) {
            Text(
                value.toString(),
                modifier = Modifier.align(Alignment.Center),
                color = if (value <= 4) Color(0xFF111827) else Color.White,
                fontSize = when { value < 100 -> 22.sp; value < 1000 -> 18.sp; else -> 15.sp },
                fontWeight = FontWeight.Black,
            )
        }
        Text(
            character.name.take(2),
            modifier = Modifier.align(Alignment.BottomEnd).padding(4.dp),
            color = if (value == 0) Color(0xFF94A3B8) else Color.White.copy(alpha = 0.82f),
            fontSize = 7.sp,
        )
    }
}

@Composable
private fun FormationScreen(
    formation: List<CharacterDefinition>,
    onFormationChange: (List<CharacterDefinition>) -> Unit,
    onSave: () -> Unit,
    onCancel: () -> Unit,
) {
    var selected by remember { mutableStateOf<Int?>(null) }
    val maxHp = FormationRules.maxHp(formation)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("16セル編成", fontSize = 22.sp, fontWeight = FontWeight.Black)
                Text("2セルを順にタップするとキャラを交換", color = Color(0xFF94A3B8), fontSize = 10.sp)
            }
            Text("総HP $maxHp", color = HpColor, fontWeight = FontWeight.Bold)
        }

        Row(modifier = Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            RowBonusColumn(Modifier.width(52.dp).fillMaxSize())
            Column(modifier = Modifier.weight(1f).fillMaxSize(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                repeat(4) { row ->
                    Row(modifier = Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        repeat(4) { col ->
                            val index = GameRules.cellIndex(row, col)
                            val character = formation[index]
                            val shape = RoundedCornerShape(12.dp)
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxSize()
                                    .background(Color(0xFF172033), shape)
                                    .border(if (selected == index) 3.dp else 1.dp, if (selected == index) WarningColor else handColor(character.handType), shape)
                                    .clickable {
                                        val first = selected
                                        if (first == null) selected = index
                                        else if (first == index) selected = null
                                        else {
                                            val next = formation.toMutableList()
                                            val temp = next[first]
                                            next[first] = next[index]
                                            next[index] = temp
                                            onFormationChange(next)
                                            selected = null
                                        }
                                    }
                                    .padding(5.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                            ) {
                                Text(character.name, fontSize = 10.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                                Text(handLabel(character.handType), color = handColor(character.handType), fontSize = 8.sp)
                                Text("HP ${character.baseHp}", fontSize = 8.sp)
                                Text("ATK ×${formatMultiplier(character.attackCoefficient)}", fontSize = 8.sp)
                                if (character.ability != CharacterAbility.NONE) {
                                    Text(abilityLabel(character.ability), color = BossColor, fontSize = 7.sp, textAlign = TextAlign.Center)
                                }
                                if (col == 1 || col == 2) Text("BOSS列", color = BossColor, fontSize = 7.sp)
                            }
                        }
                    }
                }
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onCancel, modifier = Modifier.weight(1f)) { Text("戻る") }
            Button(onClick = onSave, modifier = Modifier.weight(1f)) { Text("保存して開始") }
        }
    }
}

@Composable
private fun PauseOverlay(onResume: () -> Unit, onReset: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize().background(Color(0xCC050816)), contentAlignment = Alignment.Center) {
        Card(colors = CardDefaults.cardColors(containerColor = PanelBackground), shape = RoundedCornerShape(18.dp)) {
            Column(modifier = Modifier.padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("PAUSE", fontSize = 24.sp, fontWeight = FontWeight.Black)
                Button(onClick = onResume, modifier = Modifier.fillMaxWidth()) { Text("再開") }
                Button(onClick = onReset, modifier = Modifier.fillMaxWidth()) { Text("リトライ") }
            }
        }
    }
}

@Composable
private fun GameOverOverlay(reason: GameOverReason, score: Int, maxTile: Int, onReset: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize().background(Color(0xDD050816)), contentAlignment = Alignment.Center) {
        Card(colors = CardDefaults.cardColors(containerColor = PanelBackground), shape = RoundedCornerShape(18.dp)) {
            Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("GAME OVER", fontSize = 25.sp, fontWeight = FontWeight.Black)
                Text(if (reason == GameOverReason.HP_ZERO) "総HPが0になりました" else "2048盤面が詰まりました", color = Color(0xFFCBD5E1))
                Text("Score $score / Max $maxTile", color = Color(0xFF94A3B8))
                Spacer(Modifier.height(2.dp))
                Button(onClick = onReset) { Text("RETRY") }
            }
        }
    }
}

private fun handColor(handType: HandType): Color = when (handType) {
    HandType.ROCK -> RockColor
    HandType.SCISSORS -> ScissorsColor
    HandType.PAPER -> PaperColor
}

private fun handLabel(handType: HandType): String = when (handType) {
    HandType.ROCK -> "グー"
    HandType.SCISSORS -> "チョキ"
    HandType.PAPER -> "パー"
}

private fun handShort(handType: HandType): String = when (handType) {
    HandType.ROCK -> "G"
    HandType.SCISSORS -> "C"
    HandType.PAPER -> "P"
}

private fun abilityLabel(ability: CharacterAbility): String = when (ability) {
    CharacterAbility.NONE -> ""
    CharacterAbility.BOSS_BONUS -> "BOSS+"
    CharacterAbility.SLOW -> "SLOW"
}

private fun formatMultiplier(value: Float): String = String.format("%.2f", value)

private fun tileColor(value: Int): Color = when (value) {
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
