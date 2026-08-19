from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


main_path = Path("app/src/main/java/com/sktpj/td2048/MainGameScreen.kt")
main = main_path.read_text(encoding="utf-8")

boss_marker = """        snapshot.bossWarning?.let { warning ->\n"""
main = replace_once(
    main,
    boss_marker,
    """        BattleParticleVfxLayer(\n            snapshot = snapshot,\n            simpleEffects = simpleEffects,\n            modifier = Modifier.fillMaxSize(),\n        )\n\n""" + boss_marker,
    "battle particle overlay",
)

old_impact = """    snapshot.vfxEvents.forEach { event ->\n        drawCommercialImpactEvent(\n            event = event,\n            elapsedSeconds = snapshot.elapsedSeconds,\n            simpleEffects = simpleEffects,\n        )\n    }\n"""
new_impact = """    snapshot.vfxEvents.forEach { event ->\n        drawCommercialImpactLabel(\n            event = event,\n            elapsedSeconds = snapshot.elapsedSeconds,\n        )\n    }\n"""
main = replace_once(main, old_impact, new_impact, "replace handmade impact particles")

machine_spark = """                drawVectorSparkBurst(center, color, 8f, effectPhase, simpleEffects)\n"""
main = replace_once(main, machine_spark, "", "remove machine gun handmade spark")

explosive_spark = """                drawVectorSparkBurst(center, color, 16f, effectPhase, simpleEffects)\n"""
main = replace_once(main, explosive_spark, "", "remove explosive handmade spark")

main_path.write_text(main, encoding="utf-8")

vfx_path = Path("app/src/main/java/com/sktpj/td2048/CommercialVfx.kt")
vfx = vfx_path.read_text(encoding="utf-8")
append_marker = "\ninternal fun DrawScope.drawCommercialMergeAccent(\n"
if append_marker not in vfx:
    raise RuntimeError("CommercialVfx append marker not found")

label_function = r'''
internal fun DrawScope.drawCommercialImpactLabel(
    event: VfxEvent,
    elapsedSeconds: Float,
) {
    val age = elapsedSeconds - event.createdAtSeconds
    if (age < 0f) return
    val duration = when (event.type) {
        VfxEventType.HIT -> 0.38f
        VfxEventType.KILL -> 0.62f
        VfxEventType.BOSS_KILL -> 0.86f
    }
    if (age > duration) return
    val progress = (age / duration).coerceIn(0f, 1f)
    val center = Offset(size.width * event.x, size.height * event.y)
    val labelColor = when (event.type) {
        VfxEventType.HIT -> if (event.weaponType == WeaponType.LASER) VfxPink else VfxWhite
        VfxEventType.KILL -> VfxWhite
        VfxEventType.BOSS_KILL -> VfxGold
    }
    drawDamageNumber(
        damage = event.damage,
        center = center,
        progress = progress,
        color = labelColor,
        emphasized = event.type != VfxEventType.HIT,
    )
}

'''
vfx = vfx.replace(append_marker, "\n" + label_function + "internal fun DrawScope.drawCommercialMergeAccent(\n", 1)
vfx_path.write_text(vfx, encoding="utf-8")

print("Applied ParticleEmitter battlefield VFX integration")
