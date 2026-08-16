const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTER = /\p{Cc}/u;

export function isUuidV4(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

export function isDisplayName(value: unknown): value is string | null | undefined {
  if (value === undefined || value === null) return true;
  return (
    typeof value === "string" &&
    Array.from(value).length <= 16 &&
    !CONTROL_CHARACTER.test(value)
  );
}
