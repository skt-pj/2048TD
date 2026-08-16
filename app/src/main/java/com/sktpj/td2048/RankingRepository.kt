package com.sktpj.td2048

import android.content.Context
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import kotlin.math.roundToLong

internal sealed interface RankingSubmitResult {
    data class Accepted(val response: RankingFinishResponse) : RankingSubmitResult
    data object AlreadyAccepted : RankingSubmitResult
    data object Pending : RankingSubmitResult
    data class Rejected(val errorCode: String?) : RankingSubmitResult
}

internal class RankingRepository(
    context: Context,
    private val api: RankingApiClient = RankingApiClient(),
) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    val playerId: String by lazy {
        prefs.getString(KEY_PLAYER_ID, null)?.takeIf { it.isNotBlank() } ?: UUID.randomUUID()
            .toString()
            .also { prefs.edit().putString(KEY_PLAYER_ID, it).apply() }
    }

    fun appIdentity(): RankingAppIdentity {
        @Suppress("DEPRECATION")
        val packageInfo = appContext.packageManager.getPackageInfo(appContext.packageName, 0)
        val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageInfo.longVersionCode.toInt()
        } else {
            @Suppress("DEPRECATION")
            packageInfo.versionCode
        }
        return RankingAppIdentity(
            appVersion = packageInfo.versionName?.takeIf { it.isNotBlank() } ?: "unknown",
            versionCode = versionCode,
        )
    }

    suspend fun startRun(): RankingApiResult<RankingStartResponse> {
        return api.startRun(playerId, appIdentity())
    }

    fun createPendingFinish(
        runId: String,
        snapshot: GameSnapshot,
        reason: GameOverReason,
    ): PendingRankingFinish {
        val identity = appIdentity()
        return PendingRankingFinish(
            runId = runId,
            playerId = playerId,
            score = snapshot.score,
            wave = snapshot.wave,
            maxTile = snapshot.board.maxOrNull() ?: 0,
            elapsedMs = (snapshot.elapsedSeconds * 1000f).roundToLong().coerceAtLeast(0L),
            gameOverReason = reason.name,
            appVersion = identity.appVersion,
            versionCode = identity.versionCode,
            rulesetVersion = RANKING_RULESET_VERSION,
        )
    }

    suspend fun submitFinish(pending: PendingRankingFinish): RankingSubmitResult {
        enqueuePending(pending)
        return when (val result = api.finishRun(pending)) {
            is RankingApiResult.Success -> {
                removePending(pending.runId)
                RankingSubmitResult.Accepted(result.value)
            }
            is RankingApiResult.Failure -> {
                if (result.statusCode == 409 && result.errorCode == "RUN_ALREADY_FINISHED") {
                    removePending(pending.runId)
                    RankingSubmitResult.AlreadyAccepted
                } else if (
                    pendingFailureDisposition(result.statusCode, result.errorCode) ==
                    PendingFailureDisposition.CLEAR
                ) {
                    removePending(pending.runId)
                    RankingSubmitResult.Rejected(result.errorCode)
                } else {
                    RankingSubmitResult.Pending
                }
            }
        }
    }

    suspend fun retryPending() {
        val pending = readPendingQueue()
        for (item in pending) {
            when (val result = api.finishRun(item)) {
                is RankingApiResult.Success -> removePending(item.runId)
                is RankingApiResult.Failure -> {
                    if (
                        pendingFailureDisposition(result.statusCode, result.errorCode) ==
                        PendingFailureDisposition.CLEAR
                    ) {
                        removePending(item.runId)
                    }
                }
            }
        }
    }

    suspend fun getLeaderboard(): RankingApiResult<List<RankingEntry>> {
        return api.getLeaderboard(RANKING_RULESET_VERSION, 100)
    }

    suspend fun getMyRank(): RankingApiResult<RankingPlayerRank> {
        return api.getMyRank(playerId, RANKING_RULESET_VERSION)
    }

    private fun enqueuePending(item: PendingRankingFinish) {
        synchronized(prefs) {
            val current = readPendingQueueUnsafe().filterNot { it.runId == item.runId } + item
            writePendingQueueUnsafe(current)
        }
    }

    private fun removePending(runId: String) {
        synchronized(prefs) {
            writePendingQueueUnsafe(readPendingQueueUnsafe().filterNot { it.runId == runId })
        }
    }

    private fun readPendingQueue(): List<PendingRankingFinish> = synchronized(prefs) {
        readPendingQueueUnsafe()
    }

    private fun readPendingQueueUnsafe(): List<PendingRankingFinish> {
        val raw = prefs.getString(KEY_PENDING, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.optJSONObject(index) ?: continue
                    parsePending(item)?.let(::add)
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun writePendingQueueUnsafe(items: List<PendingRankingFinish>) {
        val array = JSONArray()
        items.forEach { item -> array.put(item.toJson()) }
        prefs.edit().putString(KEY_PENDING, array.toString()).apply()
    }

    private fun PendingRankingFinish.toJson(): JSONObject = JSONObject()
        .put("runId", runId)
        .put("playerId", playerId)
        .put("score", score)
        .put("wave", wave)
        .put("maxTile", maxTile)
        .put("elapsedMs", elapsedMs)
        .put("gameOverReason", gameOverReason)
        .put("appVersion", appVersion)
        .put("versionCode", versionCode)
        .put("rulesetVersion", rulesetVersion)

    private fun parsePending(json: JSONObject): PendingRankingFinish? = try {
        PendingRankingFinish(
            runId = json.getString("runId"),
            playerId = json.getString("playerId"),
            score = json.getInt("score"),
            wave = json.getInt("wave"),
            maxTile = json.getInt("maxTile"),
            elapsedMs = json.getLong("elapsedMs"),
            gameOverReason = json.getString("gameOverReason"),
            appVersion = json.getString("appVersion"),
            versionCode = json.getInt("versionCode"),
            rulesetVersion = json.getInt("rulesetVersion"),
        )
    } catch (_: Exception) {
        null
    }

    private companion object {
        const val PREFS_NAME = "2048td-ranking"
        const val KEY_PLAYER_ID = "player_id"
        const val KEY_PENDING = "pending_finishes"
    }
}
