package com.sktpj.td2048

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

internal class RankingApiClient(
    private val baseUrl: String = "https://2048td-ranking.yukigbr3100.workers.dev",
) {
    suspend fun startRun(
        playerId: String,
        identity: RankingAppIdentity,
    ): RankingApiResult<RankingStartResponse> = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("playerId", playerId)
            .put("appVersion", identity.appVersion)
            .put("versionCode", identity.versionCode)
            .put("rulesetVersion", RANKING_RULESET_VERSION)
        when (val response = request("POST", "/v1/runs/start", body)) {
            is RankingApiResult.Failure -> response
            is RankingApiResult.Success -> {
                val json = response.value
                try {
                    RankingApiResult.Success(
                        RankingStartResponse(
                            runId = json.getString("runId"),
                            startedAt = json.getString("startedAt"),
                            rulesetVersion = json.getInt("rulesetVersion"),
                        ),
                    )
                } catch (_: Exception) {
                    RankingApiResult.Failure(200, "INVALID_RESPONSE", retryable = true)
                }
            }
        }
    }

    suspend fun finishRun(
        pending: PendingRankingFinish,
    ): RankingApiResult<RankingFinishResponse> = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("runId", pending.runId)
            .put("playerId", pending.playerId)
            .put("score", pending.score)
            .put("wave", pending.wave)
            .put("maxTile", pending.maxTile)
            .put("elapsedMs", pending.elapsedMs)
            .put("gameOverReason", pending.gameOverReason)
            .put("appVersion", pending.appVersion)
            .put("versionCode", pending.versionCode)
            .put("rulesetVersion", pending.rulesetVersion)
        when (val response = request("POST", "/v1/runs/finish", body)) {
            is RankingApiResult.Failure -> response
            is RankingApiResult.Success -> {
                val json = response.value
                try {
                    RankingApiResult.Success(
                        RankingFinishResponse(
                            bestUpdated = json.getBoolean("bestUpdated"),
                            score = json.getInt("score"),
                            bestScore = json.getInt("bestScore"),
                            rank = json.optIntOrNull("rank"),
                        ),
                    )
                } catch (_: Exception) {
                    RankingApiResult.Failure(200, "INVALID_RESPONSE", retryable = true)
                }
            }
        }
    }

    suspend fun getLeaderboard(
        rulesetVersion: Int = RANKING_RULESET_VERSION,
        limit: Int = 100,
    ): RankingApiResult<List<RankingEntry>> = withContext(Dispatchers.IO) {
        val safeLimit = limit.coerceIn(1, 100)
        when (
            val response = request(
                "GET",
                "/v1/leaderboard?rulesetVersion=$rulesetVersion&limit=$safeLimit",
                null,
            )
        ) {
            is RankingApiResult.Failure -> response
            is RankingApiResult.Success -> {
                try {
                    val entriesJson = response.value.getJSONArray("entries")
                    val entries = buildList {
                        for (index in 0 until entriesJson.length()) {
                            val item = entriesJson.getJSONObject(index)
                            add(
                                RankingEntry(
                                    rank = item.getInt("rank"),
                                    playerId = item.getString("playerId"),
                                    displayName = item.optString("displayName", "Anonymous"),
                                    score = item.getInt("score"),
                                    wave = item.getInt("wave"),
                                    maxTile = item.getInt("maxTile"),
                                    achievedAt = item.getString("achievedAt"),
                                ),
                            )
                        }
                    }
                    RankingApiResult.Success(entries)
                } catch (_: Exception) {
                    RankingApiResult.Failure(200, "INVALID_RESPONSE", retryable = true)
                }
            }
        }
    }

    suspend fun getMyRank(
        playerId: String,
        rulesetVersion: Int = RANKING_RULESET_VERSION,
    ): RankingApiResult<RankingPlayerRank> = withContext(Dispatchers.IO) {
        when (
            val response = request(
                "GET",
                "/v1/players/$playerId/rank?rulesetVersion=$rulesetVersion",
                null,
            )
        ) {
            is RankingApiResult.Failure -> response
            is RankingApiResult.Success -> {
                val json = response.value
                try {
                    RankingApiResult.Success(
                        RankingPlayerRank(
                            rank = json.optIntOrNull("rank"),
                            totalPlayers = json.optIntOrNull("totalPlayers"),
                            bestScore = json.optIntOrNull("bestScore"),
                            wave = json.optIntOrNull("wave"),
                            maxTile = json.optIntOrNull("maxTile"),
                        ),
                    )
                } catch (_: Exception) {
                    RankingApiResult.Failure(200, "INVALID_RESPONSE", retryable = true)
                }
            }
        }
    }

    private fun request(
        method: String,
        path: String,
        requestBody: JSONObject?,
    ): RankingApiResult<JSONObject> {
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL(baseUrl + path).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 5_000
                readTimeout = 5_000
                setRequestProperty("Accept", "application/json")
                if (requestBody != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                }
            }
            if (requestBody != null) {
                connection.outputStream.bufferedWriter(Charsets.UTF_8).use { writer ->
                    writer.write(requestBody.toString())
                }
            }
            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
            val responseText = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = if (responseText.isBlank()) JSONObject() else JSONObject(responseText)
            if (statusCode in 200..299) {
                RankingApiResult.Success(json)
            } else {
                val errorCode = json.optJSONObject("error")?.optString("code")?.takeIf { it.isNotBlank() }
                RankingApiResult.Failure(
                    statusCode = statusCode,
                    errorCode = errorCode,
                    retryable = statusCode == 429 || statusCode >= 500,
                )
            }
        } catch (_: IOException) {
            RankingApiResult.Failure(null, "NETWORK_ERROR", retryable = true)
        } catch (_: Exception) {
            RankingApiResult.Failure(null, "INVALID_RESPONSE", retryable = true)
        } finally {
            connection?.disconnect()
        }
    }
}

private fun JSONObject.optIntOrNull(name: String): Int? {
    if (!has(name) || isNull(name)) return null
    return optInt(name)
}
