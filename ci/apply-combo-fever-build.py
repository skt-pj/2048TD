from pathlib import Path

path = Path("app/src/main/java/com/sktpj/td2048/GameScreen.kt")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


def replace_expected(old: str, new: str, expected: int, label: str) -> None:
    global text
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{label}: expected {expected} matches, found {count}")
    text = text.replace(old, new)


replace_once(
    """    val engine = remember { GameEngine(initialFormation = ownedCharacters) }\n    val rankingRepository = remember(context) { RankingRepository(context) }\n\n    var snapshot by remember { mutableStateOf(engine.snapshot()) }\n""",
    """    val engine = remember { GameEngine(initialFormation = ownedCharacters) }\n    val comboFeverController = remember { ComboFeverController() }\n    val rankingRepository = remember(context) { RankingRepository(context) }\n\n    var snapshot by remember { mutableStateOf(engine.snapshot()) }\n    var comboFeverSnapshot by remember { mutableStateOf(comboFeverController.snapshot()) }\n""",
    "controller state",
)

replace_once(
    """                if (screen == AppScreen.GAME && !paused && snapshot.gameOverReason == null) {\n                    snapshot = engine.tick(deltaSeconds)\n                }\n""",
    """                if (screen == AppScreen.GAME && !paused && snapshot.gameOverReason == null) {\n                    snapshot = engine.tick(deltaSeconds)\n                    comboFeverController.tick(deltaSeconds)\n                    comboFeverSnapshot = comboFeverController.snapshot()\n                }\n""",
    "gameplay timer",
)

replace_once(
    """                        onMove = { direction -> snapshot = engine.move(direction) },\n""",
    """                        onMove = { direction ->\n                            val moveResult = GameRules.moveWithoutSpawn(snapshot.board, direction)\n                            snapshot = engine.move(direction)\n                            if (moveResult.moved && moveResult.createdValues.isNotEmpty()) {\n                                comboFeverController.onMerge(moveResult.createdValues.size)\n                                comboFeverSnapshot = comboFeverController.snapshot()\n                            }\n                        },\n""",
    "merge event",
)

replace_expected(
    """                            snapshot = engine.reset()\n""",
    """                            comboFeverController.reset()\n                            comboFeverSnapshot = comboFeverController.snapshot()\n                            snapshot = engine.reset()\n""",
    2,
    "game resets",
)

replace_once(
    """                    ScoreOverlay(score = snapshot.score)\n                    if (snapshot.gameOverReason != null) {\n""",
    """                    ScoreOverlay(score = snapshot.score)\n                    ComboFeverOverlay(\n                        state = comboFeverSnapshot,\n                        simpleEffects = settings.simpleEffects,\n                    )\n                    if (snapshot.gameOverReason != null) {\n""",
    "combo fever overlay",
)

path.write_text(text, encoding="utf-8")
print("Applied COMBO/FEVER GameScreen patch")
