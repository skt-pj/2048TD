package com.sktpj.td2048

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.ceil

@Composable
internal fun ComboFeverOverlay(state: ComboFeverSnapshot) {
    val accent = if (state.feverActive) UiBoss else UiGold
    val status = if (state.feverActive) {
        "${ceil(state.feverRemainingSeconds).toInt()}s"
    } else {
        "${state.feverGaugeTiles}/${ComboFeverRules.FEVER_TARGET_TILES}"
    }

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier
                .padding(top = 60.dp)
                .width(190.dp)
                .background(UiPanel.copy(alpha = 0.94f), RoundedCornerShape(10.dp))
                .border(1.dp, accent.copy(alpha = 0.80f), RoundedCornerShape(10.dp))
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = if (state.feverActive) "FEVER" else "FEVER GAUGE",
                    color = accent,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                )
                Text(
                    text = status,
                    color = UiText,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .background(Color(0xFF252A33), RoundedCornerShape(3.dp)),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(state.feverGaugeRatio)
                        .fillMaxHeight()
                        .background(accent, RoundedCornerShape(3.dp)),
                )
            }
            Text(
                text = if (state.feverActive) {
                    "ALL LANES"
                } else if (state.combo > 0) {
                    "${state.combo} COMBO"
                } else {
                    "MERGE TO CHARGE"
                },
                modifier = Modifier.align(Alignment.CenterHorizontally),
                color = if (state.feverActive) UiText else UiMuted,
                fontSize = 8.sp,
                fontWeight = if (state.feverActive) FontWeight.Black else FontWeight.Bold,
            )
        }
    }
}
