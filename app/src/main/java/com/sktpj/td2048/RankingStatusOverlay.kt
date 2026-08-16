package com.sktpj.td2048

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun RankingGameOverStatusOverlay(state: RankingSubmissionState) {
    val text = when (state) {
        RankingSubmissionState.Starting -> "RANKING  接続中"
        RankingSubmissionState.Ready -> "RANKING  登録待機"
        RankingSubmissionState.Submitting -> "RANKING  SCORE送信中"
        is RankingSubmissionState.Submitted -> {
            val rank = state.rank?.let { "#$it" } ?: "--"
            "RANK $rank   BEST ${state.bestScore}"
        }
        RankingSubmissionState.SubmittedEarlier -> "RANKING  登録済み"
        RankingSubmissionState.Pending -> "RANKING  送信待ち / 次回自動再送"
        RankingSubmissionState.Unavailable -> "RANKING  オフライン"
    }
    val accent = when (state) {
        is RankingSubmissionState.Submitted,
        RankingSubmissionState.SubmittedEarlier -> UiGold
        RankingSubmissionState.Pending -> UiWarning
        RankingSubmissionState.Unavailable -> UiMuted
        else -> UiScissors
    }
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Text(
            text = text,
            modifier = Modifier
                .padding(bottom = 78.dp)
                .background(Color(0xF0181C22), RoundedCornerShape(9.dp))
                .border(1.dp, accent, RoundedCornerShape(9.dp))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            color = accent,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
        )
    }
}
