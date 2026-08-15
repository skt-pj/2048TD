package com.sktpj.td2048

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private enum class RosterFilter { ALL, ROCK, SCISSORS, PAPER, BOSS, SLOW }

@Composable
internal fun FormationScreen(
    formation: List<CharacterDefinition>,
    ownedCharacters: List<CharacterDefinition>,
    onFormationChange: (List<CharacterDefinition>) -> Unit,
    onShowCharacter: (CharacterDefinition) -> Unit,
    onSave: () -> Unit,
    onCancel: () -> Unit,
) {
    var selectedCell by remember { mutableStateOf<Int?>(null) }
    var filter by remember { mutableStateOf(RosterFilter.ALL) }
    val maxHp = FormationRules.maxHp(formation)
    val visibleRoster = ownedCharacters.filter { character ->
        when (filter) {
            RosterFilter.ALL -> true
            RosterFilter.ROCK -> character.handType == HandType.ROCK
            RosterFilter.SCISSORS -> character.handType == HandType.SCISSORS
            RosterFilter.PAPER -> character.handType == HandType.PAPER
            RosterFilter.BOSS -> character.ability == CharacterAbility.BOSS_BONUS
            RosterFilter.SLOW -> character.ability == CharacterAbility.SLOW
        }
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
            title = "FORMATION",
            subtitle = "16セル編成",
            rightText = "総HP $maxHp",
            onBack = onCancel,
        )

        Text(
            text = "セルを選択し、下の所有キャラを選んで配置します。中央2列はBOSS攻撃可能列です。",
            color = UiMuted,
            fontSize = 8.sp,
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1.10f)
                .background(UiPanel, RoundedCornerShape(12.dp))
                .border(1.dp, UiGoldSoft, RoundedCornerShape(12.dp))
                .padding(5.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            FormationAttackGutter(Modifier.width(45.dp).fillMaxHeight())
            Column(
                modifier = Modifier.weight(1f).fillMaxHeight(),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                repeat(GameRules.GRID_SIZE) { row ->
                    Row(
                        modifier = Modifier.fillMaxWidth().weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        repeat(GameRules.GRID_SIZE) { col ->
                            val index = GameRules.cellIndex(row, col)
                            FormationCell(
                                index = index,
                                character = formation[index],
                                selected = selectedCell == index,
                                bossColumn = col == 1 || col == 2,
                                onClick = { selectedCell = index },
                                onDetail = { onShowCharacter(formation[index]) },
                                modifier = Modifier.weight(1f).fillMaxHeight(),
                            )
                        }
                    }
                }
            }
            FormationHpGutter(Modifier.width(45.dp).fillMaxHeight())
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.90f)
                .background(UiPanelDeep, RoundedCornerShape(12.dp))
                .border(1.dp, UiBorder, RoundedCornerShape(12.dp))
                .padding(7.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text("OWNED CHARACTERS", color = UiText, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    Text(
                        selectedCell?.let { "選択セル ${cellLabel(it)}" } ?: "先に配置セルを選択",
                        color = if (selectedCell == null) UiWarning else UiGood,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Text("${ownedCharacters.size} OWNED", color = UiMuted, fontSize = 7.sp)
            }

            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                FilterButton("ALL", filter == RosterFilter.ALL) { filter = RosterFilter.ALL }
                FilterButton("グー", filter == RosterFilter.ROCK) { filter = RosterFilter.ROCK }
                FilterButton("チョキ", filter == RosterFilter.SCISSORS) { filter = RosterFilter.SCISSORS }
                FilterButton("パー", filter == RosterFilter.PAPER) { filter = RosterFilter.PAPER }
                FilterButton("BOSS+", filter == RosterFilter.BOSS) { filter = RosterFilter.BOSS }
                FilterButton("SLOW", filter == RosterFilter.SLOW) { filter = RosterFilter.SLOW }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                visibleRoster.chunked(2).forEach { rowCharacters ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                    ) {
                        rowCharacters.forEach { character ->
                            val currentIndex = formation.indexOfFirst { it.characterId == character.characterId }
                            OwnedCharacterCard(
                                character = character,
                                currentIndex = currentIndex,
                                onClick = {
                                    val target = selectedCell ?: return@OwnedCharacterCard
                                    if (currentIndex == target) return@OwnedCharacterCard
                                    val next = formation.toMutableList()
                                    if (currentIndex >= 0) {
                                        val displaced = next[target]
                                        next[target] = character
                                        next[currentIndex] = displaced
                                    } else {
                                        next[target] = character
                                    }
                                    if (next.map { it.characterId }.distinct().size == GameRules.CELL_COUNT) {
                                        onFormationChange(next)
                                    }
                                },
                                onDetail = { onShowCharacter(character) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                        if (rowCharacters.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            OutlinedButton(onClick = onCancel, modifier = Modifier.weight(1f)) { Text("キャンセル") }
            Button(
                onClick = onSave,
                modifier = Modifier.weight(1.25f),
                colors = ButtonDefaults.buttonColors(containerColor = UiGoldSoft),
            ) {
                Text("編成を保存", color = UiText, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun FormationCell(
    index: Int,
    character: CharacterDefinition,
    selected: Boolean,
    bossColumn: Boolean,
    onClick: () -> Unit,
    onDetail: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val accent = handColor(character.handType)
    val borderColor = when {
        selected -> UiWarning
        bossColumn -> UiBoss.copy(alpha = 0.75f)
        else -> accent.copy(alpha = 0.75f)
    }
    Column(
        modifier = modifier
            .background(Color(0xFF1B2027), RoundedCornerShape(8.dp))
            .border(if (selected) 2.5.dp else 1.3.dp, borderColor, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(3.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(cellLabel(index), color = UiMuted, fontSize = 6.sp)
            if (bossColumn) Text("◆", color = UiBoss, fontSize = 8.sp)
        }
        CharacterAvatar(character, size = 34.dp)
        Text(character.name, color = UiText, fontSize = 8.sp, fontWeight = FontWeight.Black, maxLines = 1)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Lv.${character.level}", color = UiMuted, fontSize = 6.sp)
            AbilityBadge(character.ability, Modifier.size(17.dp, 11.dp))
        }
        Text(
            "詳細",
            modifier = Modifier.clickable(onClick = onDetail).padding(horizontal = 4.dp, vertical = 1.dp),
            color = accent,
            fontSize = 6.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun OwnedCharacterCard(
    character: CharacterDefinition,
    currentIndex: Int,
    onClick: () -> Unit,
    onDetail: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val accent = handColor(character.handType)
    Row(
        modifier = modifier
            .background(Color(0xFF181D24), RoundedCornerShape(8.dp))
            .border(1.dp, accent.copy(alpha = 0.55f), RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        CharacterAvatar(character, size = 36.dp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(character.name, color = UiText, fontSize = 9.sp, fontWeight = FontWeight.Black)
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                HandIcon(character.handType, Modifier.size(12.dp))
                Text("Lv.${character.level}", color = UiMuted, fontSize = 7.sp)
                AbilityBadge(character.ability, Modifier.size(19.dp, 12.dp))
            }
            Text(
                "HP ${character.baseHp}  ATK×${formatMultiplier(character.attackCoefficient)}  ${character.attackIntervalMs}ms",
                color = UiMuted,
                fontSize = 6.sp,
                maxLines = 1,
            )
            Text(
                if (currentIndex >= 0) "編成中 ${cellLabel(currentIndex)}" else "未編成",
                color = if (currentIndex >= 0) UiGood else UiMuted,
                fontSize = 6.sp,
            )
        }
        TextButton(onClick = onDetail, contentPadding = PaddingValues(2.dp)) {
            Text("詳細", color = accent, fontSize = 7.sp)
        }
    }
}

@Composable
private fun FilterButton(label: String, selected: Boolean, onClick: () -> Unit) {
    TextButton(
        onClick = onClick,
        colors = ButtonDefaults.textButtonColors(containerColor = if (selected) UiGoldSoft else Color(0xFF20242B)),
        contentPadding = PaddingValues(horizontal = 9.dp, vertical = 2.dp),
    ) {
        Text(label, color = if (selected) UiText else UiMuted, fontSize = 7.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun FormationAttackGutter(modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(4) { row ->
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth().background(UiDanger.copy(alpha = 0.08f), RoundedCornerShape(7.dp)),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("ATK", color = UiDanger, fontSize = 6.sp, fontWeight = FontWeight.Black)
                Text("×${formatMultiplier(FormationRules.rowAttackMultiplier[row])}", color = UiText, fontSize = 7.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun FormationHpGutter(modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(4) { row ->
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth().background(UiHp.copy(alpha = 0.08f), RoundedCornerShape(7.dp)),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("HP", color = UiHp, fontSize = 6.sp, fontWeight = FontWeight.Black)
                Text("×${formatMultiplier(FormationRules.rowHpMultiplier[row])}", color = UiText, fontSize = 7.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

internal fun cellLabel(index: Int): String = "R${GameRules.rowOf(index) + 1}C${GameRules.colOf(index) + 1}"

@Composable
internal fun ScreenTitleBar(
    title: String,
    subtitle: String,
    rightText: String? = null,
    onBack: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(50.dp)
            .background(UiPanel, RoundedCornerShape(10.dp))
            .border(1.dp, UiGoldSoft, RoundedCornerShape(10.dp))
            .padding(horizontal = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        OutlinedButton(
            onClick = onBack,
            modifier = Modifier.size(38.dp),
            contentPadding = PaddingValues(0.dp),
            border = BorderStroke(1.dp, UiBorder),
        ) { Text("‹", color = UiText, fontSize = 22.sp) }
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = UiGold, fontSize = 12.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = UiMuted, fontSize = 7.sp)
        }
        rightText?.let {
            Text(it, color = UiHp, fontSize = 9.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.End)
        }
    }
}
