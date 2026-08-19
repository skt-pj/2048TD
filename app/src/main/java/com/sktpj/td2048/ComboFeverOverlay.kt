package com.sktpj.td2048

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import nl.dionsegijn.konfetti.compose.KonfettiView
import nl.dionsegijn.konfetti.core.Party
import nl.dionsegijn.konfetti.core.Position
import nl.dionsegijn.konfetti.core.Rotation
import nl.dionsegijn.konfetti.core.emitter.Emitter
import nl.dionsegijn.konfetti.core.models.Shape
import nl.dionsegijn.konfetti.core.models.Size as ParticleSize
import java.util.concurrent.TimeUnit
import kotlin.math.PI
import kotlin.math.sin

private val FeverCyan = Color(0xFF00F5FF)
private val FeverPink = Color(0xFFFF35D3)
private val FeverWhite = Color(0xFFF7FCFF)
private val FeverDeep = Color(0xFF100619)

private val FeverParticleCyan = 0xFF45F7FF.toInt()
private val FeverParticlePink = 0xFFFF48D8.toInt()
private val FeverParticleWhite = 0xFFF8FDFF.toInt()

/**
 * Global FEVER atmosphere only. The reference-sized COMBO and FEVER meter are mounted inside the
 * battlefield itself by TsumReferenceBattleHud so their positions are stable and never reach the
 * 2048 input board.
 */
@Composable
internal fun ComboFeverOverlay(
    state: ComboFeverSnapshot,
    simpleEffects: Boolean,
) {
    var seenFeverCount by remember { mutableIntStateOf(state.feverCount) }
    val feverIntro = remember { Animatable(1f) }
    val feverOutro = remember { Animatable(0f) }
    var wasFeverActive by remember { mutableStateOf(state.feverActive) }

    val ambientTransition = rememberInfiniteTransition(label = "fever-ambient")
    val ambientPulse by ambientTransition.animateFloat(
        initialValue = 0.48f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 520, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "fever-ambient-pulse",
    )
    val sweepPhase by ambientTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1150, easing = LinearEasing),
        ),
        label = "fever-energy-sweep",
    )

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
                        durationMillis = if (simpleEffects) 500 else 760,
                        easing = FastOutSlowInEasing,
                    ),
                )
            }
        }
    }

    LaunchedEffect(state.feverActive) {
        if (wasFeverActive && !state.feverActive && state.feverCount > 0) {
            feverOutro.snapTo(1f)
            feverOutro.animateTo(
                targetValue = 0f,
                animationSpec = tween(durationMillis = if (simpleEffects) 300 else 520),
            )
        }
        wasFeverActive = state.feverActive
    }

    val introWave = sin((feverIntro.value * PI).toFloat()).coerceIn(0f, 1f)
    val introFlash = (1f - feverIntro.value).coerceIn(0f, 1f)
    val endingSoon = if (state.feverActive) {
        ((3f - state.feverRemainingSeconds) / 3f).coerceIn(0f, 1f)
    } else {
        0f
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.54f),
        ) {
            if (state.feverActive || introWave > 0.01f || feverOutro.value > 0.01f) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val center = Offset(size.width / 2f, size.height * 0.55f)
                    val activeStrength = if (state.feverActive) {
                        if (simpleEffects) 0.72f else 0.78f + 0.22f * ambientPulse
                    } else {
                        0f
                    }

                    if (state.feverActive) {
                        drawRect(
                            brush = Brush.radialGradient(
                                colors = listOf(
                                    FeverPink.copy(alpha = 0.18f * activeStrength),
                                    FeverCyan.copy(alpha = 0.075f * activeStrength),
                                    FeverDeep.copy(alpha = 0.10f),
                                    Color.Transparent,
                                ),
                                center = center,
                                radius = size.width * 0.76f,
                            ),
                        )
                        drawRect(
                            brush = Brush.horizontalGradient(
                                colors = listOf(
                                    FeverPink.copy(alpha = 0.14f * activeStrength),
                                    Color.Transparent,
                                    Color.Transparent,
                                    FeverCyan.copy(alpha = 0.12f * activeStrength),
                                ),
                            ),
                        )

                        if (!simpleEffects) {
                            val sweepX = size.width * (sweepPhase * 1.30f - 0.15f)
                            drawRect(
                                brush = Brush.horizontalGradient(
                                    colors = listOf(
                                        Color.Transparent,
                                        FeverCyan.copy(alpha = 0.025f),
                                        FeverWhite.copy(alpha = 0.16f),
                                        FeverPink.copy(alpha = 0.055f),
                                        Color.Transparent,
                                    ),
                                    startX = sweepX - size.width * 0.18f,
                                    endX = sweepX + size.width * 0.18f,
                                ),
                                topLeft = Offset(sweepX - size.width * 0.18f, 0f),
                                size = Size(size.width * 0.36f, size.height),
                            )
                        }

                        val edgeAlpha = (0.42f + 0.30f * ambientPulse + 0.22f * endingSoon)
                            .coerceAtMost(0.94f)
                        drawRect(
                            FeverPink.copy(alpha = edgeAlpha),
                            topLeft = Offset.Zero,
                            size = Size(if (simpleEffects) 2f else 4f, size.height),
                        )
                        drawRect(
                            FeverCyan.copy(alpha = edgeAlpha),
                            topLeft = Offset(size.width - if (simpleEffects) 2f else 4f, 0f),
                            size = Size(if (simpleEffects) 2f else 4f, size.height),
                        )
                        drawRect(
                            brush = Brush.horizontalGradient(
                                listOf(
                                    FeverPink.copy(alpha = edgeAlpha),
                                    FeverWhite.copy(alpha = 0.78f * activeStrength),
                                    FeverCyan.copy(alpha = edgeAlpha),
                                ),
                            ),
                            topLeft = Offset(0f, size.height - if (simpleEffects) 2f else 4f),
                            size = Size(size.width, if (simpleEffects) 2f else 4f),
                        )

                        if (endingSoon > 0f) {
                            val warningAlpha = endingSoon * if (simpleEffects) 0.08f else 0.13f * ambientPulse
                            drawRect(FeverPink.copy(alpha = warningAlpha))
                        }
                    }

                    if (introWave > 0.01f || introFlash > 0.01f) {
                        val ringRadius = size.width * (0.18f + 0.34f * feverIntro.value)
                        drawCircle(
                            color = FeverWhite.copy(alpha = 0.76f * introWave),
                            radius = ringRadius,
                            center = center,
                            style = Stroke(width = if (simpleEffects) 2f else 5f),
                        )
                        if (!simpleEffects) {
                            drawCircle(
                                color = FeverPink.copy(alpha = 0.42f * introWave),
                                radius = ringRadius * 0.82f,
                                center = center,
                                style = Stroke(width = 10f),
                            )
                        }
                        drawRect(FeverWhite.copy(alpha = 0.12f * introFlash))
                    }

                    if (feverOutro.value > 0.01f) {
                        drawRect(
                            brush = Brush.horizontalGradient(
                                listOf(
                                    Color.Transparent,
                                    FeverPink.copy(alpha = 0.22f * feverOutro.value),
                                    FeverWhite.copy(alpha = 0.34f * feverOutro.value),
                                    FeverCyan.copy(alpha = 0.18f * feverOutro.value),
                                    Color.Transparent,
                                ),
                            ),
                            topLeft = Offset(0f, size.height * 0.55f),
                            size = Size(size.width, if (simpleEffects) 2f else 4f),
                        )
                    }
                }
            }

            if (state.feverActive && !simpleEffects) {
                key(state.feverCount) {
                    KonfettiView(
                        modifier = Modifier.fillMaxSize(),
                        parties = feverAmbientParties(),
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
                            scaleX = 0.84f + 0.30f * introWave
                            scaleY = 0.84f + 0.30f * introWave
                        },
                    color = FeverWhite,
                    fontSize = if (simpleEffects) 46.sp else 50.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 4.sp,
                )
            }

            if (feverOutro.value > 0.01f) {
                Text(
                    text = "FEVER END",
                    modifier = Modifier
                        .align(Alignment.Center)
                        .graphicsLayer { alpha = feverOutro.value },
                    color = FeverWhite,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp,
                )
            }
        }
    }
}

