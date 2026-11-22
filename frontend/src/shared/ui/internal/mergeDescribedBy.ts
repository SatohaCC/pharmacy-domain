/** 複数の aria-describedby トークンを重複なく結合する。 */
export function mergeDescribedBy(...values: Array<string | undefined>): string | undefined {
  const tokens = values
    .filter(Boolean)
    .flatMap((value) => value?.split(/\s+/) ?? [])
    .filter(Boolean);
  return tokens.length > 0 ? Array.from(new Set(tokens)).join(" ") : undefined;
}
