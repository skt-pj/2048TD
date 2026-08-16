package com.sktpj.td2048

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun RankingHomeButton(onClick: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().statusBarsPadding(),
        contentAlignment = Alignment.TopEnd,
    ) {
        OutlinedButton(
            onClick = onClick,
            modifier = Modifier.padding(top = 10.dp, end = 10.dp),
        ) {
            Text("RANKING", fontSize = 9.sp, fontWeight = FontWeight.Black)
        }
    }
}
