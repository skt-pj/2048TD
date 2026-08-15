package com.sktpj.td2048

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
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
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale
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
    Box(
        modifier = modifier
            .size(size)
            .background(
                brush = Brush.radialGradient(
                    colors = listOf(
                        accent.copy(alpha = if (muted) 0.20f else 0.55f),
                        UiPanelDeep,
                    ),
                ),
                shape = CircleShape,
            )
            .border(1.5.dp, accent.copy(alpha = if (muted) 0.35f else 0.95f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = character.name.take(1),
            color = if (muted) UiMuted.copy(alpha = 0.55f) else UiText,
            fontSize = if (size <= 28.dp) 10.sp else 15.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
        HandIcon(
            handType = character.handType,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .size(if (size <= 28.dp) 10.dp else 14.dp)
                .background(UiPanelDeep.copy(alpha = 0.92f), CircleShape),
            tint = accent,
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
