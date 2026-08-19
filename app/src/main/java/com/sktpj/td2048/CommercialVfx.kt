package com.sktpj.td2048

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.sin

private val VfxWhite = Color(0xFFF8FDFF)
private val VfxCyan = Color(0xFF45F7FF)
private val VfxBlue = Color(0xFF5D86FF)
private val VfxViolet = Color(0xFFB56CFF)
private val VfxOrange = Color(0xFFFF8A2A)
private val VfxPink = Color(0xFFFF48D8)
private val VfxRed = Color(0xFFFF4B63)
private val VfxGold = Color(0xFFFFD65A)

private fun clamp01(value: Float): Float = value.coerceIn(0f, 1f)
private fun easeOutCubic(value: Float): Float {
    val t = clamp01(value)
    val inv = 1f - t
    return 1f - inv * inv * inv
}

private fun weaponVfxColor(type: WeaponType): Color = when (type) {
    WeaponType.NORMAL -> VfxCyan
    WeaponType.RAPID -> VfxCyan
    WeaponType.MACHINE_GUN -> VfxBlue
    WeaponType.PIERCING -> VfxViolet
    WeaponType.EXPLOSIVE -> VfxOrange
    WeaponType.LASER -> VfxPink
}

private fun weaponTrailLength(type: WeaponType): Float = when (type) {
    WeaponType.NORMAL -> 20f
    WeaponType.RAPID -> 30f
    WeaponType.MACHINE_GUN -> 38f
    WeaponType.PIERCING -> 46f
    WeaponType.EXPLOSIVE -> 24f
    WeaponType.LASER -> 0f
}

internal fun DrawScope.drawCommercialProjectileTrail(
    source: Offset,
    center: Offset,
    weaponType: WeaponType,
    simpleEffects: Boolean,
) {
    if (weaponType == WeaponType.LASER) return
    val dx = center.x - source.x
    val dy = center.y - source.y
    val distance = hypot(dx.toDouble(), dy.toDouble()).toFloat().coerceAtLeast(0.001f)
    val ux = dx / distance
    val uy = dy / distance
    val px = -uy
    val py = ux
    val length = weaponTrailLength(weaponType)
    val color = weaponVfxColor(weaponType)
    val tail = Offset(center.x - ux * length, center.y - uy * length)
    val coreWidth = when (weaponType) {
        WeaponType.NORMAL -> 2.2f
        WeaponType.RAPID -> 2.0f
        WeaponType.MACHINE_GUN -> 2.8f
        WeaponType.PIERCING -> 3.4f
        WeaponType.EXPLOSIVE -> 2.3f
        WeaponType.LASER -> 0f
    }

    if (!simpleEffects) {
        drawLine(
            brush = Brush.linearGradient(
                colors = listOf(Color.Transparent, color.copy(alpha = 0.16f), color.copy(alpha = 0.54f)),
                start = tail,
                end = center,
            ),
            start = tail,
            end = center,
            strokeWidth = coreWidth * 5f,
            cap = StrokeCap.Round,
        )
        drawLine(
            brush = Brush.linearGradient(
                colors = listOf(Color.Transparent, color.copy(alpha = 0.24f), color.copy(alpha = 0.88f)),
                start = tail,
                end = center,
            ),
            start = tail,
            end = center,
            strokeWidth = coreWidth * 2.3f,
            cap = StrokeCap.Round,
        )
        if (weaponType == WeaponType.RAPID || weaponType == WeaponType.MACHINE_GUN) {
            val ribbonOffset = if (weaponType == WeaponType.MACHINE_GUN) 5f else 3.5f
            val sideAStart = Offset(tail.x + px * ribbonOffset, tail.y + py * ribbonOffset)
            val sideAEnd = Offset(center.x + px * ribbonOffset * 0.25f, center.y + py * ribbonOffset * 0.25f)
            val sideBStart = Offset(tail.x - px * ribbonOffset, tail.y - py * ribbonOffset)
            val sideBEnd = Offset(center.x - px * ribbonOffset * 0.25f, center.y - py * ribbonOffset * 0.25f)
            drawLine(color.copy(alpha = 0.26f), sideAStart, sideAEnd, 1.2f, cap = StrokeCap.Round)
            drawLine(color.copy(alpha = 0.26f), sideBStart, sideBEnd, 1.2f, cap = StrokeCap.Round)
        }
    }
    drawLine(color.copy(alpha = 0.92f), tail, center, coreWidth, cap = StrokeCap.Round)
    drawLine(VfxWhite.copy(alpha = 0.86f), Offset(center.x - ux * length * 0.36f, center.y - uy * length * 0.36f), center, max(1f, coreWidth * 0.34f), cap = StrokeCap.Round)

    if (!simpleEffects && distance < length * 1.55f) {
        drawCommercialMuzzleFlash(source, Offset(ux, uy), color, weaponType)
    }
}

