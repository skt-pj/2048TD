package com.sktpj.td2048

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale
import kotlin.math.abs
import kotlin.math.min

internal val UiBackground = Color(0xFF080A0E)
internal val UiPanel = Color(0xFF12161D)
internal val UiPanelRaised = Color(0xFF1A202A)
internal val UiPanelDeep = Color(0xFF090C11)
internal val UiBorder = Color(0xFF4A4F57)
internal val UiGold = Color(0xFFD49B39)
internal val UiGoldSoft = Color(0xFF7C5A25)
internal val UiText = Color(0xFFF5F2E9)
internal val UiMuted = Color(0xFF9DA6B2)
internal val UiRock = Color(0xFFE4573D)
internal val UiScissors = Color(0xFF4C8FF0)
internal val UiPaper = Color(0xFF48B96A)
internal val UiBoss = Color(0xFFC14BFF)
internal val UiHp = Color(0xFF5EDB65)
internal val UiDanger = Color(0xFFFF5A4E)
internal val UiWarning = Color(0xFFFFB52E)
internal val UiGood = Color(0xFF62E69A)

internal data class GameSettings(
    val soundVolume: Float = 0.70f,
    val vibrationEnabled: Boolean = true,
    val simpleEffects: Boolean = false,
)

internal fun handColor(handType: HandType): Color = when (handType) {
    HandType.ROCK -> UiRock
    HandType.SCISSORS -> UiScissors
    HandType.PAPER -> UiPaper
}

internal fun handLabel(handType: HandType): String = when (handType) {
    HandType.ROCK -> "グー"
    HandType.SCISSORS -> "チョキ"
    HandType.PAPER -> "パー"
}

internal fun handRoleLabel(handType: HandType): String = when (handType) {
    HandType.ROCK -> "グー  > チョキ / < パー"
    HandType.SCISSORS -> "チョキ > パー / < グー"
    HandType.PAPER -> "パー > グー / < チョキ"
}

internal fun abilityLabel(ability: CharacterAbility): String = when (ability) {
    CharacterAbility.NONE -> "能力なし"
    CharacterAbility.BOSS_BONUS -> "BOSS BONUS"
    CharacterAbility.SLOW -> "SLOW"
}

internal fun formatMultiplier(value: Float): String = String.format(Locale.US, "%.2f", value)

internal fun tileColor(value: Int): Color = when (value) {
    0 -> Color(0xFF20242B)
    2 -> Color(0xFFE8DBC4)
    4 -> Color(0xFFE1C79F)
    8 -> Color(0xFFF09B43)
    16 -> Color(0xFFE66A3E)
    32 -> Color(0xFFCE7334)
    64 -> Color(0xFF9652A7)
    128 -> Color(0xFF3D789B)
    256 -> Color(0xFF356E90)
    512 -> Color(0xFF584B8E)
    1024 -> Color(0xFF74479B)
    2048 -> Color(0xFFA34B9E)
    else -> Color(0xFFB64D5D)
}

internal fun tileTextColor(value: Int): Color = if (value <= 4) Color(0xFF2D251C) else Color.White

