from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


game_path = Path("app/src/main/java/com/sktpj/td2048/GameScreen.kt")
game = game_path.read_text(encoding="utf-8")
game = replace_once(
    game,
    """                        settings = settings,\n                        feverActive = comboFeverSnapshot.feverActive,\n""",
    """                        settings = settings,\n                        feverActive = comboFeverSnapshot.feverActive,\n                        comboFeverState = comboFeverSnapshot,\n""",
    "pass full combo/fever state to battlefield HUD",
)
game_path.write_text(game, encoding="utf-8")


main_path = Path("app/src/main/java/com/sktpj/td2048/MainGameScreen.kt")
main = main_path.read_text(encoding="utf-8")
main = replace_once(
    main,
    """    settings: GameSettings,\n    feverActive: Boolean,\n    onSettingsChange: (GameSettings) -> Unit,\n""",
    """    settings: GameSettings,\n    feverActive: Boolean,\n    comboFeverState: ComboFeverSnapshot,\n    onSettingsChange: (GameSettings) -> Unit,\n""",
    "main screen full combo/fever state argument",
)
main = replace_once(
    main,
    """                simpleEffects = settings.simpleEffects,\n                feverActive = feverActive,\n                modifier = Modifier\n""",
    """                simpleEffects = settings.simpleEffects,\n                feverActive = feverActive,\n                comboFeverState = comboFeverState,\n                modifier = Modifier\n""",
    "battlefield full combo/fever state argument",
)
main = replace_once(
    main,
    """    simpleEffects: Boolean,\n    feverActive: Boolean,\n    modifier: Modifier = Modifier,\n) {\n""",
    """    simpleEffects: Boolean,\n    feverActive: Boolean,\n    comboFeverState: ComboFeverSnapshot,\n    modifier: Modifier = Modifier,\n) {\n""",
    "battlefield signature full combo/fever state",
)
main = replace_once(
    main,
    """        BattleParticleVfxLayer(\n            snapshot = snapshot,\n            simpleEffects = simpleEffects,\n            feverActive = feverActive,\n            modifier = Modifier.fillMaxSize(),\n        )\n\n""",
    """        BattleParticleVfxLayer(\n            snapshot = snapshot,\n            simpleEffects = simpleEffects,\n            feverActive = feverActive,\n            modifier = Modifier.fillMaxSize(),\n        )\n\n        TsumReferenceBattleHud(\n            state = comboFeverState,\n            simpleEffects = simpleEffects,\n            modifier = Modifier.fillMaxSize(),\n        )\n\n""",
    "mount Tsum-referenced COMBO and FEVER HUD inside battlefield",
)
main_path.write_text(main, encoding="utf-8")

print("Applied Tsum-referenced COMBO/FEVER layout metrics")
