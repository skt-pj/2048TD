package com.sktpj.td2048

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private enum class AppScreen {
    GAME,
    HOME,
    FORMATION,
    CHARACTERS,
    GACHA,
}

@Composable
fun GameApp() {
    BackHandler(enabled = true) {
        // System back key / back gesture is intentionally disabled.
    }

    val ownedCharacters = remember { StarterRoster.characters }
    val engine = remember { GameEngine(initialFormation = ownedCharacters) }
    var snapshot by remember { mutableStateOf(engine.snapshot()) }
    var screen by remember { mutableStateOf(AppScreen.GAME) }
    var paused by remember { mutableStateOf(false) }
    var formationDraft by remember { mutableStateOf(snapshot.formation) }
    var settings by remember { mutableStateOf(GameSettings()) }
    var selectedCharacter by remember { mutableStateOf<CharacterDefinition?>(null) }
    var characterBackScreen by remember { mutableStateOf(AppScreen.HOME) }

    LaunchedEffect(engine, screen, paused) {
        var lastFrame = withFrameNanos { it }
        while (isActive) {
            withFrameNanos { frame ->
                val deltaSeconds = (frame - lastFrame) / 1_000_000_000f
                lastFrame = frame
                if (screen == AppScreen.GAME && !paused && snapshot.gameOverReason == null) {
                    snapshot = engine.tick(deltaSeconds)
                }
            }
        }
    }

    LaunchedEffect(snapshot.mergeBurst) {
        if (snapshot.mergeBurst > 0) {
            delay(240)
            snapshot = engine.clearMergeBurst()
        }
    }

    MaterialTheme(
        colorScheme = darkColorScheme(
            background = UiBackground,
            surface = UiPanel,
            primary = UiGold,
            secondary = UiBoss,
        ),
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = UiBackground,
        ) {
            when (screen) {
                AppScreen.GAME -> Box(modifier = Modifier.fillMaxSize()) {
                    MainGameScreen(
                        snapshot = snapshot,
                        paused = paused,
                        settings = settings,
                        onSettingsChange = { settings = it },
                        onMove = { direction -> snapshot = engine.move(direction) },
                        onReset = {
                            paused = false
                            snapshot = engine.reset()
                        },
                        onPause = { paused = !paused },
                        onQuit = {
                            paused = false
                            screen = AppScreen.HOME
                        },
                    )
                    ScoreOverlay(score = snapshot.score)
                }

                AppScreen.HOME -> HomeScreen(
                    formation = snapshot.formation,
                    onStart = {
                        paused = false
                        snapshot = engine.reset()
                        screen = AppScreen.GAME
                    },
                    onFormation = {
                        formationDraft = snapshot.formation
                        screen = AppScreen.FORMATION
                    },
                    onCharacters = {
                        selectedCharacter = null
                        characterBackScreen = AppScreen.HOME
                        screen = AppScreen.CHARACTERS
                    },
                    onGacha = {
                        screen = AppScreen.GACHA
                    },
                )

                AppScreen.FORMATION -> FormationScreen(
                    formation = formationDraft,
                    ownedCharacters = ownedCharacters,
                    onFormationChange = { formationDraft = it },
                    onShowCharacter = { character ->
                        selectedCharacter = character
                        characterBackScreen = AppScreen.FORMATION
                        screen = AppScreen.CHARACTERS
                    },
                    onSave = {
                        snapshot = engine.setFormation(formationDraft)
                        screen = AppScreen.HOME
                    },
                    onCancel = {
                        formationDraft = snapshot.formation
                        screen = AppScreen.HOME
                    },
                )

                AppScreen.CHARACTERS -> CharacterCollectionScreen(
                    characters = ownedCharacters,
                    formation = formationDraft.ifEmpty { snapshot.formation },
                    initialCharacter = selectedCharacter,
                    onBack = {
                        selectedCharacter = null
                        screen = characterBackScreen
                    },
                )

                AppScreen.GACHA -> GachaEntranceScreen(
                    characters = ownedCharacters,
                    onBack = { screen = AppScreen.HOME },
                    onCharacters = {
                        selectedCharacter = null
                        characterBackScreen = AppScreen.GACHA
                        screen = AppScreen.CHARACTERS
                    },
                )
            }
        }
    }
}
