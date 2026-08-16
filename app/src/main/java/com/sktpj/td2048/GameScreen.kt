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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private enum class AppScreen {
    GAME,
    HOME,
    FORMATION,
    CHARACTERS,
    GACHA,
    RANKING,
}

@Composable
fun GameApp() {
    BackHandler(enabled = true) {
        // System back key / back gesture is intentionally disabled.
    }

    val context = LocalContext.current.applicationContext
    val ownedCharacters = remember { StarterRoster.characters }
    val engine = remember { GameEngine(initialFormation = ownedCharacters) }
    val rankingRepository = remember(context) { RankingRepository(context) }

    var snapshot by remember { mutableStateOf(engine.snapshot()) }
    var screen by remember { mutableStateOf(AppScreen.GAME) }
    var paused by remember { mutableStateOf(false) }
    var formationDraft by remember { mutableStateOf(snapshot.formation) }
    var settings by remember { mutableStateOf(GameSettings()) }
    var selectedCharacter by remember { mutableStateOf<CharacterDefinition?>(null) }
    var characterBackScreen by remember { mutableStateOf(AppScreen.HOME) }

    var gameSessionId by remember { mutableIntStateOf(1) }
    var rankingRunId by remember { mutableStateOf<String?>(null) }
    var rankingSubmissionState by remember {
        mutableStateOf<RankingSubmissionState>(RankingSubmissionState.Starting)
    }
    var rankingBoardState by remember {
        mutableStateOf<RankingBoardState>(RankingBoardState.Loading)
    }
    var rankingRefreshKey by remember { mutableIntStateOf(0) }

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

    LaunchedEffect(screen, gameSessionId) {
        if (screen != AppScreen.GAME) return@LaunchedEffect
        val sessionAtStart = gameSessionId
        rankingRunId = null
        rankingSubmissionState = RankingSubmissionState.Starting

        rankingRepository.retryPending()
        when (val result = rankingRepository.startRun()) {
            is RankingApiResult.Success -> {
                if (screen == AppScreen.GAME && gameSessionId == sessionAtStart) {
                    rankingRunId = result.value.runId
                    rankingSubmissionState = RankingSubmissionState.Ready
                }
            }
            is RankingApiResult.Failure -> {
                if (screen == AppScreen.GAME && gameSessionId == sessionAtStart) {
                    rankingSubmissionState = RankingSubmissionState.Unavailable
                }
            }
        }
    }

    LaunchedEffect(snapshot.gameOverReason, rankingRunId, gameSessionId, screen) {
        if (screen != AppScreen.GAME) return@LaunchedEffect
        val reason = snapshot.gameOverReason ?: return@LaunchedEffect
        val runId = rankingRunId ?: return@LaunchedEffect
        val sessionAtSubmit = gameSessionId

        rankingSubmissionState = RankingSubmissionState.Submitting
        val pending = rankingRepository.createPendingFinish(runId, snapshot, reason)
        when (val result = rankingRepository.submitFinish(pending)) {
            is RankingSubmitResult.Accepted -> {
                if (screen == AppScreen.GAME && gameSessionId == sessionAtSubmit) {
                    rankingSubmissionState = RankingSubmissionState.Submitted(
                        rank = result.response.rank,
                        bestScore = result.response.bestScore,
                        bestUpdated = result.response.bestUpdated,
                    )
                    rankingRunId = null
                }
            }
            RankingSubmitResult.AlreadyAccepted -> {
                if (screen == AppScreen.GAME && gameSessionId == sessionAtSubmit) {
                    rankingSubmissionState = RankingSubmissionState.SubmittedEarlier
                    rankingRunId = null
                }
            }
            RankingSubmitResult.Pending -> {
                if (screen == AppScreen.GAME && gameSessionId == sessionAtSubmit) {
                    rankingSubmissionState = RankingSubmissionState.Pending
                    rankingRunId = null
                }
            }
            is RankingSubmitResult.Rejected -> {
                if (screen == AppScreen.GAME && gameSessionId == sessionAtSubmit) {
                    rankingSubmissionState = RankingSubmissionState.Unavailable
                    rankingRunId = null
                }
            }
        }
    }

    LaunchedEffect(screen, rankingRefreshKey) {
        if (screen != AppScreen.RANKING) return@LaunchedEffect
        rankingBoardState = RankingBoardState.Loading
        rankingRepository.retryPending()
        val leaderboard = rankingRepository.getLeaderboard()
        val myRank = rankingRepository.getMyRank()
        rankingBoardState = if (
            leaderboard is RankingApiResult.Success &&
            myRank is RankingApiResult.Success
        ) {
            RankingBoardState.Loaded(leaderboard.value, myRank.value)
        } else {
            RankingBoardState.Error
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
                        rankingSubmissionState = rankingSubmissionState,
                        onSettingsChange = { settings = it },
                        onMove = { direction -> snapshot = engine.move(direction) },
                        onReset = {
                            paused = false
                            rankingRunId = null
                            rankingSubmissionState = RankingSubmissionState.Starting
                            gameSessionId += 1
                            snapshot = engine.reset()
                        },
                        onPause = { paused = !paused },
                        onQuit = {
                            paused = false
                            rankingRunId = null
                            rankingSubmissionState = RankingSubmissionState.Unavailable
                            gameSessionId += 1
                            screen = AppScreen.HOME
                        },
                    )
                    ScoreOverlay(score = snapshot.score)
                }

                AppScreen.HOME -> HomeScreen(
                    formation = snapshot.formation,
                    onStart = {
                        paused = false
                        rankingRunId = null
                        rankingSubmissionState = RankingSubmissionState.Starting
                        gameSessionId += 1
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
                    onRanking = {
                        rankingRefreshKey += 1
                        screen = AppScreen.RANKING
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

                AppScreen.RANKING -> RankingScreen(
                    state = rankingBoardState,
                    onBack = { screen = AppScreen.HOME },
                    onReload = { rankingRefreshKey += 1 },
                )
            }
        }
    }
}
