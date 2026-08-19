package com.sktpj.td2048

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import dev.piotrprus.particleemitter.CanvasEmitterConfig
import dev.piotrprus.particleemitter.CanvasParticleEmitter
import dev.piotrprus.particleemitter.ParticleShape

private val ParticleWhite = Color(0xFFF8FDFF)
private val ParticleCyan = Color(0xFF45F7FF)
private val ParticleBlue = Color(0xFF5D86FF)
private val ParticleViolet = Color(0xFFB56CFF)
private val ParticleOrange = Color(0xFFFF8A2A)
private val ParticlePink = Color(0xFFFF48D8)
private val ParticleRed = Color(0xFFFF4B63)
private val ParticleGold = Color(0xFFFFD65A)

@Composable
internal fun BattleParticleVfxLayer(
    snapshot: GameSnapshot,
    simpleEffects: Boolean,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(modifier = modifier) {
        val maxHitEvents = if (simpleEffects) 3 else 8
        val aliveEvents = snapshot.vfxEvents.filter { event ->
            val age = snapshot.elapsedSeconds - event.createdAtSeconds
            age in 0f..0.90f
        }
        val priorityEvents = aliveEvents.filter { it.type != VfxEventType.HIT }
        val hitEvents = aliveEvents.filter { it.type == VfxEventType.HIT }.takeLast(maxHitEvents)
        val visibleEvents = (priorityEvents + hitEvents)
            .distinctBy { it.id }
            .sortedBy { it.createdAtSeconds }

        visibleEvents.forEach { event ->
            key(event.id) {
                val age = (snapshot.elapsedSeconds - event.createdAtSeconds).coerceAtLeast(0f)
                val center = DpOffset(
                    x = maxWidth * event.x.coerceIn(0f, 1f),
                    y = maxHeight * event.y.coerceIn(0f, 1f),
                )
                EventParticleEmitter(
                    event = event,
                    ageSeconds = age,
                    center = center,
                    simpleEffects = simpleEffects,
                    modifier = Modifier.matchParentSize(),
                )
            }
        }
    }
}

@Composable
private fun EventParticleEmitter(
    event: VfxEvent,
    ageSeconds: Float,
    center: DpOffset,
    simpleEffects: Boolean,
    modifier: Modifier,
) {
    val emitWindowSeconds = when (event.type) {
        VfxEventType.HIT -> 0.11f
        VfxEventType.KILL -> 0.18f
        VfxEventType.BOSS_KILL -> 0.28f
    }
    val particleRate = if (ageSeconds <= emitWindowSeconds) {
        when (event.type) {
            VfxEventType.HIT -> if (simpleEffects) 70 else 150
            VfxEventType.KILL -> if (simpleEffects) 120 else 260
            VfxEventType.BOSS_KILL -> if (simpleEffects) 220 else 520
        }
    } else {
        0
    }

    val colors = particleColors(event)
    val regionShape = when (event.type) {
        VfxEventType.HIT -> CanvasEmitterConfig.Shape.POINT
        VfxEventType.KILL,
        VfxEventType.BOSS_KILL -> CanvasEmitterConfig.Shape.SOLID_OVAL
    }
    val regionSize = when (event.type) {
        VfxEventType.HIT -> DpSize(0.dp, 0.dp)
        VfxEventType.KILL -> DpSize(18.dp, 18.dp)
        VfxEventType.BOSS_KILL -> DpSize(48.dp, 48.dp)
    }
    val particleSizes = when (event.type) {
        VfxEventType.HIT -> listOf(DpSize(2.dp, 2.dp), DpSize(3.dp, 3.dp), DpSize(4.dp, 4.dp))
        VfxEventType.KILL -> listOf(DpSize(3.dp, 3.dp), DpSize(5.dp, 5.dp), DpSize(7.dp, 7.dp))
        VfxEventType.BOSS_KILL -> listOf(DpSize(4.dp, 4.dp), DpSize(7.dp, 7.dp), DpSize(10.dp, 10.dp))
    }
    val lifespan = when (event.type) {
        VfxEventType.HIT -> 220..390
        VfxEventType.KILL -> 420..680
        VfxEventType.BOSS_KILL -> 620..900
    }
    val force = when (event.type) {
        VfxEventType.HIT -> 70..145
        VfxEventType.KILL -> 120..240
        VfxEventType.BOSS_KILL -> 170..330
    }
    val gravity = when (event.type) {
        VfxEventType.HIT -> 25f
        VfxEventType.KILL -> 70f
        VfxEventType.BOSS_KILL -> 95f
    }

    CanvasParticleEmitter(
        modifier = modifier,
        config = CanvasEmitterConfig(
            particlePerSecond = particleRate,
            emitterCenter = center,
            startRegionShape = regionShape,
            startRegionSize = regionSize,
            particleShapes = listOf(ParticleShape.Circle),
            lifespanRange = lifespan,
            fadeOutTime = (lifespan.first / 2)..lifespan.last,
            scaleTime = lifespan,
            colors = colors,
            particleSizes = particleSizes,
            spread = -180..180,
            blendMode = BlendMode.Screen,
            initialForce = force,
            rotationRange = -180..180,
            startScaleRange = 1..2,
            targetScaleRange = 0..1,
            gravityStrength = gravity,
            gravityAngle = 0,
        ),
    )

    if (event.type == VfxEventType.BOSS_KILL && !simpleEffects) {
        BossRingParticleEmitter(
            ageSeconds = ageSeconds,
            center = center,
            modifier = modifier,
        )
    }
}

@Composable
private fun BossRingParticleEmitter(
    ageSeconds: Float,
    center: DpOffset,
    modifier: Modifier,
) {
    val rate = if (ageSeconds <= 0.22f) 260 else 0
    CanvasParticleEmitter(
        modifier = modifier,
        config = CanvasEmitterConfig(
            particlePerSecond = rate,
            emitterCenter = center,
            startRegionShape = CanvasEmitterConfig.Shape.OVAL,
            startRegionSize = DpSize(62.dp, 62.dp),
            particleShapes = listOf(ParticleShape.Circle),
            lifespanRange = 520..850,
            fadeOutTime = 320..780,
            scaleTime = 520..850,
            colors = listOf(ParticleGold, ParticleWhite, ParticleOrange),
            particleSizes = listOf(DpSize(3.dp, 3.dp), DpSize(5.dp, 5.dp), DpSize(8.dp, 8.dp)),
            spread = -180..180,
            blendMode = BlendMode.Screen,
            initialForce = 100..220,
            rotationRange = -180..180,
            startScaleRange = 1..2,
            targetScaleRange = 0..1,
            gravityStrength = 40f,
            gravityAngle = 0,
            hideInStartRegion = true,
        ),
    )
}

private fun particleColors(event: VfxEvent): List<Color> {
    val weaponColor = when (event.weaponType) {
        WeaponType.NORMAL,
        WeaponType.RAPID -> ParticleCyan
        WeaponType.MACHINE_GUN -> ParticleBlue
        WeaponType.PIERCING -> ParticleViolet
        WeaponType.EXPLOSIVE -> ParticleOrange
        WeaponType.LASER -> ParticlePink
    }
    return when (event.type) {
        VfxEventType.HIT -> listOf(weaponColor, ParticleWhite)
        VfxEventType.KILL -> if (event.weaponType == WeaponType.EXPLOSIVE) {
            listOf(ParticleOrange, ParticleGold, ParticleWhite)
        } else {
            listOf(weaponColor, ParticleRed, ParticleWhite)
        }
        VfxEventType.BOSS_KILL -> listOf(ParticleGold, ParticleOrange, ParticleWhite, ParticlePink)
    }
}