@Composable
internal fun HandIcon(
    handType: HandType,
    modifier: Modifier = Modifier,
    tint: Color = handColor(handType),
) {
    Canvas(modifier = modifier) {
        val d = min(size.width, size.height)
        val stroke = (d * 0.10f).coerceAtLeast(1.5f)
        when (handType) {
            HandType.ROCK -> {
                drawCircle(tint, radius = d * 0.27f, center = Offset(size.width * 0.50f, size.height * 0.60f))
                val r = d * 0.105f
                listOf(0.30f, 0.44f, 0.58f, 0.70f).forEachIndexed { index, x ->
                    drawCircle(
                        color = tint,
                        radius = r,
                        center = Offset(size.width * x, size.height * (0.34f + if (index % 2 == 0) 0.01f else 0f)),
                    )
                }
            }
            HandType.SCISSORS -> {
                drawCircle(tint, radius = d * 0.13f, center = Offset(size.width * 0.37f, size.height * 0.72f), style = Stroke(stroke))
                drawCircle(tint, radius = d * 0.13f, center = Offset(size.width * 0.63f, size.height * 0.72f), style = Stroke(stroke))
                drawLine(tint, Offset(size.width * 0.46f, size.height * 0.62f), Offset(size.width * 0.28f, size.height * 0.22f), stroke)
                drawLine(tint, Offset(size.width * 0.54f, size.height * 0.62f), Offset(size.width * 0.72f, size.height * 0.22f), stroke)
                drawLine(tint, Offset(size.width * 0.46f, size.height * 0.57f), Offset(size.width * 0.68f, size.height * 0.36f), stroke * 0.8f)
                drawLine(tint, Offset(size.width * 0.54f, size.height * 0.57f), Offset(size.width * 0.32f, size.height * 0.36f), stroke * 0.8f)
            }
            HandType.PAPER -> {
                drawRoundRect(
                    color = tint,
                    topLeft = Offset(size.width * 0.25f, size.height * 0.25f),
                    size = Size(size.width * 0.50f, size.height * 0.55f),
                    cornerRadius = CornerRadius(d * 0.10f, d * 0.10f),
                    style = Stroke(stroke),
                )
                for (i in 1..3) {
                    val x = size.width * (0.25f + i * 0.125f)
                    drawLine(tint, Offset(x, size.height * 0.28f), Offset(x, size.height * 0.53f), stroke * 0.45f)
                }
                drawLine(tint, Offset(size.width * 0.28f, size.height * 0.62f), Offset(size.width * 0.50f, size.height * 0.72f), stroke * 0.55f)
            }
        }
    }
}

