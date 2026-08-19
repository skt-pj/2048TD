package com.sktpj.td2048

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

private val TsumHudWhite = Color(0xFFF8FCFF)
private val TsumHudCyan = Color(0xFF75E9FF)
private val TsumHudBlue = Color(0xFF398DDA)
private val TsumHudNavy = Color(0xFF0B2745)
private val TsumHudGold = Color(0xFFFFD84D)
private val TsumHudPink = Color(0xFFFF4FCF)
private val TsumGaugeTrack = Color(0xDD071D2D)

/**
 * Layout proportions are based on repeated LINE Disney Tsum Tsum gameplay captures:
 * - COMBO is a stacked number/label block at the upper-right of the playfield.
 * - the FEVER meter is a thick capsule centered at the bottom of the playfield, roughly half width.
 * - FEVER remaining time is communicated by the draining meter, not by a seconds label.
 *
 * This HUD is mounted inside Battlefield, so none of it can cover the 2048 input board.
 */
@Composable
internal fun TsumReferenceBattleHud(
    state: ComboFeverSnapshot,
    simpleEffects: Boolean,
    modifier: Modifier = Modifier,
) {
    var seenComboEventId by remember { mutableIntStateOf(state.comboEventId) }
    var displayedCombo by remember { mutableIntStateOf(0) }
    val comboAlpha = remember { Animatable(0f) }
    val comboScale = remember { Animatable(1f) }

    LaunchedEffect(state.comboEventId) {
        if (state.comboEventId <= seenComboEventId) return@LaunchedEffect
        seenComboEventId = state.comboEventId
        val target = state.combo.coerceAtLeast(1)

        if (simpleEffects) {
            displayedCombo = target
            comboScale.snapTo(1f)
            comboAlpha.snapTo(1f)
            delay(430)
            comboAlpha.animateTo(0f, tween(150))
        } else {
            for (count in 1..target) {
                displayedCombo = count
                comboAlpha.snapTo(1f)
                comboScale.snapTo(0.86f)
                comboScale.animateTo(
                    targetValue = 1.06f,
                    animationSpec = tween(durationMillis = 80, easing = FastOutSlowInEasing),
                )
                comboScale.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(durationMillis = 70, easing = FastOutSlowInEasing),
                )
                if (count < target) delay(40)
            }
            delay(if (target >= 4) 470 else 360)
            comboAlpha.animateTo(0f, tween(160))
        }
    }

    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val compact = maxWidth < 340.dp
        val comboNumberSize = if (compact) 32.sp else 36.sp
        val comboLabelSize = if (compact) 11.sp else 13.sp
        val feverLabelSize = if (compact) 12.sp else 14.sp
        val gaugeLabelSize = if (compact) 14.sp else 16.sp
        val gaugeHeight = if (compact) 30.dp else 34.dp

        if (comboAlpha.value > 0.001f && displayedCombo > 0) {
            Column(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 10.dp, end = 12.dp)
                    .graphicsLayer {
                        alpha = comboAlpha.value
                        scaleX = comboScale.value
                        scaleY = comboScale.value
                    },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = displayedCombo.toString(),
                    color = TsumHudWhite,
                    fontSize = comboNumberSize,
                    fontWeight = FontWeight.Black,
                    lineHeight = comboNumberSize,
                    textAlign = TextAlign.Center,
                    style = TextStyle(
                        shadow = Shadow(
                            color = TsumHudNavy,
                            offset = Offset(0f, 2f),
                            blurRadius = 5f,
                        ),
                    ),
                )
                Text(
                    text = "COMBO",
                    modifier = Modifier.offset(y = (-5).dp),
                    color = TsumHudCyan,
                    fontSize = comboLabelSize,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.35.sp,
                    textAlign = TextAlign.Center,
                    style = TextStyle(
                        shadow = Shadow(
                            color = TsumHudNavy,
                            offset = Offset(0f, 1f),
                            blurRadius = 4f,
                        ),
                    ),
                )
            }
        }

        if (state.feverActive) {
            Text(
                text = "FEVER",
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 11.dp),
                color = TsumHudGold,
                fontSize = feverLabelSize,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.6.sp,
                style = TextStyle(
                    shadow = Shadow(
                        color = TsumHudNavy,
                        offset = Offset(0f, 1.5f),
                        blurRadius = 5f,
                    ),
                ),
            )
        }

        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 8.dp)
                .fillMaxWidth(if (compact) 0.54f else 0.52f)
                .height(gaugeHeight)
                .background(TsumGaugeTrack, RoundedCornerShape(percent = 50))
                .border(
                    width = if (state.feverActive) 2.dp else 1.5.dp,
                    color = if (state.feverActive) TsumHudPink else TsumHudBlue,
                    shape = RoundedCornerShape(percent = 50),
                ),
        ) {
            Box(
                modifier = Modifier
                    .padding(4.dp)
                    .fillMaxWidth(state.feverGaugeRatio)
                    .fillMaxHeight()
                    .background(
                        brush = if (state.feverActive) {
                            Brush.horizontalGradient(
                                listOf(TsumHudPink, TsumHudGold, TsumHudCyan),
                            )
                        } else {
                            Brush.horizontalGradient(
                                listOf(TsumHudGold, TsumHudCyan),
                            )
                        },
                        shape = RoundedCornerShape(percent = 50),
                    ),
            )
            Text(
                text = "FEVER",
                modifier = Modifier.align(Alignment.Center),
                color = if (state.feverGaugeRatio > 0.38f || state.feverActive) {
                    TsumHudWhite
                } else {
                    TsumHudCyan.copy(alpha = 0.34f)
                },
                fontSize = gaugeLabelSize,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.8.sp,
                style = TextStyle(
                    shadow = Shadow(
                        color = TsumHudNavy,
                        offset = Offset(0f, 1f),
                        blurRadius = 4f,
                    ),
                ),
            )
        }
    }
}
