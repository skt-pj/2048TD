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

private val ParticleWhite = 0xFFF8FDFF.toInt()
private val ParticleCyan = 0xFF45F7FF.toInt()
private val ParticleBlue = 0xFF5D86FF.toInt()
private val ParticleViolet = 0xFFB56CFF.toInt()
private val ParticleOrange = 0xFFFF8A2A.toInt()
private val ParticlePink = 0xFFFF48D8.toInt()
private val ParticleRed = 0xFFFF4B63.toInt()
private val ParticleGold = 0xFFFFD65A.toInt()

/**
 * Third-party particle layer for battlefield feedback only.
 * The 2048 input board intentionally never hosts this composable.
 */
@Composable
internal fun BattleParticleVfxLayer(
    snapshot: GameSnapshot,
    simpleEffects: Boolean,
    feverActive: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val aliveEvents = snapshot.vfxEvents.filter { event ->
        val age = snapshot.elapsedSeconds - event.createdAtSeconds
        age in 0f..0.90f
    }

    // Keep simultaneous full-screen particle canvases bounded. Kills take priority over routine hits.
    // FEVER changes each burst's energy, not the number of concurrent canvases.
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
        key(event.id, feverActive) {
            KonfettiView(
                modifier = modifier,
                parties = battleParties(event, simpleEffects, feverActive),
            )
        }
    }
}

