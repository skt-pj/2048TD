package com.sktpj.td2048

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

internal fun DrawScope.drawVectorGlowLine(
    start: Offset,
    end: Offset,
    color: Color,
    coreWidth: Float,
    simpleEffects: Boolean,
) {
    if (!simpleEffects) {
        drawLine(color.copy(alpha = 0.08f), start, end, coreWidth * 5.2f, cap = StrokeCap.Round)
        drawLine(color.copy(alpha = 0.18f), start, end, coreWidth * 2.8f, cap = StrokeCap.Round)
    }
    drawLine(color.copy(alpha = 0.78f), start, end, coreWidth, cap = StrokeCap.Round)
    drawLine(Color.White.copy(alpha = 0.76f), start, end, (coreWidth * 0.30f).coerceAtLeast(1f), cap = StrokeCap.Round)
}

internal fun DrawScope.drawVectorSparkBurst(
    center: Offset,
    color: Color,
    radius: Float,
    phase: Float,
    simpleEffects: Boolean,
) {
    val rayCount = if (simpleEffects) 4 else 8
    val rotation = phase * (PI * 2.0)
    repeat(rayCount) { index ->
        val angle = rotation + (PI * 2.0 * index / rayCount)
        val inner = radius * 0.36f
        val outer = radius * if (index % 2 == 0) 1.0f else 0.72f
        val start = Offset(
            center.x + cos(angle).toFloat() * inner,
            center.y + sin(angle).toFloat() * inner,
        )
        val end = Offset(
            center.x + cos(angle).toFloat() * outer,
            center.y + sin(angle).toFloat() * outer,
        )
        if (!simpleEffects) {
            drawLine(color.copy(alpha = 0.12f), start, end, 7f, cap = StrokeCap.Round)
        }
        drawLine(color.copy(alpha = 0.82f), start, end, 2.1f, cap = StrokeCap.Round)
    }
    drawCircle(color.copy(alpha = if (simpleEffects) 0.16f else 0.10f), radius * 0.60f, center)
    drawCircle(color, radius * 0.18f, center)
    drawCircle(Color.White.copy(alpha = 0.88f), radius * 0.07f, center)
}

internal fun DrawScope.drawVectorReticle(
    center: Offset,
    color: Color,
    radius: Float,
    phase: Float,
    simpleEffects: Boolean,
) {
    val sweep = 66f
    val rotation = phase * 360f
    if (!simpleEffects) {
        drawCircle(color.copy(alpha = 0.08f), radius * 1.42f, center)
        drawCircle(color.copy(alpha = 0.17f), radius * 1.13f, center, style = Stroke(width = 5f))
    }
    repeat(4) { index ->
        drawArc(
            color = color.copy(alpha = 0.90f),
            startAngle = rotation + index * 90f,
            sweepAngle = sweep,
            useCenter = false,
            topLeft = Offset(center.x - radius, center.y - radius),
            size = androidx.compose.ui.geometry.Size(radius * 2f, radius * 2f),
            style = Stroke(width = if (simpleEffects) 2f else 2.8f, cap = StrokeCap.Round),
        )
    }
    val tick = radius * 0.42f
    drawLine(color, Offset(center.x - radius - tick, center.y), Offset(center.x - radius * 0.74f, center.y), 2f)
    drawLine(color, Offset(center.x + radius * 0.74f, center.y), Offset(center.x + radius + tick, center.y), 2f)
    drawLine(color, Offset(center.x, center.y - radius - tick), Offset(center.x, center.y - radius * 0.74f), 2f)
    drawLine(color, Offset(center.x, center.y + radius * 0.74f), Offset(center.x, center.y + radius + tick), 2f)
}

internal fun DrawScope.drawVectorDiamond(
    center: Offset,
    radius: Float,
    color: Color,
    simpleEffects: Boolean,
) {
    val path = Path().apply {
        moveTo(center.x, center.y - radius)
        lineTo(center.x + radius * 0.72f, center.y)
        lineTo(center.x, center.y + radius)
        lineTo(center.x - radius * 0.72f, center.y)
        close()
    }
    if (!simpleEffects) {
        drawPath(path, color.copy(alpha = 0.12f), style = Stroke(width = 8f))
    }
    drawPath(path, color.copy(alpha = 0.90f), style = Stroke(width = 2.4f))
    drawCircle(Color.White.copy(alpha = 0.80f), radius * 0.13f, center)
}

internal fun DrawScope.drawVectorLaneFlow(
    laneLeft: Float,
    laneWidth: Float,
    height: Float,
    phase: Float,
    color: Color,
    simpleEffects: Boolean,
) {
    if (simpleEffects) return
    val centerX = laneLeft + laneWidth / 2f
    val gap = height / 5f
    repeat(5) { index ->
        val y = ((index * gap + phase * gap * 2f) % (height + gap)) - gap
        val w = laneWidth * 0.16f
        val h = 9f
        val path = Path().apply {
            moveTo(centerX - w, y - h)
            lineTo(centerX, y + h)
            lineTo(centerX + w, y - h)
        }
        drawPath(path, color.copy(alpha = 0.10f), style = Stroke(width = 2f, cap = StrokeCap.Round))
    }
}

internal fun DrawScope.drawVectorEnergyBoundary(
    y: Float,
    color: Color,
    phase: Float,
    simpleEffects: Boolean,
) {
    if (!simpleEffects) {
        drawLine(color.copy(alpha = 0.07f), Offset(0f, y), Offset(size.width, y), 20f)
        drawLine(color.copy(alpha = 0.15f), Offset(0f, y), Offset(size.width, y), 10f)
    }
    val dash = floatArrayOf(18f, 13f)
    drawLine(
        color = color.copy(alpha = 0.92f),
        start = Offset(-31f * phase, y),
        end = Offset(size.width + 31f, y),
        strokeWidth = if (simpleEffects) 2.2f else 3.0f,
        pathEffect = PathEffect.dashPathEffect(dash, 31f * phase),
    )
}

internal fun DrawScope.drawVectorRadialGlow(
    center: Offset,
    radius: Float,
    color: Color,
    simpleEffects: Boolean,
) {
    if (simpleEffects) {
        drawCircle(color.copy(alpha = 0.10f), radius, center)
        return
    }
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(color.copy(alpha = 0.22f), color.copy(alpha = 0.07f), Color.Transparent),
            center = center,
            radius = radius,
        ),
        radius = radius,
        center = center,
    )
}
