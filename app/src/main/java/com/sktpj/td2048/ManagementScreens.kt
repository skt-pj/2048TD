package com.sktpj.td2048

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun HomeScreen(
    formation: List<CharacterDefinition>,
    onStart: () -> Unit,
    onFormation: () -> Unit,
    onCharacters: () -> Unit,
    onGacha: () -> Unit,
) {
    val maxHp = FormationRules.maxHp(formation)
    val bossCount = formation.count { it.ability == CharacterAbility.BOSS_BONUS }
    val slowCount = formation.count { it.ability == CharacterAbility.SLOW }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(listOf(Color(0xFF18130E), UiBackground, UiBackground)),
            )
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Spacer(Modifier.height(8.dp))
        Text("2048TD", color = UiGold, fontSize = 38.sp, fontWeight = FontWeight.Black)
        Text("2048 × LINE DEFENSE", color = UiMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(UiPanel, RoundedCornerShape(14.dp))
                .border(1.5.dp, UiGoldSoft, RoundedCornerShape(14.dp))
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                HomeStat("TOTAL HP", maxHp.toString(), UiHp, Modifier.weight(1f))
                HomeStat("BOSS+", bossCount.toString(), UiBoss, Modifier.weight(1f))
                HomeStat("SLOW", slowCount.toString(), UiScissors, Modifier.weight(1f))
            }
            Text(
                "大きい数字を作るだけでは勝てない。敵レーンとセル位置を見て数字を動かす。",
                color = UiText,
                fontSize = 9.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Button(
            onClick = onStart,
            modifier = Modifier.fillMaxWidth().height(58.dp),
            colors = ButtonDefaults.buttonColors(containerColor = UiGoldSoft),
        ) {
            Text("BATTLE START", color = UiText, fontSize = 16.sp, fontWeight = FontWeight.Black)
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MenuButton("編成", "16セル配置", onFormation, Modifier.weight(1f))
            MenuButton("キャラ", "一覧・詳細", onCharacters, Modifier.weight(1f))
        }
        MenuButton("ガチャ", "キャラ獲得入口", onGacha, Modifier.fillMaxWidth())

        Spacer(Modifier.weight(1f))
        Text(
            "グー > チョキ > パー > グー  /  同じ数字は属性に関係なくマージ",
            color = UiMuted,
            fontSize = 7.sp,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun HomeStat(label: String, value: String, accent: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .height(52.dp)
            .background(accent.copy(alpha = 0.08f), RoundedCornerShape(9.dp))
            .border(1.dp, accent.copy(alpha = 0.32f), RoundedCornerShape(9.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(label, color = accent, fontSize = 7.sp, fontWeight = FontWeight.Bold)
        Text(value, color = UiText, fontSize = 14.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun MenuButton(
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(62.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, UiBorder),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = UiPanel),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, color = UiText, fontSize = 13.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = UiMuted, fontSize = 7.sp)
        }
    }
}

@Composable
internal fun CharacterCollectionScreen(
    characters: List<CharacterDefinition>,
    formation: List<CharacterDefinition>,
    initialCharacter: CharacterDefinition? = null,
    onBack: () -> Unit,
) {
    var selected by remember(initialCharacter) { mutableStateOf(initialCharacter ?: characters.first()) }
    var handFilter by remember { mutableStateOf<HandType?>(null) }
    var abilityFilter by remember { mutableStateOf<CharacterAbility?>(null) }
    val visible = characters.filter { character ->
        (handFilter == null || character.handType == handFilter) &&
            (abilityFilter == null || character.ability == abilityFilter)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(UiBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(9.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        ScreenTitleBar(
            title = "CHARACTERS",
            subtitle = "所有キャラ一覧・詳細",
            rightText = "${characters.size} OWNED",
            onBack = onBack,
        )

        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            SmallFilter("ALL", handFilter == null && abilityFilter == null) {
                handFilter = null; abilityFilter = null
            }
            SmallFilter("グー", handFilter == HandType.ROCK) { handFilter = HandType.ROCK; abilityFilter = null }
            SmallFilter("チョキ", handFilter == HandType.SCISSORS) { handFilter = HandType.SCISSORS; abilityFilter = null }
            SmallFilter("パー", handFilter == HandType.PAPER) { handFilter = HandType.PAPER; abilityFilter = null }
            SmallFilter("BOSS+", abilityFilter == CharacterAbility.BOSS_BONUS) { handFilter = null; abilityFilter = CharacterAbility.BOSS_BONUS }
            SmallFilter("SLOW", abilityFilter == CharacterAbility.SLOW) { handFilter = null; abilityFilter = CharacterAbility.SLOW }
        }

        CharacterDetailPanel(
            character = selected,
            cellIndex = formation.indexOfFirst { it.characterId == selected.characterId },
            modifier = Modifier.fillMaxWidth().weight(0.72f),
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1.28f)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            visible.chunked(2).forEach { pair ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    pair.forEach { character ->
                        CharacterListCard(
                            character = character,
                            selected = character.characterId == selected.characterId,
                            cellIndex = formation.indexOfFirst { it.characterId == character.characterId },
                            onClick = { selected = character },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun CharacterDetailPanel(
    character: CharacterDefinition,
    cellIndex: Int,
    modifier: Modifier = Modifier,
) {
    val accent = handColor(character.handType)
    Row(
        modifier = modifier
            .background(
                Brush.horizontalGradient(listOf(accent.copy(alpha = 0.13f), UiPanel, UiPanel)),
                RoundedCornerShape(12.dp),
            )
            .border(1.5.dp, accent.copy(alpha = 0.65f), RoundedCornerShape(12.dp))
            .padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CharacterAvatar(character, size = 72.dp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(character.name, color = UiText, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                HandIcon(character.handType, Modifier.size(18.dp))
                Text("${handLabel(character.handType)}  Lv.${character.level}", color = accent, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Text(handRoleLabel(character.handType), color = UiMuted, fontSize = 7.sp)
            Text("HP ${character.baseHp}", color = UiText, fontSize = 9.sp)
            Text("攻撃係数 ×${formatMultiplier(character.attackCoefficient)}", color = UiText, fontSize = 9.sp)
            Text("攻撃間隔 ${character.attackIntervalMs}ms", color = UiText, fontSize = 9.sp)
            Text("特殊能力: ${abilityLabel(character.ability)}", color = if (character.ability == CharacterAbility.NONE) UiMuted else UiBoss, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            Text(
                if (cellIndex >= 0) "編成位置 ${cellLabel(cellIndex)}" else "現在未編成",
                color = if (cellIndex >= 0) UiGood else UiMuted,
                fontSize = 8.sp,
            )
        }
    }
}

@Composable
private fun CharacterListCard(
    character: CharacterDefinition,
    selected: Boolean,
    cellIndex: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val accent = handColor(character.handType)
    Row(
        modifier = modifier
            .height(82.dp)
            .background(Color(0xFF171B21), RoundedCornerShape(9.dp))
            .border(if (selected) 2.dp else 1.dp, if (selected) UiWarning else accent.copy(alpha = 0.45f), RoundedCornerShape(9.dp))
            .clickable(onClick = onClick)
            .padding(6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        CharacterAvatar(character, size = 40.dp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(character.name, color = UiText, fontSize = 9.sp, fontWeight = FontWeight.Black)
            Text("${handLabel(character.handType)}  Lv.${character.level}", color = accent, fontSize = 7.sp)
            Text("HP ${character.baseHp}  ATK×${formatMultiplier(character.attackCoefficient)}", color = UiMuted, fontSize = 6.sp)
            Text("${character.attackIntervalMs}ms  ${abilityLabel(character.ability)}", color = UiMuted, fontSize = 6.sp)
            if (cellIndex >= 0) Text(cellLabel(cellIndex), color = UiGood, fontSize = 6.sp)
        }
    }
}

@Composable
private fun SmallFilter(label: String, selected: Boolean, onClick: () -> Unit) {
    TextButton(
        onClick = onClick,
        colors = ButtonDefaults.textButtonColors(containerColor = if (selected) UiGoldSoft else UiPanel),
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
    ) {
        Text(label, color = if (selected) UiText else UiMuted, fontSize = 7.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
internal fun GachaEntranceScreen(
    characters: List<CharacterDefinition>,
    onBack: () -> Unit,
    onCharacters: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(UiBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(9.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        ScreenTitleBar(
            title = "GACHA",
            subtitle = "キャラクター獲得入口",
            rightText = "${characters.size} OWNED",
            onBack = onBack,
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(
                    Brush.verticalGradient(listOf(Color(0xFF25172A), UiPanelDeep)),
                    RoundedCornerShape(15.dp),
                )
                .border(1.5.dp, UiBoss.copy(alpha = 0.65f), RoundedCornerShape(15.dp))
                .padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text("CHARACTER GACHA", color = UiBoss, fontSize = 20.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                characters.take(3).forEach { CharacterAvatar(it, size = 66.dp) }
            }
            Spacer(Modifier.height(14.dp))
            Text(
                "獲得対象はキャラクター。獲得したキャラは一覧に追加され、16セル編成で使用します。",
                color = UiText,
                fontSize = 10.sp,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(9.dp))
            Text(
                "排出率・価格・天井・重複処理・限界突破は未確定です。画面仕様が確定するまで実際の抽選は行いません。",
                color = UiWarning,
                fontSize = 9.sp,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = {},
                enabled = false,
                modifier = Modifier.fillMaxWidth(0.78f),
            ) {
                Text("ガチャ仕様確定後に有効化")
            }
        }

        OutlinedButton(onClick = onCharacters, modifier = Modifier.fillMaxWidth()) {
            Text("所有キャラを見る")
        }
    }
}