private fun battleParties(
    event: VfxEvent,
    simpleEffects: Boolean,
    feverActive: Boolean,
): List<Party> {
    val position = Position.Relative(
        x = event.x.coerceIn(0f, 1f).toDouble(),
        y = event.y.coerceIn(0f, 1f).toDouble(),
    )
    val colors = particleColors(event, feverActive)
    val energyScale = if (feverActive) 1.22f else 1f

    val primary = when (event.type) {
        VfxEventType.HIT -> Party(
            angle = 0,
            spread = 360,
            speed = 8f * energyScale,
            maxSpeed = (if (simpleEffects) 13f else 18f) * energyScale,
            damping = if (feverActive) 0.87f else 0.84f,
            size = if (simpleEffects) {
                listOf(Size(2, mass = 3f), Size(3, mass = 4f))
            } else {
                if (feverActive) {
                    listOf(Size(2, mass = 3f), Size(3, mass = 4f), Size(4, mass = 5f), Size(5, mass = 5f))
                } else {
                    listOf(Size(2, mass = 3f), Size(3, mass = 4f), Size(4, mass = 5f))
                }
            },
            colors = colors,
            shapes = listOf(Shape.Circle),
            timeToLive = if (simpleEffects) {
                if (feverActive) 230L else 190L
            } else {
                if (feverActive) 330L else 260L
            },
            fadeOutEnabled = true,
            position = position,
            rotation = Rotation.disabled(),
            emitter = Emitter(70, TimeUnit.MILLISECONDS).max(
                if (simpleEffects) {
                    if (feverActive) 7 else 5
                } else {
                    if (feverActive) 13 else 9
                },
            ),
        )

        VfxEventType.KILL -> Party(
            angle = 0,
            spread = 360,
            speed = 12f * energyScale,
            maxSpeed = (if (simpleEffects) 21f else 30f) * energyScale,
            damping = if (feverActive) 0.90f else 0.87f,
            size = if (simpleEffects) {
                listOf(Size(3, mass = 4f), Size(4, mass = 5f))
            } else {
                if (feverActive) {
                    listOf(Size(2, mass = 3f), Size(4, mass = 5f), Size(6, mass = 6f), Size(8, mass = 7f))
                } else {
                    listOf(Size(2, mass = 3f), Size(4, mass = 5f), Size(6, mass = 6f))
                }
            },
            colors = colors,
            shapes = if (simpleEffects) listOf(Shape.Circle) else listOf(Shape.Circle, Shape.Square),
            timeToLive = if (simpleEffects) {
                if (feverActive) 430L else 360L
            } else {
                if (feverActive) 620L else 520L
            },
            fadeOutEnabled = true,
            position = position,
            rotation = if (simpleEffects) Rotation.disabled() else Rotation.enabled(),
            emitter = Emitter(110, TimeUnit.MILLISECONDS).max(
                if (simpleEffects) {
                    if (feverActive) 14 else 10
                } else {
                    if (feverActive) 28 else 20
                },
            ),
        )

        VfxEventType.BOSS_KILL -> Party(
            angle = 0,
            spread = 360,
            speed = 18f * energyScale,
            maxSpeed = (if (simpleEffects) 31f else 42f) * energyScale,
            damping = if (feverActive) 0.91f else 0.89f,
            size = if (simpleEffects) {
                listOf(Size(3, mass = 4f), Size(5, mass = 6f))
            } else {
                if (feverActive) {
                    listOf(Size(2, mass = 3f), Size(4, mass = 5f), Size(7, mass = 7f), Size(9, mass = 8f))
                } else {
                    listOf(Size(2, mass = 3f), Size(4, mass = 5f), Size(7, mass = 7f))
                }
            },
            colors = colors,
            shapes = if (simpleEffects) listOf(Shape.Circle) else listOf(Shape.Circle, Shape.Square),
            timeToLive = if (simpleEffects) {
                if (feverActive) 610L else 520L
            } else {
                if (feverActive) 860L else 760L
            },
            fadeOutEnabled = true,
            position = position,
            rotation = if (simpleEffects) Rotation.disabled() else Rotation.enabled(),
            emitter = Emitter(150, TimeUnit.MILLISECONDS).max(
                if (simpleEffects) {
                    if (feverActive) 24 else 18
                } else {
                    if (feverActive) 48 else 36
                },
            ),
        )
    }

    if (event.type != VfxEventType.BOSS_KILL || simpleEffects) return listOf(primary)

    // A delayed second burst gives the boss finish a readable two-beat impact without touching the board.
    val secondary = Party(
        angle = 0,
        spread = 360,
        speed = if (feverActive) 9f else 7f,
        maxSpeed = if (feverActive) 25f else 20f,
        damping = 0.91f,
        size = if (feverActive) {
            listOf(Size(2, mass = 3f), Size(3, mass = 4f), Size(5, mass = 5f), Size(7, mass = 6f))
        } else {
            listOf(Size(2, mass = 3f), Size(3, mass = 4f), Size(5, mass = 5f))
        },
        colors = if (feverActive) {
            listOf(ParticleGold, ParticleWhite, ParticlePink, ParticleCyan)
        } else {
            listOf(ParticleGold, ParticleWhite, ParticleOrange)
        },
        shapes = listOf(Shape.Circle),
        timeToLive = if (feverActive) 780L else 680L,
        fadeOutEnabled = true,
        position = position,
        delay = 85,
        rotation = Rotation.disabled(),
        emitter = Emitter(120, TimeUnit.MILLISECONDS).max(if (feverActive) 32 else 24),
    )
    return listOf(primary, secondary)
}

private fun particleColors(event: VfxEvent, feverActive: Boolean): List<Int> {
    val weaponColor = when (event.weaponType) {
        WeaponType.NORMAL,
        WeaponType.RAPID -> ParticleCyan
        WeaponType.MACHINE_GUN -> ParticleBlue
        WeaponType.PIERCING -> ParticleViolet
        WeaponType.EXPLOSIVE -> ParticleOrange
        WeaponType.LASER -> ParticlePink
    }

    if (feverActive) {
        return when (event.type) {
            VfxEventType.HIT -> listOf(weaponColor, ParticleWhite, ParticlePink, ParticleCyan)
            VfxEventType.KILL -> listOf(weaponColor, ParticleWhite, ParticlePink, ParticleGold, ParticleCyan)
            VfxEventType.BOSS_KILL -> listOf(ParticleGold, ParticleWhite, ParticlePink, ParticleCyan, ParticleOrange)
        }
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