private fun feverAmbientParties(): List<Party> {
    val left = Party(
        angle = 0,
        spread = 54,
        speed = 3f,
        maxSpeed = 8f,
        damping = 0.94f,
        size = listOf(ParticleSize(2, mass = 3f), ParticleSize(3, mass = 4f)),
        colors = listOf(FeverParticlePink, FeverParticleWhite, FeverParticleCyan),
        shapes = listOf(Shape.Circle),
        timeToLive = 900L,
        fadeOutEnabled = true,
        position = Position.Relative(0.015, 0.16).between(Position.Relative(0.015, 0.94)),
        rotation = Rotation.disabled(),
        emitter = Emitter(ComboFeverRules.FEVER_DURATION_SECONDS.toLong(), TimeUnit.SECONDS).perSecond(13),
    )
    val right = Party(
        angle = 180,
        spread = 54,
        speed = 3f,
        maxSpeed = 8f,
        damping = 0.94f,
        size = listOf(ParticleSize(2, mass = 3f), ParticleSize(3, mass = 4f)),
        colors = listOf(FeverParticleCyan, FeverParticleWhite, FeverParticlePink),
        shapes = listOf(Shape.Circle),
        timeToLive = 900L,
        fadeOutEnabled = true,
        position = Position.Relative(0.985, 0.16).between(Position.Relative(0.985, 0.94)),
        rotation = Rotation.disabled(),
        emitter = Emitter(ComboFeverRules.FEVER_DURATION_SECONDS.toLong(), TimeUnit.SECONDS).perSecond(13),
    )
    return listOf(left, right)
}
