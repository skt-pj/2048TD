from pathlib import Path

path = Path("app/src/main/java/com/sktpj/td2048/MainGameScreen.kt")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    "import androidx.compose.ui.draw.drawWithContent\n",
    "",
    "remove board drawWithContent import",
)

replace_once(
    """    var previousBoard by remember { mutableStateOf(snapshot.board) }\n    var lastDirection by remember { mutableStateOf<Direction?>(null) }\n    var moveEpoch by remember { mutableIntStateOf(0) }\n    var effectMergeValue by remember { mutableIntStateOf(0) }\n    val mergeAccentProgress = remember { Animatable(1f) }\n\n""",
    """    var previousBoard by remember { mutableStateOf(snapshot.board) }\n    var lastDirection by remember { mutableStateOf<Direction?>(null) }\n    var moveEpoch by remember { mutableIntStateOf(0) }\n\n""",
    "remove board merge VFX state",
)

replace_once(
    """    LaunchedEffect(moveEpoch) {\n        if (moveEpoch > 0) {\n            delay(220)\n            lastDirection = null\n        }\n    }\n    LaunchedEffect(snapshot.mergePeak) {\n        if (snapshot.mergePeak > 0) {\n            effectMergeValue = snapshot.mergePeak\n            mergeAccentProgress.snapTo(0f)\n            mergeAccentProgress.animateTo(\n                1f,\n                animationSpec = tween(\n                    durationMillis = if (simpleEffects) 220 else 360,\n                    easing = FastOutSlowInEasing,\n                ),\n            )\n            effectMergeValue = 0\n        }\n    }\n\n""",
    """    LaunchedEffect(moveEpoch) {\n        if (moveEpoch > 0) {\n            delay(220)\n            lastDirection = null\n        }\n    }\n\n""",
    "remove board merge accent animation",
)

replace_once(
    """                    .border(1.dp, NeonGrid.copy(alpha = 0.72f), RoundedCornerShape(10.dp))\n                    .padding(4.dp)\n                    .drawWithContent {\n                        drawContent()\n                        if (effectMergeValue > 0) {\n                            drawCommercialMergeAccent(\n                                mergeValue = effectMergeValue,\n                                progress = mergeAccentProgress.value,\n                                simpleEffects = simpleEffects,\n                            )\n                        }\n                    }\n                    .pointerInput(Unit) {\n""",
    """                    .border(1.dp, NeonGrid.copy(alpha = 0.72f), RoundedCornerShape(10.dp))\n                    .padding(4.dp)\n                    .pointerInput(Unit) {\n""",
    "remove board merge accent overlay",
)

replace_once(
    """                Text(\n                    if (snapshot.mergeBurst > 0) \"MERGE +${snapshot.mergeBurst}\" else \"列を育てて武器進化\",\n                    color = if (snapshot.mergeBurst > 0) NeonPink else NeonMuted,\n                    fontSize = 9.sp,\n                    fontWeight = if (snapshot.mergeBurst > 0) FontWeight.Bold else FontWeight.Normal,\n                )\n""",
    """                Text(\n                    \"列を育てて武器進化\",\n                    color = NeonMuted,\n                    fontSize = 9.sp,\n                )\n""",
    "remove dynamic merge text from board",
)

replace_once(
    """                                mergePulse = snapshot.mergePeak > 0 && value == snapshot.mergePeak,\n""",
    """                                mergePulse = false,\n""",
    "disable tile merge pulse",
)

path.write_text(text, encoding="utf-8")
print("Applied PAD-style combo/FEVER polish and removed board VFX")
