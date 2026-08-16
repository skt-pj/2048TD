package com.sktpj.td2048

import org.junit.Assert.assertEquals
import org.junit.Test

class RankingPolicyTest {
    @Test
    fun networkAndServerFailuresStayPending() {
        assertEquals(
            PendingFailureDisposition.KEEP,
            pendingFailureDisposition(null, "NETWORK_ERROR"),
        )
        assertEquals(
            PendingFailureDisposition.KEEP,
            pendingFailureDisposition(429, "RATE_LIMITED"),
        )
        assertEquals(
            PendingFailureDisposition.KEEP,
            pendingFailureDisposition(500, "INTERNAL_ERROR"),
        )
    }

    @Test
    fun permanentClientFailuresAreRemovedFromPendingQueue() {
        assertEquals(
            PendingFailureDisposition.CLEAR,
            pendingFailureDisposition(400, "INVALID_SCORE"),
        )
        assertEquals(
            PendingFailureDisposition.CLEAR,
            pendingFailureDisposition(403, "PLAYER_MISMATCH"),
        )
        assertEquals(
            PendingFailureDisposition.CLEAR,
            pendingFailureDisposition(404, "RUN_NOT_FOUND"),
        )
        assertEquals(
            PendingFailureDisposition.CLEAR,
            pendingFailureDisposition(409, "RULESET_MISMATCH"),
        )
    }

    @Test
    fun duplicateAlreadyFinishedResponseClearsPendingQueue() {
        assertEquals(
            PendingFailureDisposition.CLEAR,
            pendingFailureDisposition(409, "RUN_ALREADY_FINISHED"),
        )
    }
}
