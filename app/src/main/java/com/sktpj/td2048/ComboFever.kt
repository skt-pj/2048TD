package com.sktpj.td2048

internal data class ComboFeverSnapshot(
    val combo: Int = 0,
    val comboRemainingSeconds: Float = 0f,
    val feverGaugeTiles: Int = 0,
    val feverRemainingSeconds: Float = 0f,
    val feverCount: Int = 0,
) {
    val feverActive: Boolean
        get() = feverRemainingSeconds > 0f

    val feverGaugeRatio: Float
        get() = if (feverActive) {
            (feverRemainingSeconds / ComboFeverRules.FEVER_DURATION_SECONDS).coerceIn(0f, 1f)
        } else {
            (feverGaugeTiles.toFloat() / ComboFeverRules.FEVER_TARGET_TILES).coerceIn(0f, 1f)
        }
}

internal object ComboFeverRules {
    const val FEVER_TARGET_TILES = 29
    const val FEVER_DURATION_SECONDS = 11f

    fun comboWindowSeconds(combo: Int): Float = when {
        combo <= 50 -> 3f
        combo <= 100 -> 2f
        combo <= 500 -> 1f
        else -> 0.5f
    }

    fun processedTilesForMergeCount(mergeCount: Int): Int =
        mergeCount.coerceAtLeast(0) * 2
}

internal class ComboFeverController {
    private var combo = 0
    private var comboRemainingSeconds = 0f
    private var feverGaugeTiles = 0
    private var feverRemainingSeconds = 0f
    private var feverCount = 0

    fun snapshot(): ComboFeverSnapshot = ComboFeverSnapshot(
        combo = combo,
        comboRemainingSeconds = comboRemainingSeconds,
        feverGaugeTiles = feverGaugeTiles,
        feverRemainingSeconds = feverRemainingSeconds,
        feverCount = feverCount,
    )

    fun reset() {
        combo = 0
        comboRemainingSeconds = 0f
        feverGaugeTiles = 0
        feverRemainingSeconds = 0f
        feverCount = 0
    }

    fun onMerge(mergeCount: Int) {
        if (mergeCount <= 0) return

        combo = if (combo <= 0) 1 else combo + 1

        if (feverRemainingSeconds > 0f) {
            return
        }

        comboRemainingSeconds = ComboFeverRules.comboWindowSeconds(combo)
        feverGaugeTiles = (
            feverGaugeTiles + ComboFeverRules.processedTilesForMergeCount(mergeCount)
        ).coerceAtMost(ComboFeverRules.FEVER_TARGET_TILES)

        if (feverGaugeTiles >= ComboFeverRules.FEVER_TARGET_TILES) {
            feverRemainingSeconds = ComboFeverRules.FEVER_DURATION_SECONDS
            feverCount += 1
        }
    }

    fun tick(deltaSeconds: Float) {
        val delta = deltaSeconds.coerceAtLeast(0f)
        if (delta <= 0f) return

        if (feverRemainingSeconds > 0f) {
            feverRemainingSeconds = (feverRemainingSeconds - delta).coerceAtLeast(0f)
            if (feverRemainingSeconds <= 0f) {
                feverGaugeTiles = 0
                if (combo > 0) {
                    comboRemainingSeconds = ComboFeverRules.comboWindowSeconds(combo)
                }
            }
            return
        }

        if (combo > 0) {
            comboRemainingSeconds = (comboRemainingSeconds - delta).coerceAtLeast(0f)
            if (comboRemainingSeconds <= 0f) {
                combo = 0
            }
        }
    }
}
