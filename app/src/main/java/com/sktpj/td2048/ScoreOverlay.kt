package com.sktpj.td2048

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
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
internal fun ScoreOverlay(score: Int) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .padding(top = 58.dp, end = 10.dp),
        contentAlignment = Alignment.TopEnd,
    ) {
        Text(
            text = "SCORE  $score",
            modifier = Modifier
                .background(Color(0xE6191D24), RoundedCornerShape(9.dp))
                .border(1.dp, UiGold, RoundedCornerShape(9.dp))
                .padding(horizontal = 11.dp, vertical = 5.dp),
            color = UiGold,
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
        )
    }
}
