package com.sktpj.td2048

import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import nl.dionsegijn.konfetti.compose.KonfettiView
import nl.dionsegijn.konfetti.core.Party
import nl.dionsegijn.konfetti.core.Position
import nl.dionsegijn.konfetti.core.Rotation
import nl.dionsegijn.konfetti.core.emitter.Emitter
import nl.dionsegijn.konfetti.core.models.Shape
import nl.dionsegijn.konfetti.core.models.Size
import java.util.concurrent.TimeUnit

private const val ParticleWhite = 0xFFF8FDFF.toInt()
private const val ParticleCyan = 0xFF45F7FF.toInt()
private const val ParticleBlue = 0xFF5D86FF.toInt()
private const val ParticleViolet = 0xFFB56CFF.toInt()
private const val ParticleOrange = 0xFFFF8A2A.toInt()
private const val ParticlePink = 0xFFFF48D8.toInt()
private const val ParticleRed = 0xFFFF4B63.toInt()
private const val ParticleGold = 0xFFFFD65A.toInt()

/**
 * Third-party particle layer for battlefield feedback only.
 * The 2048 input board intentionally never hosts this composable.
 */
@Composable
internal fun BattleParticleVfxLayer(
    snapshot: GameSnapshot,
    simpleEffects: Boolean,
    modifier: Modifier = Modifier,
) {
    val aliveEvents = snapshot.vfxEvents.filter { event ->
        val age = snapshot.elapsedSeconds - event.createdAtSeconds
        age in 0f..0.90f
    }

    // Keep simultaneous full-screen particle canvases bounded. Kills take priority over routine hits.
    val priorityLimit = if (simpleEffects) 1 else 2
    val hitLimit = if (simpleEffects) 2 else 3
    val priorityEvents = aliveEvents
        .filter { it.type != VfxEventType.HIT }
        .takeLast(priorityLimit)
    val hitEvents = aliveEvents
        .filter { it.type == VfxEventType.HIT }
        .takeLast(hitLimit)
    val visibleEvents = (priorityEvents + hitEvents)
        .distinctBy { it.id }
        .sortedBy { it.createdAtSeconds }

    visibleEvents.forEach { event ->
        key(event.id) {
            KonfettiView(
                modifier = modifier,
                parties = battleParties(event, simpleEffects),
            )
        }
    }
}

private fun battleParties(event: VfxEvent, simpleEffects: Boolean): List<Party> {
    val position = Position.Relative(
        x = event.x.coerceIn(0f, 1f).toDouble(),
        y = event.y.coerceIn(0f, 1f).toDouble(),
    )
    val colors = particleColors(event)

    val primary = when (event.type) {
        VfxEventType.HIT -> Party(
            angle = 0,
            spread = 360,
            speed = 8f,
            maxSpeed = if (simpleEffects) 13f else 18f,
            damping = 0.84f,
            size = if (simpleEffects) {
                listOf(Size(2, mass = 3f), Size(3, mass = 4f))
            } else {
                listOf(Size(2, mass = 3f), Size(3, mass = 4f), Size(4, mass = 5f))
            },
            colors = colors,
            shapes = listOf(Shape.Circle),
            timeToLive = if (simpleEffects) 190L else 260L,
            fadeOutEnabled = true,
            position = position,
            rotation = Rotation.disabled(),
            emitter = Emitter(70, TimeUnit.MILLISECONDS).max(if (simpleEffects) 5 else 9),
        )

        VfxEventType.KILL -> Party(
            angle = 0,
            spread = 360,
            speed = 12f,
            maxSpeed = if (simpleEffects) 21f else 30f,
            damping = 0.87f,
            size = if (simpleEffects) {
                listOf(Size(3, mass = 4f), Size(4, mass = 5f))
            } else {
                listOf(Size(2, mass = 3f), Size(4, mass = 5f), Size(6, mass = 6f))
            },
            colors = colors,
            shapes = if (simpleEffects) listOf(Shape.Circle) else listOf(Shape.Circle, Shape.Square),
            timeToLive = if (simpleEffects) 360L else 520L,
            fadeOutEnabled = true,
            position = position,
            rotation = if (simpleEffects) Rotation.disabled() else Rotation.enabled(),
            emitter = Emitter(110, TimeUnit.MILLISECONDS).max(if (simpleEffects) 10 else 20),
        )

        VfxEventType.BOSS_KILL -> Party(
            angle = 0,
            spread = 360,
            speed = 18f,
            maxSpeed = if (simpleEffects) 31f else 42f,
            damping = 0.89f,
            size = if (simpleEffects) {
                listOf(Size(3, mass = 4f), Size(5, mass = 6f))
            } else {
                listOf(Size(2, mass = 3f), Size(4, mass = 5f), Size(7, mass = 7f))
            },
            colors = colors,
            shapes = if (simpleEffects) listOf(Shape.Circle) else listOf(Shape.Circle, Shape.Square),
            timeToLive = if (simpleEffects) 520L else 760L,
            fadeOutEnabled = true,
            position = position,
            rotation = if (simpleEffects) Rotation.disabled() else Rotation.enabled(),
            emitter = Emitter(150, TimeUnit.MILLISECONDS).max(if (simpleEffects) 18 else 36),
        )
    }

    if (event.type != VfxEventType.BOSS_KILL || simpleEffects) return listOf(primary)

    // A delayed second burst gives the boss finish a readable two-beat impact without touching the board.
    val secondary = Party(
        angle = 0,
        spread = 360,
        speed = 7f,
        maxSpeed = 20f,
        damping = 0.91f,
        size = listOf(Size(2, mass = 3f), Size(3, mass = 4f), Size(5, mass = 5f)),
        colors = listOf(ParticleGold, ParticleWhite, ParticleOrange),
        shapes = listOf(Shape.Circle),
        timeToLive = 680L,
        fadeOutEnabled = true,
        position = position,
        delay = 85,
        rotation = Rotation.disabled(),
        emitter = Emitter(120, TimeUnit.MILLISECONDS).max(24),
    )
    return listOf(primary, secondary)
}

private fun particleColors(event: VfxEvent): List<Int> {
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
