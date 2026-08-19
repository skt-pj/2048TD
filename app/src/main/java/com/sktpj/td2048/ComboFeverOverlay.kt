package com.sktpj.td2048

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.sin

private val FeverCyan = Color(0xFF00F5FF)
private val FeverPink = Color(0xFFFF35D3)
private val FeverWhite = Color(0xFFF7FCFF)
private val FeverTrack = Color(0xB8121A20)

/**
 * Result UI only. The bottom 46% of the screen is intentionally never drawn into so the 2048
 * board remains a clean input surface.
 */
@Composable
internal fun ComboFeverOverlay(
    state: ComboFeverSnapshot,
    simpleEffects: Boolean,
) {
    var seenComboEventId by remember { mutableIntStateOf(state.comboEventId) }
    var displayedCombo by remember { mutableIntStateOf(0) }
    val comboAlpha = remember { Animatable(0f) }
    val comboScale = remember { Animatable(1f) }

    var seenFeverCount by remember { mutableIntStateOf(state.feverCount) }
    val feverIntro = remember { Animatable(1f) }

    LaunchedEffect(state.comboEventId) {
        if (state.comboEventId <= seenComboEventId) return@LaunchedEffect
        seenComboEventId = state.comboEventId
        val target = state.combo.coerceAtLeast(1)

        if (simpleEffects) {
            displayedCombo = target
            comboScale.snapTo(1f)
            comboAlpha.snapTo(1f)
            delay(420)
            comboAlpha.animateTo(0f, tween(140))
        } else {
            for (count in 1..target) {
                displayedCombo = count
                comboAlpha.snapTo(1f)
                comboScale.snapTo(0.90f)
                comboScale.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(durationMillis = 95, easing = FastOutSlowInEasing),
                )
                if (count < target) delay(55)
            }
            delay(if (target >= 4) 430 else 330)
            comboAlpha.animateTo(0f, tween(170))
        }
    }

    LaunchedEffect(state.feverCount) {
        when {
            state.feverCount < seenFeverCount -> {
                seenFeverCount = state.feverCount
                feverIntro.snapTo(1f)
            }
            state.feverCount > seenFeverCount -> {
                seenFeverCount = state.feverCount
                feverIntro.snapTo(0f)
                feverIntro.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(
                        durationMillis = if (simpleEffects) 430 else 620,
                        easing = FastOutSlowInEasing,
                    ),
                )
            }
        }
    }

    val introWave = sin((feverIntro.value * PI).toFloat()).coerceIn(0f, 1f)

    Box(modifier = Modifier.fillMaxSize()) {
        // Everything expressive is clipped to the battlefield / status half of the screen.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.54f),
        ) {
            if (state.feverActive || introWave > 0.01f) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val center = Offset(size.width / 2f, size.height * 0.56f)
                    if (state.feverActive) {
                        drawRect(
                            brush = Brush.radialGradient(
                                colors = listOf(
                                    FeverPink.copy(alpha = if (simpleEffects) 0.055f else 0.095f),
                                    FeverCyan.copy(alpha = if (simpleEffects) 0.018f else 0.035f),
                                    Color.Transparent,
                                ),
                                center = center,
                                radius = size.width * 0.62f,
                            ),
                        )
                        drawRect(
                            brush = Brush.horizontalGradient(
                                listOf(Color.Transparent, FeverPink.copy(alpha = 0.46f), Color.Transparent),
                            ),
                            topLeft = Offset(0f, size.height - 2.5f),
                            size = Size(size.width, 2.5f),
                        )
                    }
                    if (introWave > 0.01f) {
                        drawRect(
                            brush = Brush.horizontalGradient(
                                listOf(
                                    Color.Transparent,
                                    FeverCyan.copy(alpha = 0.24f * introWave),
                                    FeverWhite.copy(alpha = 0.72f * introWave),
                                    FeverPink.copy(alpha = 0.30f * introWave),
                                    Color.Transparent,
                                ),
                            ),
                            topLeft = Offset(0f, center.y - 1.5f),
                            size = Size(size.width, 3f),
                        )
                    }
                }
            }

            // Tsum Tsum-like dedicated FEVER meter: compact, persistent, and outside the board.
            Column(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 62.dp)
                    .width(176.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "FEVER",
                    color = if (state.feverActive) FeverPink else FeverCyan.copy(alpha = 0.82f),
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.3.sp,
                )
                Box(
                    modifier = Modifier
                        .padding(top = 3.dp)
                        .fillMaxWidth()
                        .height(5.dp)
                        .background(FeverTrack, RoundedCornerShape(3.dp)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(state.feverGaugeRatio)
                            .fillMaxHeight()
                            .background(
                                if (state.feverActive) {
                                    Brush.horizontalGradient(listOf(FeverPink, FeverWhite, FeverCyan))
                                } else {
                                    Brush.horizontalGradient(
                                        listOf(FeverCyan.copy(alpha = 0.72f), FeverCyan),
                                    )
                                },
                                RoundedCornerShape(3.dp),
                            ),
                    )
                }
            }

            // Puzzle & Dragons-style result feedback: count belongs to the completed swipe, not to
            // a timer spanning multiple swipes. It appears after the move and never covers tiles.
            if (comboAlpha.value > 0.001f && displayedCombo > 0) {
                Row(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 16.dp)
                        .graphicsLayer {
                            alpha = comboAlpha.value
                            scaleX = comboScale.value
                            scaleY = comboScale.value
                        },
                    verticalAlignment = Alignment.Bottom,
                ) {
                    Text(
                        text = displayedCombo.toString(),
                        color = if (displayedCombo >= 4) FeverPink else FeverWhite,
                        fontSize = if (displayedCombo >= 4) 34.sp else 30.sp,
                        fontWeight = FontWeight.Black,
                    )
                    Text(
                        text = " COMBO",
                        modifier = Modifier.padding(bottom = 4.dp),
                        color = FeverCyan,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 0.8.sp,
                    )
                }
            }

            if (introWave > 0.01f) {
                Text(
                    text = "FEVER",
                    modifier = Modifier
                        .align(Alignment.Center)
                        .graphicsLayer {
                            alpha = introWave
                            scaleX = 0.90f + 0.12f * introWave
                            scaleY = 0.90f + 0.12f * introWave
                        },
                    color = FeverWhite,
                    fontSize = 31.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 3.sp,
                )
            }
        }
    }
}
