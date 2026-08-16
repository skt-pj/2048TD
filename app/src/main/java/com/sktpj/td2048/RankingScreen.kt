package com.sktpj.td2048

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun RankingScreen(
    state: RankingBoardState,
    onBack: () -> Unit,
    onReload: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(UiBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedButton(onClick = onBack) { Text("戻る") }
            Column(modifier = Modifier.weight(1f)) {
                Text("RANKING", color = UiGold, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Text("WORLD TOP 100 / RULESET 1", color = UiMuted, fontSize = 8.sp)
            }
            OutlinedButton(onClick = onReload) { Text("更新") }
        }

        when (state) {
            RankingBoardState.Loading -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = UiGold)
            }

            RankingBoardState.Error -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("ランキングを取得できませんでした", color = UiText)
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = onReload,
                        colors = ButtonDefaults.buttonColors(containerColor = UiGoldSoft),
                    ) {
                        Text("再読み込み")
                    }
                }
            }

            is RankingBoardState.Loaded -> {
                MyRankCard(state.myRank)
                RankingHeader()
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    if (state.entries.isEmpty()) {
                        item {
                            Text(
                                "まだランキング記録がありません",
                                modifier = Modifier.fillMaxWidth().padding(24.dp),
                                color = UiMuted,
                                textAlign = TextAlign.Center,
                            )
                        }
                    } else {
                        items(state.entries, key = { it.playerId }) { entry ->
                            RankingRow(entry)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MyRankCard(rank: RankingPlayerRank) {
    val rankText = rank.rank?.let { "#$it" } ?: "--"
    val bestText = rank.bestScore?.toString() ?: "--"
    val detail = if (rank.rank == null) {
        "まだ自己ベストが登録されていません"
    } else {
        "WAVE ${rank.wave ?: 0}   MAX ${rank.maxTile ?: 0}   /   ${rank.totalPlayers ?: 0} PLAYERS"
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF171A20), RoundedCornerShape(12.dp))
            .border(1.dp, UiGoldSoft, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("MY RANK", color = UiMuted, fontSize = 7.sp)
            Text(rankText, color = UiGold, fontSize = 21.sp, fontWeight = FontWeight.Black)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text("BEST SCORE $bestText", color = UiText, fontSize = 14.sp, fontWeight = FontWeight.Black)
            Text(detail, color = UiMuted, fontSize = 8.sp)
        }
    }
}

@Composable
private fun RankingHeader() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("RANK", color = UiMuted, fontSize = 7.sp, modifier = Modifier.weight(0.55f))
        Text("PLAYER", color = UiMuted, fontSize = 7.sp, modifier = Modifier.weight(1.35f))
        Text("SCORE", color = UiMuted, fontSize = 7.sp, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
        Text("WAVE", color = UiMuted, fontSize = 7.sp, textAlign = TextAlign.End, modifier = Modifier.weight(0.7f))
        Text("MAX", color = UiMuted, fontSize = 7.sp, textAlign = TextAlign.End, modifier = Modifier.weight(0.8f))
    }
}

@Composable
private fun RankingRow(entry: RankingEntry) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF11151B), RoundedCornerShape(9.dp))
            .border(1.dp, Color(0xFF303640), RoundedCornerShape(9.dp))
            .padding(horizontal = 8.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "#${entry.rank}",
            color = if (entry.rank <= 3) UiGold else UiText,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.weight(0.55f),
        )
        Text(
            entry.displayName,
            color = UiText,
            fontSize = 10.sp,
            maxLines = 1,
            modifier = Modifier.weight(1.35f),
        )
        Text(
            entry.score.toString(),
            color = UiGold,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(1f),
        )
        Text(
            entry.wave.toString(),
            color = UiText,
            fontSize = 9.sp,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(0.7f),
        )
        Text(
            entry.maxTile.toString(),
            color = UiText,
            fontSize = 9.sp,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(0.8f),
        )
    }
}
