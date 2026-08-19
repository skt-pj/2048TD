package com.sktpj.td2048

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlin.math.ceil

private val FeverPanel = Color(0xE6060A0F)
private val FeverCyan = Color(0xFF00F5FF)
private val FeverPink = Color(0xFFFF35D3)
private val FeverText = Color(0xFFF4FBFF)
private val FeverMuted = Color(0xFFA4B7C2)

@Composable
internal fun ComboFeverOverlay(
    state: ComboFeverSnapshot,
    simpleEffects: Boolean,
) {
    var seenFeverCount by remember { mutableIntStateOf(state.feverCount) }
    var showFeverFlash by remember { mutableStateOf(false) }

    LaunchedEffect(state.feverCount) {
        when {
            state.feverCount < seenFeverCount -> {
                seenFeverCount = state.feverCount
                showFeverFlash = false
            }
            state.feverCount > seenFeverCount -> {
                seenFeverCount = state.feverCount
                showFeverFlash = true
                delay(if (simpleEffects) 300 else 650)
                showFeverFlash = false
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (state.feverActive) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(FeverPink.copy(alpha = if (simpleEffects) 0.025f else 0.055f))
                    .border(2.dp, FeverPink.copy(alpha = if (simpleEffects) 0.45f else 0.80f)),
            )
        }

        Column(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(start = 10.dp, top = 66.dp)
                .width(112.dp)
                .background(FeverPanel, RoundedCornerShape(9.dp))
                .border(
                    1.dp,
                    if (state.feverActive) FeverPink.copy(alpha = 0.88f) else FeverCyan.copy(alpha = 0.50f),
                    RoundedCornerShape(9.dp),
                )
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalAlignment = Alignment.Start,
        ) {
            Text(
                text = if (state.combo > 0) "COMBO ${state.combo}" else "COMBO -",
                color = if (state.combo > 0) FeverText else FeverMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
            )
            Text(
                text = if (state.feverActive) {
                    "FEVER ${ceil(state.feverRemainingSeconds).toInt()}s"
                } else {
                    "FEVER ${state.feverGaugeTiles}/${ComboFeverRules.FEVER_TARGET_TILES}"
                },
                color = if (state.feverActive) FeverPink else FeverCyan,
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 4.dp),
            )
            Box(
                modifier = Modifier
                    .padding(top = 3.dp)
                    .fillMaxWidth()
                    .height(6.dp)
                    .background(Color(0xFF101820), RoundedCornerShape(3.dp)),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(state.feverGaugeRatio)
                        .fillMaxHeight()
                        .background(
                            if (state.feverActive) FeverPink else FeverCyan,
                            RoundedCornerShape(3.dp),
                        ),
                )
            }
        }

        if (showFeverFlash) {
            Text(
                text = "FEVER!",
                modifier = Modifier
                    .align(Alignment.Center)
                    .width(220.dp)
                    .background(Color(0xD9020406), RoundedCornerShape(14.dp))
                    .border(2.dp, FeverPink, RoundedCornerShape(14.dp))
                    .padding(vertical = 12.dp),
                color = FeverPink,
                fontSize = 34.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
            )
        }
    }
}
