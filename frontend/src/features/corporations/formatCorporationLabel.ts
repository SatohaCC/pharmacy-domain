import type { Corporation } from "./schemas";

/**
 * 法人セレクトボックス用の表示ラベルを生成する。
 * UUID を露出させず、名称と代表者名（個人区分の場合は開設者氏名）を組み合わせる。
 */
export function formatCorporationOptionLabel(
  corporation: Pick<Corporation, "name" | "category" | "representative_name">,
): string {
  const rep = (corporation.representative_name ?? "").trim();
  if (rep) {
    const roleLabel = corporation.category === "individual" ? "開設者" : "代表";
    return `${corporation.name}（${roleLabel}: ${rep}）`;
  }
  const fallbackCategory = corporation.category === "individual" ? "個人開設者" : "法人";
  return `${corporation.name}（${fallbackCategory}）`;
}
