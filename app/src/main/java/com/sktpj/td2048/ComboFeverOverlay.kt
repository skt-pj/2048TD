package com.sktpj.td2048

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.ceil
import kotlin.math.min
import kotlin.math.sin

private val FeverPanel = Color(0xE6060A0F)
private val FeverCyan = Color(0xFF00F5FF)
private val FeverPink = Color(0xFFFF35D3)
private val FeverText = Color(0xFFF4FBFF)
private val FeverMuted = Color(0xFFA4B7C2)

@Composable
internal fun ComboFeverOverlay(
    state: ComboFeverSnapshot,
    simpleEffects: Boolean,
) {
    var seenFeverCount by remember { mutableIntStateOf(state.feverCount) }
    val feverFlash = remember { Animatable(1f) }
    val transition = rememberInfiniteTransition(label = "fever-vector-transition")
    val vectorPhase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1050, easing = LinearEasing),
        ),
        label = "fever-vector-phase",
    )

    LaunchedEffect(state.feverCount) {
        if (state.feverCount < seenFeverCount) {
            seenFeverCount = state.feverCount
            feverFlash.snapTo(1f)
        } else if (state.feverCount > seenFeverCount) {
            seenFeverCount = state.feverCount
            feverFlash.snapTo(0f)
            feverFlash.animateTo(
                targetValue = 1f,
                animationSpec = tween(durationMillis = if (simpleEffects) 420 else 780),
            )
        }
    }

    val flashWave = sin((feverFlash.value * PI).toFloat()).coerceIn(0f, 1f)

    Box(modifier = Modifier.fillMaxSize()) {
        if (state.feverActive || flashWave > 0.01f) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val center = Offset(size.width / 2f, size.height * 0.46f)
                val baseRadius = min(size.width, size.height) * 0.22f
                val activeAlpha = if (state.feverActive) 1f else flashWave

                drawVectorRadialGlow(
                    center = center,
                    radius = baseRadius * (1.85f + 0.20f * vectorPhase),
                    color = FeverPink.copy(alpha = activeAlpha),
                    simpleEffects = simpleEffects,
                )

                if (state.feverActive) {
                    val ringRadius = baseRadius * (1.0f + 0.14f * vectorPhase)
                    drawCircle(
                        color = FeverPink.copy(alpha = if (simpleEffects) 0.42f else 0.72f),
                        radius = ringRadius,
                        center = center,
                        style = Stroke(width = if (simpleEffects) 2f else 3f),
                    )
                    drawVectorReticle(
                        center = center,
                        color = FeverPink,
                        radius = ringRadius * 1.18f,
                        phase = vectorPhase,
                        simpleEffects = simpleEffects,
                    )
                    if (!simpleEffects) {
                        drawVectorSparkBurst(
                            center = center,
                            color = FeverPink,
                            radius = baseRadius * 1.50f,
                            phase = vectorPhase,
                            simpleEffects = false,
                        )
                    }
                }

                if (flashWave > 0.01f) {
                    val shockRadius = baseRadius * (0.45f + feverFlash.value * 2.0f)
                    drawCircle(
                        color = FeverPink.copy(alpha = 0.90f * flashWave),
                        radius = shockRadius,
                        center = center,
                        style = Stroke(width = 3.5f + 5f * flashWave),
                    )
                    if (!simpleEffects) {
                        drawCircle(
                            color = FeverCyan.copy(alpha = 0.45f * flashWave),
                            radius = shockRadius * 0.78f,
                            center = center,
                            style = Stroke(width = 2.5f),
                        )
                    }
                }

                if (state.feverActive) {
                    val edgeAlpha = if (simpleEffects) 0.22f else 0.42f
                    drawRect(
                        color = FeverPink.copy(alpha = edgeAlpha),
                        style = Stroke(width = if (simpleEffects) 2f else 3.5f),
                    )
                }
            }
        }

        Column(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(start = 10.dp, top = 66.dp)
                .width(118.dp)
                .background(FeverPanel, RoundedCornerShape(9.dp))
                .border(
                    1.dp,
                    if (state.feverActive) FeverPink.copy(alpha = 0.92f) else FeverCyan.copy(alpha = 0.55f),
                    RoundedCornerShape(9.dp),
                )
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalAlignment = Alignment.Start,
        ) {
            Text(
                text = if (state.combo > 0) "COMBO ${state.combo}" else "COMBO -",
                color = if (state.combo > 0) FeverText else FeverMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
            )
            Text(
                text = if (state.feverActive) {
                    "FEVER ${ceil(state.feverRemainingSeconds).toInt()}s"
                } else {
                    "FEVER ${state.feverGaugeTiles}/${ComboFeverRules.FEVER_TARGET_TILES}"
                },
                color = if (state.feverActive) FeverPink else FeverCyan,
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 4.dp),
            )
            Box(
                modifier = Modifier
                    .padding(top = 3.dp)
                    .fillMaxWidth()
                    .height(7.dp)
                    .background(Color(0xFF101820), RoundedCornerShape(4.dp)),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(state.feverGaugeRatio)
                        .fillMaxHeight()
                        .background(
                            Brush.horizontalGradient(
                                colors = if (state.feverActive) {
                                    listOf(FeverCyan, FeverPink, Color.White)
                                } else {
                                    listOf(FeverCyan.copy(alpha = 0.72f), FeverCyan)
                                },
                            ),
                            RoundedCornerShape(4.dp),
                        ),
                )
            }
        }

        if (flashWave > 0.01f) {
            Text(
                text = "FEVER!",
                modifier = Modifier
                    .align(Alignment.Center)
                    .width(230.dp)
                    .graphicsLayer {
                        alpha = flashWave
                        scaleX = 0.82f + 0.30f * flashWave
                        scaleY = 0.82f + 0.30f * flashWave
                    }
                    .background(Color(0xC9020406), RoundedCornerShape(14.dp))
                    .border(2.dp, FeverPink.copy(alpha = flashWave), RoundedCornerShape(14.dp))
                    .padding(vertical = 11.dp),
                color = FeverPink,
                fontSize = 36.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
            )
        }
    }
}