@Composable
internal fun CharacterAvatar(
    character: CharacterDefinition,
    modifier: Modifier = Modifier,
    muted: Boolean = false,
    size: Dp = 40.dp,
) {
    val accent = handColor(character.handType)
    val alpha = if (muted) 0.38f else 1f
    val variant = abs(character.characterId.hashCode()) % 5

    Box(
        modifier = modifier
            .size(size)
            .background(
                brush = Brush.radialGradient(
                    colors = listOf(accent.copy(alpha = 0.38f * alpha), UiPanelDeep),
                ),
                shape = CircleShape,
            )
            .border(1.5.dp, accent.copy(alpha = 0.92f * alpha), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .padding(if (size <= 28.dp) 2.dp else 3.dp),
        ) {
            val w = this.size.width
            val h = this.size.height
            val skin = when (variant) {
                0 -> Color(0xFFF4C39B)
                1 -> Color(0xFFDDA57C)
                2 -> Color(0xFFF0B990)
                3 -> Color(0xFFC98D68)
                else -> Color(0xFFE7AF83)
            }.copy(alpha = alpha)
            val hair = when (variant) {
                0 -> accent.copy(alpha = 0.95f * alpha)
                1 -> Color(0xFF252934).copy(alpha = alpha)
                2 -> Color(0xFFE5D2A3).copy(alpha = alpha)
                3 -> Color(0xFF5A3425).copy(alpha = alpha)
                else -> accent.copy(alpha = 0.72f * alpha)
            }
            val armor = accent.copy(alpha = 0.82f * alpha)

            drawOval(
                color = armor,
                topLeft = Offset(w * 0.18f, h * 0.66f),
                size = Size(w * 0.64f, h * 0.38f),
            )
            drawCircle(
                color = skin,
                radius = min(w, h) * 0.23f,
                center = Offset(w * 0.50f, h * 0.48f),
            )

            when (variant) {
                0 -> {
                    val p = Path().apply {
                        moveTo(w * 0.25f, h * 0.43f)
                        lineTo(w * 0.33f, h * 0.20f)
                        lineTo(w * 0.48f, h * 0.29f)
                        lineTo(w * 0.60f, h * 0.17f)
                        lineTo(w * 0.75f, h * 0.43f)
                        lineTo(w * 0.67f, h * 0.36f)
                        lineTo(w * 0.50f, h * 0.31f)
                        close()
                    }
                    drawPath(p, hair)
                }
                1 -> {
                    drawArc(
                        color = hair,
                        startAngle = 185f,
                        sweepAngle = 170f,
                        useCenter = true,
                        topLeft = Offset(w * 0.22f, h * 0.18f),
                        size = Size(w * 0.56f, h * 0.58f),
                    )
                    drawRect(hair, Offset(w * 0.20f, h * 0.39f), Size(w * 0.13f, h * 0.34f))
                    drawRect(hair, Offset(w * 0.67f, h * 0.39f), Size(w * 0.13f, h * 0.34f))
                }
                2 -> {
                    val p = Path().apply {
                        moveTo(w * 0.24f, h * 0.41f)
                        lineTo(w * 0.31f, h * 0.17f)
                        lineTo(w * 0.44f, h * 0.26f)
                        lineTo(w * 0.52f, h * 0.14f)
                        lineTo(w * 0.60f, h * 0.27f)
                        lineTo(w * 0.74f, h * 0.20f)
                        lineTo(w * 0.76f, h * 0.43f)
                        close()
                    }
                    drawPath(p, hair)
                }
                3 -> {
                    drawArc(
                        color = hair,
                        startAngle = 180f,
                        sweepAngle = 180f,
                        useCenter = true,
                        topLeft = Offset(w * 0.22f, h * 0.16f),
                        size = Size(w * 0.56f, h * 0.62f),
                    )
                    drawCircle(hair, w * 0.10f, Offset(w * 0.78f, h * 0.27f))
                }
                else -> {
                    drawArc(
                        color = hair,
                        startAngle = 195f,
                        sweepAngle = 150f,
                        useCenter = true,
                        topLeft = Offset(w * 0.21f, h * 0.15f),
                        size = Size(w * 0.58f, h * 0.62f),
                    )
                    drawLine(hair, Offset(w * 0.31f, h * 0.30f), Offset(w * 0.22f, h * 0.58f), w * 0.06f)
                    drawLine(hair, Offset(w * 0.69f, h * 0.30f), Offset(w * 0.78f, h * 0.58f), w * 0.06f)
                }
            }

            val eyeColor = UiPanelDeep.copy(alpha = alpha)
            drawCircle(eyeColor, radius = w * 0.025f, center = Offset(w * 0.42f, h * 0.49f))
            drawCircle(eyeColor, radius = w * 0.025f, center = Offset(w * 0.58f, h * 0.49f))
            drawLine(
                color = Color(0xFF9B5F54).copy(alpha = 0.75f * alpha),
                start = Offset(w * 0.45f, h * 0.60f),
                end = Offset(w * 0.55f, h * 0.60f),
                strokeWidth = (w * 0.025f).coerceAtLeast(1f),
            )
            drawLine(
                color = UiGold.copy(alpha = 0.72f * alpha),
                start = Offset(w * 0.28f, h * 0.77f),
                end = Offset(w * 0.72f, h * 0.77f),
                strokeWidth = (w * 0.035f).coerceAtLeast(1f),
            )
        }

        HandIcon(
            handType = character.handType,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .size(if (size <= 28.dp) 10.dp else 14.dp)
                .background(UiPanelDeep.copy(alpha = 0.94f), CircleShape),
            tint = accent.copy(alpha = alpha),
        )
    }
}

@Composable
internal fun AbilityBadge(
    ability: CharacterAbility,
    modifier: Modifier = Modifier,
) {
    if (ability == CharacterAbility.NONE) return
    val text = when (ability) {
        CharacterAbility.BOSS_BONUS -> "B+"
        CharacterAbility.SLOW -> "S"
        CharacterAbility.NONE -> ""
    }
    val color = if (ability == CharacterAbility.BOSS_BONUS) UiBoss else UiScissors
    Box(
        modifier = modifier
            .background(color.copy(alpha = 0.18f), RoundedCornerShape(5.dp))
            .border(1.dp, color.copy(alpha = 0.75f), RoundedCornerShape(5.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = color, fontSize = 7.sp, fontWeight = FontWeight.Black)
    }
}