private fun DrawScope.drawCommercialMuzzleFlash(
    source: Offset,
    direction: Offset,
    color: Color,
    weaponType: WeaponType,
) {
    val px = -direction.y
    val py = direction.x
    val length = when (weaponType) {
        WeaponType.PIERCING -> 18f
        WeaponType.MACHINE_GUN -> 14f
        WeaponType.EXPLOSIVE -> 16f
        else -> 11f
    }
    val width = length * 0.42f
    val path = Path().apply {
        moveTo(source.x, source.y)
        lineTo(source.x + direction.x * length + px * width, source.y + direction.y * length + py * width)
        lineTo(source.x + direction.x * length * 0.62f, source.y + direction.y * length * 0.62f)
        lineTo(source.x + direction.x * length - px * width, source.y + direction.y * length - py * width)
        close()
    }
    drawPath(path, color.copy(alpha = 0.30f))
    drawLine(VfxWhite.copy(alpha = 0.88f), source, Offset(source.x + direction.x * length * 0.64f, source.y + direction.y * length * 0.64f), 2f, cap = StrokeCap.Round)
}

internal fun commercialCameraShake(
    elapsedSeconds: Float,
    events: List<VfxEvent>,
    simpleEffects: Boolean,
): Offset {
    if (simpleEffects || events.isEmpty()) return Offset.Zero
    var amplitude = 0f
    events.forEach { event ->
        val age = elapsedSeconds - event.createdAtSeconds
        val duration = when (event.type) {
            VfxEventType.HIT -> 0.12f
            VfxEventType.KILL -> 0.24f
            VfxEventType.BOSS_KILL -> 0.42f
        }
        if (age !in 0f..duration) return@forEach
        val base = when (event.type) {
            VfxEventType.HIT -> 0f
            VfxEventType.KILL -> 1.7f
            VfxEventType.BOSS_KILL -> 5.2f
        }
        val decay = 1f - age / duration
        amplitude = max(amplitude, base * decay * decay)
    }
    if (amplitude <= 0f) return Offset.Zero
    return Offset(
        x = sin(elapsedSeconds * 116f) * amplitude,
        y = cos(elapsedSeconds * 149f) * amplitude * 0.68f,
    )
}

internal fun DrawScope.drawCommercialImpactEvent(
    event: VfxEvent,
    elapsedSeconds: Float,
    simpleEffects: Boolean,
) {
    val age = elapsedSeconds - event.createdAtSeconds
    if (age < 0f) return
    val center = Offset(size.width * event.x, size.height * event.y)
    val color = when (event.type) {
        VfxEventType.HIT -> weaponVfxColor(event.weaponType)
        VfxEventType.KILL -> if (event.weaponType == WeaponType.EXPLOSIVE) VfxOrange else VfxRed
        VfxEventType.BOSS_KILL -> VfxGold
    }
    when (event.type) {
        VfxEventType.HIT -> drawHitImpact(center, color, event, age, simpleEffects)
        VfxEventType.KILL -> drawKillImpact(center, color, event, age, simpleEffects, boss = false)
        VfxEventType.BOSS_KILL -> drawKillImpact(center, color, event, age, simpleEffects, boss = true)
    }
}

private fun DrawScope.drawHitImpact(
    center: Offset,
    color: Color,
    event: VfxEvent,
    age: Float,
    simpleEffects: Boolean,
) {
    val duration = 0.38f
    if (age > duration) return
    val progress = clamp01(age / duration)
    val ringProgress = easeOutCubic(age / 0.28f)
    val flash = 1f - clamp01(age / 0.10f)
    val radius = 8f + 24f * ringProgress

    if (!simpleEffects) {
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(VfxWhite.copy(alpha = 0.46f * flash), color.copy(alpha = 0.24f * flash), Color.Transparent),
                center = center,
                radius = 24f,
            ),
            radius = 24f,
            center = center,
        )
        drawCircle(color.copy(alpha = 0.72f * (1f - progress)), radius, center, style = Stroke(width = 2.3f))
        drawImpactShards(center, color, event.id, 6, 10f + 25f * ringProgress, 1f - progress)
    } else {
        drawCircle(color.copy(alpha = 0.55f * (1f - progress)), radius * 0.72f, center, style = Stroke(width = 1.8f))
    }
    drawCircle(VfxWhite.copy(alpha = 0.90f * flash), 4.2f + 3f * flash, center)
    drawDamageNumber(event.damage, center, progress, if (event.weaponType == WeaponType.LASER) VfxPink else VfxWhite, emphasized = false)
}

