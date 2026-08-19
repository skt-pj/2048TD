package com.sktpj.td2048

internal data class ComboFeverSnapshot(
    /** Number of merges resolved by the most recent successful swipe. */
    val combo: Int = 0,
    /** Monotonic event id so the UI animates once per successful swipe. */
    val comboEventId: Int = 0,
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
    // Tsum Tsum-style gauge: 29 cleared pieces fills FEVER. A 2048 merge consumes two tiles,
    // so each merge contributes two processed tiles. This is intentionally not a time-combo rule.
    const val FEVER_TARGET_TILES = 29
    const val FEVER_DURATION_SECONDS = 11f

    fun processedTilesForMergeCount(mergeCount: Int): Int =
        mergeCount.coerceAtLeast(0) * 2
}

internal class ComboFeverController {
    private var combo = 0
    private var comboEventId = 0
    private var feverGaugeTiles = 0
    private var feverRemainingSeconds = 0f
    private var feverCount = 0

    fun snapshot(): ComboFeverSnapshot = ComboFeverSnapshot(
        combo = combo,
        comboEventId = comboEventId,
        feverGaugeTiles = feverGaugeTiles,
        feverRemainingSeconds = feverRemainingSeconds,
        feverCount = feverCount,
    )

    fun reset() {
        combo = 0
        comboEventId = 0
        feverGaugeTiles = 0
        feverRemainingSeconds = 0f
        feverCount = 0
    }

    /**
     * COMBO follows the Puzzle & Dragons-style result model: one player gesture resolves to N
     * simultaneous merge groups, therefore N is the combo count for that move. There is no
     * cross-move timeout and no pressure to swipe before a timer expires.
     */
    fun onMerge(mergeCount: Int) {
        if (mergeCount <= 0) return

        combo = mergeCount
        comboEventId += 1

        if (feverRemainingSeconds > 0f) return

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
        if (delta <= 0f || feverRemainingSeconds <= 0f) return

        feverRemainingSeconds = (feverRemainingSeconds - delta).coerceAtLeast(0f)
        if (feverRemainingSeconds <= 0f) {
            feverGaugeTiles = 0
        }
    }
}
