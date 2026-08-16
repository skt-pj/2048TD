package com.sktpj.td2048

internal const val RANKING_RULESET_VERSION = 1

data class RankingAppIdentity(
    val appVersion: String,
    val versionCode: Int,
)

data class RankingStartResponse(
    val runId: String,
    val startedAt: String,
    val rulesetVersion: Int,
)

data class RankingFinishResponse(
    val bestUpdated: Boolean,
    val score: Int,
    val bestScore: Int,
    val rank: Int?,
)

data class RankingEntry(
    val rank: Int,
    val playerId: String,
    val displayName: String,
    val score: Int,
    val wave: Int,
    val maxTile: Int,
    val achievedAt: String,
)

data class RankingPlayerRank(
    val rank: Int?,
    val totalPlayers: Int?,
    val bestScore: Int?,
    val wave: Int?,
    val maxTile: Int?,
)

data class PendingRankingFinish(
    val runId: String,
    val playerId: String,
    val score: Int,
    val wave: Int,
    val maxTile: Int,
    val elapsedMs: Long,
    val gameOverReason: String,
    val appVersion: String,
    val versionCode: Int,
    val rulesetVersion: Int,
)

sealed interface RankingApiResult<out T> {
    data class Success<T>(val value: T) : RankingApiResult<T>
    data class Failure(
        val statusCode: Int?,
        val errorCode: String?,
        val retryable: Boolean,
    ) : RankingApiResult<Nothing>
}

sealed interface RankingSubmissionState {
    data object Starting : RankingSubmissionState
    data object Ready : RankingSubmissionState
    data object Submitting : RankingSubmissionState
    data class Submitted(
        val rank: Int?,
        val bestScore: Int,
        val bestUpdated: Boolean,
    ) : RankingSubmissionState
    data object SubmittedEarlier : RankingSubmissionState
    data object Pending : RankingSubmissionState
    data object Unavailable : RankingSubmissionState
}

sealed interface RankingBoardState {
    data object Loading : RankingBoardState
    data class Loaded(
        val entries: List<RankingEntry>,
        val myRank: RankingPlayerRank,
    ) : RankingBoardState
    data object Error : RankingBoardState
}

internal enum class PendingFailureDisposition {
    CLEAR,
    KEEP,
}

internal fun pendingFailureDisposition(
    statusCode: Int?,
    errorCode: String?,
): PendingFailureDisposition {
    if (statusCode == null || statusCode == 429 || statusCode >= 500) {
        return PendingFailureDisposition.KEEP
    }
    if (statusCode == 409 && errorCode == "RUN_ALREADY_FINISHED") {
        return PendingFailureDisposition.CLEAR
    }
    return PendingFailureDisposition.CLEAR
}