private fun DrawScope.drawKillImpact(
    center: Offset,
    color: Color,
    event: VfxEvent,
    age: Float,
    simpleEffects: Boolean,
    boss: Boolean,
) {
    val duration = if (boss) 0.86f else 0.62f
    if (age > duration) return
    val progress = clamp01(age / duration)
    val burst = easeOutCubic(progress)
    val flash = 1f - clamp01(age / if (boss) 0.16f else 0.11f)
    val ringRadius = if (boss) 30f + 120f * burst else 14f + 52f * burst

    if (boss && !simpleEffects) {
        drawRect(VfxWhite.copy(alpha = 0.12f * flash))
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(VfxWhite.copy(alpha = 0.62f * flash), color.copy(alpha = 0.26f * flash), Color.Transparent),
                center = center,
                radius = 180f,
            ),
            radius = 180f,
            center = center,
        )
        repeat(3) { layer ->
            val layerRadius = ringRadius * (0.62f + layer * 0.22f)
            drawCircle(color.copy(alpha = (0.66f - layer * 0.14f) * (1f - progress)), layerRadius, center, style = Stroke(width = 3.0f - layer * 0.5f))
        }
        drawImpactShards(center, color, event.id, 18, 42f + 100f * burst, 1f - progress)
    } else {
        if (!simpleEffects) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(VfxWhite.copy(alpha = 0.50f * flash), color.copy(alpha = 0.30f * flash), Color.Transparent),
                    center = center,
                    radius = 72f,
                ),
                radius = 72f,
                center = center,
            )
            drawImpactShards(center, color, event.id, 10, 22f + 48f * burst, 1f - progress)
        }
        drawCircle(color.copy(alpha = 0.80f * (1f - progress)), ringRadius, center, style = Stroke(width = if (simpleEffects) 2.2f else 3.4f))
    }

    drawCircle(VfxWhite.copy(alpha = 0.96f * flash), if (boss) 13f + 9f * flash else 7f + 5f * flash, center)
    drawDamageNumber(event.damage, center, progress, if (boss) VfxGold else VfxWhite, emphasized = true)
}

private fun DrawScope.drawImpactShards(
    center: Offset,
    color: Color,
    seed: Int,
    count: Int,
    radius: Float,
    alpha: Float,
) {
    if (alpha <= 0f) return
    repeat(count) { index ->
        val jitter = ((seed * 37 + index * 53) % 100) / 100f
        val angle = (PI * 2.0 * index / count) + jitter * 0.42
        val length = 7f + jitter * 13f
        val innerRadius = radius * (0.34f + jitter * 0.18f)
        val outerRadius = innerRadius + length
        val start = Offset(
            center.x + cos(angle).toFloat() * innerRadius,
            center.y + sin(angle).toFloat() * innerRadius,
        )
        val end = Offset(
            center.x + cos(angle).toFloat() * outerRadius,
            center.y + sin(angle).toFloat() * outerRadius,
        )
        drawLine(color.copy(alpha = alpha * (0.46f + jitter * 0.38f)), start, end, 1.2f + jitter * 1.8f, cap = StrokeCap.Round)
    }
}

private fun DrawScope.drawDamageNumber(
    damage: Int,
    center: Offset,
    progress: Float,
    color: Color,
    emphasized: Boolean,
) {
    if (damage <= 0 || progress >= 1f) return
    val alpha = (1f - clamp01((progress - 0.50f) / 0.50f)).coerceIn(0f, 1f)
    val rise = if (emphasized) 32f else 23f
    val y = center.y - 16f - rise * easeOutCubic(progress)
    val textSize = if (emphasized) 18f else 14f
    val paint = Paint().apply {
        this.color = color.copy(alpha = alpha).toArgb()
        this.textSize = textSize
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT_BOLD
        isAntiAlias = true
        setShadowLayer(if (emphasized) 5f else 3f, 0f, 0f, Color.Black.copy(alpha = 0.85f).toArgb())
    }
    drawContext.canvas.nativeCanvas.drawText(damage.toString(), center.x, y, paint)
}

internal fun DrawScope.drawCommercialMergeAccent(
    mergeValue: Int,
    progress: Float,
    simpleEffects: Boolean,
) {
    if (mergeValue <= 0) return
    val t = clamp01(progress)
    val fade = 1f - t
    val center = Offset(size.width / 2f, size.height / 2f)
    val tier = when {
        mergeValue >= 2048 -> 1.0f
        mergeValue >= 512 -> 0.84f
        mergeValue >= 128 -> 0.68f
        mergeValue >= 32 -> 0.52f
        else -> 0.40f
    }
    val color = when {
        mergeValue >= 2048 -> VfxGold
        mergeValue >= 512 -> VfxPink
        mergeValue >= 128 -> VfxViolet
        else -> VfxCyan
    }
    val radius = minOf(size.width, size.height) * (0.18f + 0.55f * easeOutCubic(t))
    if (!simpleEffects) {
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(color.copy(alpha = 0.22f * fade * tier), color.copy(alpha = 0.06f * fade), Color.Transparent),
                center = center,
                radius = radius,
            ),
            radius = radius,
            center = center,
        )
        repeat(if (mergeValue >= 512) 12 else 8) { index ->
            val angle = PI * 2.0 * index / if (mergeValue >= 512) 12 else 8
            val inner = radius * 0.46f
            val outer = radius * (0.76f + tier * 0.22f)
            drawLine(
                color.copy(alpha = 0.32f * fade),
                Offset(center.x + cos(angle).toFloat() * inner, center.y + sin(angle).toFloat() * inner),
                Offset(center.x + cos(angle).toFloat() * outer, center.y + sin(angle).toFloat() * outer),
                1.4f + 1.2f * tier,
                cap = StrokeCap.Round,
            )
        }
    }
    drawCircle(color.copy(alpha = 0.76f * fade), radius * 0.72f, center, style = Stroke(width = 2.2f + tier * 1.8f))
}
