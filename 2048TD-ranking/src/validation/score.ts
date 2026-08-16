export function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function isScore(value: unknown): value is number {
  return isNonNegativeInteger(value) && value <= 2_147_483_647;
}

export function isMaxTile(value: unknown): value is number {
  if (!isNonNegativeInteger(value)) return false;
  if (value === 0) return true;
  let remaining = value;
  while (remaining % 2 === 0) remaining /= 2;
  return remaining === 1;
}

export function isAppVersion(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 32;
}

export function isGameOverReason(
  value: unknown,
): value is "HP_ZERO" | "BOARD_STUCK" {
  return value === "HP_ZERO" || value === "BOARD_STUCK";
}
